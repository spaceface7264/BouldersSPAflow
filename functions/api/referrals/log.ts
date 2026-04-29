// Cloudflare Pages Function: client-side mirror of referral attributions.
//
// Why this exists:
// BRP records `recruitedBy` on the subscription, but doesn't always surface
// it nicely in the admin UI. This function lets us append a row to a
// Google Sheet every time a signup is attributed to a recruiter, so the
// team has a manual "reward queue" they can act on without depending on
// BRP's admin UX or any specific report being available.
//
// The actual sheet write happens in a Google Apps Script Web App. This
// function is the gatekeeper: it validates origin + auth, redacts noisy
// fields, and forwards the payload with a shared secret. The Apps Script
// URL never touches the browser.
//
// IMPORTANT: This is a non-blocking ledger, NOT a source of truth.
// Failures here must NEVER block signup. The client fires this
// keepalive and ignores the response.

const ALLOWED_ORIGINS = [
  'https://join.boulders.dk',
  'https://bouldersspaflow.pages.dev',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
];

interface AttributionPayload {
  recruiterId: number | string;
  newCustomerId?: number | string | null;
  newCustomerEmail?: string | null;
  newCustomerName?: string | null;
  subscriptionId?: number | string | null;
  subscriptionItemId?: number | string | null;
  orderId?: number | string | null;
  subscriptionProductId?: number | string | null;
  subscriptionProductName?: string | null;
  sourceUrl?: string | null;
}

interface Env {
  REFERRAL_SHEET_WEBHOOK_URL?: string;
  REFERRAL_SHEET_WEBHOOK_SECRET?: string;
  ENVIRONMENT?: string;
}

function validateOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.endsWith('.pages.dev')) return origin;
  return null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
  return headers;
}

function isPositiveInteger(value: unknown): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

function clampString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, max);
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const requestOrigin = request.headers.get('Origin');
  const origin = validateOrigin(requestOrigin);

  // Reject unknown origins outright (matches api-proxy security posture).
  if (requestOrigin && !origin) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, null);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  // If the env vars aren't configured yet (e.g. in a fresh preview), fail
  // soft so the client never sees an error during signup. We still log a
  // warning server-side so we notice the misconfiguration.
  if (!env.REFERRAL_SHEET_WEBHOOK_URL || !env.REFERRAL_SHEET_WEBHOOK_SECRET) {
    console.warn('[ReferralLog] Webhook env vars missing — silently dropping');
    return jsonResponse({ ok: false, reason: 'not-configured' }, 200, origin);
  }

  // Light defense: require an Authorization header so this endpoint can't
  // be spammed by anonymous traffic. We don't validate the JWT contents —
  // BRP will reject the underlying signup if the token is bogus, and our
  // ledger is a derivative of that signup, so a fake JWT here can't fake
  // an attribution that doesn't exist in BRP.
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401, origin);
  }

  let body: AttributionPayload;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
  }

  if (!isPositiveInteger(body.recruiterId)) {
    return jsonResponse({ error: 'recruiterId required (positive integer)' }, 400, origin);
  }

  const data = {
    recruiterId: Number(body.recruiterId),
    newCustomerId: body.newCustomerId != null ? String(body.newCustomerId).slice(0, 50) : '',
    newCustomerEmail: clampString(body.newCustomerEmail, 200),
    newCustomerName: clampString(body.newCustomerName, 200),
    subscriptionId: body.subscriptionId != null ? String(body.subscriptionId).slice(0, 50) : '',
    subscriptionItemId: body.subscriptionItemId != null ? String(body.subscriptionItemId).slice(0, 50) : '',
    orderId: body.orderId != null ? String(body.orderId).slice(0, 50) : '',
    subscriptionProductId: body.subscriptionProductId != null ? String(body.subscriptionProductId).slice(0, 50) : '',
    subscriptionProductName: clampString(body.subscriptionProductName, 200),
    sourceUrl: clampString(body.sourceUrl, 500),
    environment:
      env.ENVIRONMENT ||
      (origin && origin.endsWith('.pages.dev') ? 'preview' : origin?.includes('localhost') ? 'dev' : 'production'),
    userAgent: clampString(request.headers.get('User-Agent'), 300),
  };

  try {
    const upstream = await fetch(env.REFERRAL_SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.REFERRAL_SHEET_WEBHOOK_SECRET, data }),
      // 5s upper bound — Apps Script is usually < 1s but can spike on cold start.
      signal: AbortSignal.timeout(5000),
    });

    const text = await upstream.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* Apps Script may return non-JSON on certain errors */
    }

    if (!upstream.ok || (parsed && parsed.ok === false)) {
      console.error('[ReferralLog] Upstream error:', upstream.status, text.slice(0, 500));
      return jsonResponse({ ok: false, reason: 'upstream-error' }, 502, origin);
    }

    return jsonResponse({ ok: true, deduped: !!parsed?.deduped }, 200, origin);
  } catch (err: any) {
    // Don't leak internals to the client — keep this opaque.
    console.error('[ReferralLog] Forward failed:', err?.message);
    return jsonResponse({ ok: false, reason: 'forward-failed' }, 502, origin);
  }
}
