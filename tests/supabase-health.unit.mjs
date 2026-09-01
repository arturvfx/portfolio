import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import handler from '../api/supabase-health.mjs';

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const originalEnvironment = {
  CRON_SECRET: process.env.CRON_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY
};

function mockResponse() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    }
  };
}

beforeEach(() => {
  process.env.CRON_SECRET = 'test-cron-secret';
  process.env.SUPABASE_URL = 'https://portfolio-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('rejects requests that do not carry the Vercel cron secret', async () => {
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response('[]');
  };
  const response = mockResponse();

  await handler({ method: 'GET', headers: {} }, response);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { ok: false, error: 'Unauthorized' });
  assert.equal(fetchCalls, 0);
});

test('performs three small authenticated Supabase reads', async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response('[{"id":"test"}]', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const response = mockResponse();

  await handler({
    method: 'GET',
    headers: { authorization: 'Bearer test-cron-secret' }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.checks, 3);
  assert.equal(requests.length, 3);
  assert.ok(requests.every(item => item.options.headers.apikey === 'test-publishable-key'));
  assert.ok(requests.some(item => item.url.includes('/portfolio_site_settings?')));
  assert.ok(requests.some(item => item.url.includes('/portfolio_sections?')));
  assert.ok(requests.some(item => item.url.includes('/portfolio_projects?')));
  assert.equal(response.headers['cache-control'], 'no-store, max-age=0');
});

test('reports a failed Supabase read without exposing its details', async () => {
  console.error = () => {};
  globalThis.fetch = async url => new Response('failure', {
    status: String(url).includes('portfolio_projects') ? 500 : 200,
    headers: { 'content-type': 'application/json' }
  });
  const response = mockResponse();

  await handler({
    method: 'GET',
    headers: { authorization: 'Bearer test-cron-secret' }
  }, response);

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, { ok: false, error: 'Supabase health check failed' });
});
