import { createClient } from 'npm:@supabase/supabase-js@2';

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  category?: unknown;
  message?: unknown;
  website?: unknown;
};

const encoder = new TextEncoder();

function getCorsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  const configured = (Deno.env.get('CONTACT_ALLOWED_ORIGINS') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const allowedOrigin = configured.length === 0
    ? '*'
    : (configured.includes(origin) ? origin : configured[0]);
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.trim().replace(/\u0000/g, '').slice(0, maxLength)
    : '';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 20000) return json(request, { error: 'Request is too large.' }, 413);

  let payload: ContactPayload;
  try {
    payload = await request.json();
  } catch (_error) {
    return json(request, { error: 'Invalid request body.' }, 400);
  }

  // Honeypot: bots commonly fill hidden website fields.
  if (cleanText(payload.website, 200)) return json(request, { ok: true });

  const name = cleanText(payload.name, 100);
  const email = cleanText(payload.email, 254).toLowerCase();
  const category = cleanText(payload.category, 80);
  const message = cleanText(payload.message, 5000);

  if (name.length < 2) return json(request, { error: 'Enter your name or company.' }, 400);
  if (!isValidEmail(email)) return json(request, { error: 'Enter a valid email address.' }, 400);
  if (!category) return json(request, { error: 'Select a project category.' }, 400);
  if (message.length < 20) return json(request, { error: 'Tell us a little more about the project.' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const contactTo = Deno.env.get('CONTACT_TO_EMAIL');
  const contactFrom = Deno.env.get('CONTACT_FROM_EMAIL');
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !contactTo || !contactFrom) {
    return json(request, { error: 'Contact service is not configured.' }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const clientIp = (request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown')
    .split(',')[0]
    .trim();
  const rateSecret = Deno.env.get('CONTACT_RATE_LIMIT_SECRET') || serviceRoleKey;
  const requestHash = await sha256(`${rateSecret}:${clientIp}`);
  const rateWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const rateResult = await supabase
    .from('portfolio_contact_messages')
    .select('id', { count: 'exact', head: true })
    .eq('request_hash', requestHash)
    .gte('created_at', rateWindow);
  if (rateResult.error) return json(request, { error: 'Could not validate this request.' }, 500);
  if ((rateResult.count || 0) >= 5) {
    return json(request, { error: 'Too many messages. Please try again later.' }, 429);
  }

  const insert = await supabase
    .from('portfolio_contact_messages')
    .insert({ name, email, category, message, request_hash: requestHash })
    .select('id')
    .single();
  if (insert.error) return json(request, { error: 'Could not save your message.' }, 500);

  const subject = `Portfolio contact — ${name} — ${category}`;
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeCategory = escapeHtml(category);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: contactFrom,
      to: [contactTo],
      reply_to: email,
      subject,
      text: `Name: ${name}\nEmail: ${email}\nCategory: ${category}\n\n${message}`,
      html: `<h2>New portfolio message</h2><p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Category:</strong> ${safeCategory}</p><p><strong>Message:</strong><br>${safeMessage}</p>`
    })
  });

  const resendData = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    await supabase
      .from('portfolio_contact_messages')
      .update({
        delivery_status: 'failed',
        delivery_error: cleanText((resendData as { message?: unknown }).message, 500)
      })
      .eq('id', insert.data.id);
    return json(request, { error: 'Your message was saved, but email delivery failed.' }, 502);
  }

  await supabase
    .from('portfolio_contact_messages')
    .update({
      delivery_status: 'sent',
      provider_id: cleanText((resendData as { id?: unknown }).id, 200)
    })
    .eq('id', insert.data.id);

  return json(request, { ok: true });
});
