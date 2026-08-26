/**
 * Fast landing-to-work handoff.
 * Preloads the explicitly selected overview highlights and stores a short-lived
 * snapshot so /work can paint its first image before the full Supabase load.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'portfolio-work-entry-preview-v1';
  const MAX_AGE = 10 * 60 * 1000;
  let pending = null;

  function normalizeFocus(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 50;
  }

  function normalizeScale(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(100, Math.min(200, number)) : 100;
  }

  function normalizeStills(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 3).map(item => {
      const source = typeof item === 'string' ? { url: item } : (item || {});
      return { url: typeof source.url === 'string' ? source.url.trim() : '', size: source.size || '16-9' };
    }).filter(item => item.url);
  }

  function projectFromRow(row) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category || '',
      client: row.client || '',
      year: row.year || '',
      services: Array.isArray(row.services) ? row.services : [],
      projectSummary: row.project_summary || '',
      contribution: row.contribution || '',
      director: row.director || '',
      productionCompany: row.production_company || '',
      watchNowEnabled: row.watch_now_enabled === true,
      watchNowUrl: row.watch_now_url || '',
      coverImage: row.cover_image || '',
      previewVideo: row.preview_video || '',
      projectStills: normalizeStills(row.project_stills),
      section: row.section_id,
      size: row.size || '16-9',
      published: row.published !== false,
      order: Number(row.display_order),
      mobileFocusX: normalizeFocus(row.mobile_focus_x),
      mobileFocusY: normalizeFocus(row.mobile_focus_y),
      mobileCoverScale: normalizeScale(row.mobile_cover_scale)
    };
  }

  function selectHighlights(projects, settings) {
    const identities = Array.isArray(settings?.workHeroProjectIds)
      ? settings.workHeroProjectIds.filter(Boolean).slice(0, 3)
      : [];
    if (identities.length) {
      const selected = identities.map(identity => projects.find(project =>
        (project.id && project.id === identity) || project.slug === identity
      )).filter(Boolean);
      if (selected.length) return selected;
    }
    return projects
      .filter(project => project.section === 'featured-work')
      .sort((a, b) => Number(a.order || 99) - Number(b.order || 99))
      .slice(0, 3);
  }

  function getFirstMedia(project) {
    if (project.coverImage) return { type: 'image', url: project.coverImage };
    if (project.projectStills[0]?.url) return { type: 'image', url: project.projectStills[0].url };
    if (project.previewVideo) return { type: 'video', url: project.previewVideo };
    return null;
  }

  function preloadMedia(media) {
    if (!media?.url) return Promise.resolve(false);
    return new Promise(resolve => {
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(result);
      };
      const timeoutId = window.setTimeout(() => finish(false), 6000);

      if (media.type === 'video') {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.addEventListener('canplay', () => finish(true), { once: true });
        video.addEventListener('error', () => finish(false), { once: true });
        video.src = media.url;
        video.load();
        return;
      }

      const image = new Image();
      image.addEventListener('load', () => finish(true), { once: true });
      image.addEventListener('error', () => finish(false), { once: true });
      image.src = media.url;
      if (image.complete && image.naturalWidth) finish(true);
    });
  }

  function save(preview) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preview));
    } catch (error) {
      // The theme-colored loading surface still works if storage is blocked.
    }
  }

  function read(viewId) {
    if (viewId !== 'work') return null;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const preview = JSON.parse(raw);
      const fresh = Number(preview.savedAt) > Date.now() - MAX_AGE;
      return preview.viewId === 'work' && fresh ? preview : null;
    } catch (error) {
      return null;
    }
  }

  async function requestRows(table, params) {
    const config = window.SUPABASE_CONFIG || {};
    if (!config.url || !config.publishableKey || !window.fetch) return [];
    const query = new URLSearchParams(params);
    const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`
      }
    });
    if (!response.ok) throw new Error(`Work preview request failed (${response.status}).`);
    return response.json();
  }

  async function fetchPreview() {
    const [settingsRows, projectRows] = await Promise.all([
      requestRows('portfolio_site_settings', {
        select: 'settings',
        id: 'eq.global',
        limit: '1'
      }),
      requestRows('portfolio_projects', {
        select: 'id,slug,title,category,client,year,services,project_summary,contribution,director,production_company,watch_now_enabled,watch_now_url,cover_image,preview_video,project_stills,section_id,size,published,display_order,mobile_focus_x,mobile_focus_y,mobile_cover_scale',
        published: 'eq.true',
        order: 'display_order.asc'
      })
    ]);
    const rawSettings = settingsRows[0]?.settings || {};
    const settings = window.siteSettings ? siteSettings.normalize(rawSettings) : rawSettings;
    const projects = selectHighlights(projectRows.map(projectFromRow), settings);
    if (!projects.length) return null;

    const mediaReady = await preloadMedia(getFirstMedia(projects[0]));
    if (!mediaReady) return null;
    const preview = { viewId: 'work', settings, projects, savedAt: Date.now() };
    save(preview);
    return preview;
  }

  function preload(viewId = 'work') {
    if (viewId !== 'work') return Promise.resolve(null);
    const stored = read('work');
    if (stored) {
      preloadMedia(getFirstMedia(stored.projects[0]));
      return Promise.resolve(stored);
    }
    if (!pending) {
      pending = fetchPreview()
        .catch(error => {
          console.warn('Could not preload the work overview; using the theme-colored loading surface.', error);
          return null;
        })
        .finally(() => { pending = null; });
    }
    return pending;
  }

  window.sectionEntryPreview = { preload, read };
}());
