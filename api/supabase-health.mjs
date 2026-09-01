const DEFAULT_SUPABASE_URL = 'https://mfxrygjuhhwguitrhnnk.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_7UT6Sm40lMapktUKYcOt-A_7iqcQtkZ';

const HEALTH_QUERIES = [
  ['portfolio_site_settings', { select: 'id', id: 'eq.global', limit: '1' }],
  ['portfolio_sections', { select: 'id', published: 'eq.true', limit: '1' }],
  ['portfolio_projects', { select: 'id', published: 'eq.true', limit: '1' }]
];

function bearerToken(request) {
  const value = request.headers?.authorization;
  return Array.isArray(value) ? value[0] : value;
}

function json(response, status, body) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  return response.status(status).json(body);
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { ok: false, error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return json(response, 503, { ok: false, error: 'Health check is not configured' });
  }

  if (bearerToken(request) !== `Bearer ${cronSecret}`) {
    return json(response, 401, { ok: false, error: 'Unauthorized' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  const headers = {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
    Accept: 'application/json'
  };

  try {
    const results = await Promise.all(HEALTH_QUERIES.map(async ([table, parameters]) => {
      const query = new URLSearchParams(parameters);
      const result = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
        headers,
        signal: AbortSignal.timeout(10_000)
      });

      if (!result.ok) {
        throw new Error(`${table} returned HTTP ${result.status}`);
      }

      // Consume the response so connection and parsing failures are reported.
      await result.json();
      return table;
    }));

    return json(response, 200, {
      ok: true,
      checkedAt: new Date().toISOString(),
      checks: results.length
    });
  } catch (error) {
    console.error('Supabase health check failed:', error);
    return json(response, 502, { ok: false, error: 'Supabase health check failed' });
  }
}
