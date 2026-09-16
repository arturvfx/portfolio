import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../data/supabase-service.js', import.meta.url), 'utf8');
const section = { id: 'section', slug: 'section', title: 'SECTION', order: 1 };
const project = {
  id: 'project', slug: 'project', title: 'PROJECT', section: 'section', order: 1,
  desktopFocusX: 34, desktopFocusY: 61, desktopCoverScale: 117,
  mobileFocusX: 72, mobileFocusY: 42, mobileCoverScale: 128
};

function backend({ migrations = [], error = null } = {}) {
  const writes = [];
  const tables = { portfolio_sections: [], portfolio_projects: [] };
  const client = {
    from(table) {
      let columns = '*';
      const query = {
        select(value) { columns = value; return query; },
        order() { return query; },
        eq() { return query; },
        async limit() {
          if (error) return { error };
          const required = columns.includes('project_desktop') ? 20 : 19;
          return migrations.includes(required) ? { data: [] }
            : { error: { code: '42703', message: 'column does not exist' } };
        },
        async upsert(rows) {
          writes.push({ table, rows: JSON.parse(JSON.stringify(rows)) });
          tables[table] = rows;
          return { data: rows };
        },
        then(resolve, reject) { return Promise.resolve({ data: tables[table] }).then(resolve, reject); }
      };
      return query;
    }
  };
  const window = {
    SUPABASE_CONFIG: { url: 'https://test.invalid', publishableKey: 'test' },
    supabase: { createClient: () => client }
  };
  vm.runInNewContext(source, { window });
  return { api: window.portfolioBackend, writes };
}

test('legacy schema accepts ordinary edits without sending unavailable framing fields', async () => {
  const { api, writes } = backend();
  await api.importPortfolio([section], [{ ...project, title: 'EDITED TITLE' }]);
  const row = writes.find(write => write.table === 'portfolio_projects').rows[0];
  assert.equal(row.title, 'EDITED TITLE');
  assert.equal(row.desktop_focus_x, 34);
  assert.equal(row.mobile_cover_scale, 128);
  assert.ok(!Object.keys(row).some(key => /^(project_mobile|project_desktop|hero_mobile)_/.test(key)));
  const loaded = await api.loadPortfolio();
  assert.equal(loaded.projects[0].projectDesktopFocusX, 34);
  assert.equal(loaded.projects[0].heroMobileCoverScale, 128);
});

test('custom framing without migration 020 fails before any write', async () => {
  const { api, writes } = backend({ migrations: [19] });
  await assert.rejects(api.importPortfolio([section], [{ ...project, heroMobileFocusX: 3 }]), /020_independent_hero_framing.sql/);
  assert.equal(writes.length, 0);
});

test('custom mobile project framing without migration 019 fails before any write', async () => {
  const { api, writes } = backend();
  await assert.rejects(api.importPortfolio([section], [{ ...project, projectMobileFocusY: 3 }]), /019_project_mobile_hero_framing.sql/);
  assert.equal(writes.length, 0);
});

test('migrated schema round-trips independent values, including zero', async () => {
  const { api, writes } = backend({ migrations: [19, 20] });
  await api.importPortfolio([section], [{
    ...project, projectDesktopFocusX: 0, projectDesktopFocusY: 88, projectDesktopCoverScale: 150,
    heroMobileFocusX: 12, heroMobileFocusY: 0, heroMobileCoverScale: 190,
    projectMobileFocusX: 60, projectMobileFocusY: 20, projectMobileCoverScale: 160
  }]);
  const row = writes.find(write => write.table === 'portfolio_projects').rows[0];
  assert.equal(row.project_desktop_focus_x, 0);
  assert.equal(row.hero_mobile_cover_scale, 190);
  const loaded = (await api.loadPortfolio()).projects[0];
  assert.equal(loaded.projectDesktopFocusX, 0);
  assert.equal(loaded.heroMobileFocusY, 0);
  assert.equal(loaded.projectMobileCoverScale, 160);
  assert.equal(loaded.mobileCoverScale, 128);
});

test('permission failures are not treated as missing migrations', async () => {
  const error = { code: '42501', message: 'permission denied' };
  const { api, writes } = backend({ error });
  await assert.rejects(api.importPortfolio([section], [project]), value => value.code === '42501');
  assert.equal(writes.length, 0);
});
