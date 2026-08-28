import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const recentDeploys = new Map<string, number>();
const DEPLOY_COOLDOWN_MS = 45_000;

function getConfiguredOrigins() {
  return (Deno.env.get('ADMIN_ALLOWED_ORIGINS') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function isAllowedBrowserOrigin(request: Request) {
  const origin = request.headers.get('origin') || '';
  const configured = getConfiguredOrigins();
  return configured.length === 0 || !origin || configured.includes(origin);
}

function getCorsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  const configured = getConfiguredOrigins();
  const allowedOrigin = configured.length === 0
    ? '*'
    : (configured.includes(origin) ? origin : 'null');
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function getSafeDeployHook() {
  const value = Deno.env.get('VERCEL_DEPLOY_HOOK_URL') || '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'api.vercel.com') return null;
    return url;
  } catch (_error) {
    return null;
  }
}

Deno.serve(async request => {
  if (!isAllowedBrowserOrigin(request)) {
    return json(request, { error: 'Origin not allowed.' }, 403);
  }
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return json(request, { error: 'Method not allowed.' }, 405);
  }

  const token = getBearerToken(request);
  if (!token) return json(request, { error: 'Authentication required.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return json(request, { error: 'Authentication service is not configured.' }, 503);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const userResult = await supabase.auth.getUser(token);
  const user = userResult.data.user;
  if (userResult.error || !user) {
    return json(request, { error: 'Your session is invalid or expired.' }, 401);
  }

  const adminResult = await supabase
    .from('portfolio_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (adminResult.error) {
    return json(request, { error: 'Could not verify admin access.' }, 500);
  }
  if (!adminResult.data) {
    return json(request, { error: 'Admin access required.' }, 403);
  }

  const lastDeployAt = recentDeploys.get(user.id) || 0;
  if (Date.now() - lastDeployAt < DEPLOY_COOLDOWN_MS) {
    return json(request, { error: 'An update was just requested. Wait a moment before trying again.' }, 429);
  }

  const deployHook = getSafeDeployHook();
  if (!deployHook) {
    return json(request, { error: 'The SEO and previews update is not configured yet.' }, 503);
  }

  recentDeploys.set(user.id, Date.now());
  let deployResponse: Response;
  try {
    deployResponse = await fetch(deployHook, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000)
    });
  } catch (_error) {
    recentDeploys.delete(user.id);
    return json(request, { error: 'Vercel could not be reached. Try again shortly.' }, 502);
  }

  const deployData = await deployResponse.json().catch(() => ({})) as {
    job?: { id?: unknown; state?: unknown };
  };
  if (!deployResponse.ok) {
    recentDeploys.delete(user.id);
    return json(request, { error: 'Vercel did not accept the update request.' }, 502);
  }

  return json(request, {
    ok: true,
    state: typeof deployData.job?.state === 'string' ? deployData.job.state : 'PENDING',
    jobId: typeof deployData.job?.id === 'string' ? deployData.job.id : null
  }, 202);
});
