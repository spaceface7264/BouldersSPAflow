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

  // Apps Script Web Apps return a 302 redirect from /exec to a
  // googleusercontent.com URL where doPost's result lives. Cloudflare's
  // fetch() follows redirects automatically, but the body of the original
  // POST is not preserved across the 3xx — and on top of that, when the
  // request originates from a non-browser client some redirect chains
  // dead-end at a Google Drive "file not found" page.
  //
  // To work around both issues we follow redirects manually, treating any
  // 3xx as "doPost ran, now GET the result page". This mirrors what curl's
  // `-L` does for the doGet smoke test — and matches how every webhook
  // integration to Apps Script in the wild handles this.
  const payload = JSON.stringify({ secret: env.REFERRAL_SHEET_WEBHOOK_SECRET, data });
  const startedAt = Date.now();
  const traceId = crypto.randomUUID();

  try {
    let currentUrl = env.REFERRAL_SHEET_WEBHOOK_URL;
    let response: Response | null = null;
    let hops = 0;

    for (hops = 0; hops < 5; hops++) {
      const init: RequestInit = {
        method: hops === 0 ? 'POST' : 'GET',
        headers: hops === 0
          ? { 'Content-Type': 'application/json' }
          : { 'Accept': 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      };
      if (hops === 0) (init as any).body = payload;

      const hopResponse = await fetch(currentUrl, init);

      if (hopResponse.status >= 300 && hopResponse.status < 400) {
        const location = hopResponse.headers.get('Location');
        if (!location) {
          console.error(`[ReferralLog ${traceId}] Redirect with no Location at hop ${hops}, status ${hopResponse.status}`);
          return jsonResponse({ ok: false, reason: 'redirect-no-location', traceId }, 502, origin);
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      response = hopResponse;
      break;
    }

    if (!response) {
      console.error(`[ReferralLog ${traceId}] Too many redirects (${hops})`);
      return jsonResponse({ ok: false, reason: 'too-many-redirects', traceId }, 502, origin);
    }

    const text = await response.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* Apps Script may return HTML on internal errors */
    }

    if (!response.ok) {
      console.error(
        `[ReferralLog ${traceId}] Upstream HTTP ${response.status} after ${hops} hop(s) in ${Date.now() - startedAt}ms. Body[0..500]: ${text.slice(0, 500)}`,
      );
      return jsonResponse({ ok: false, reason: 'upstream-http-error', upstreamStatus: response.status, traceId }, 502, origin);
    }

    if (parsed && parsed.ok === false) {
      console.error(`[ReferralLog ${traceId}] Apps Script rejected: ${parsed.error || 'unknown'}`);
      return jsonResponse({ ok: false, reason: 'upstream-rejected', upstreamError: parsed.error, traceId }, 502, origin);
    }

    if (!parsed) {
      // Reached a 200 page that wasn't our JSON — this is Apps Script
      // returning an HTML page, usually because the deployment isn't
      // routing POSTs correctly or the script has a syntax error.
      console.error(
        `[ReferralLog ${traceId}] Upstream 200 but non-JSON body. Hops: ${hops}. Body[0..500]: ${text.slice(0, 500)}`,
      );
      return jsonResponse({ ok: false, reason: 'upstream-non-json', traceId }, 502, origin);
    }

    console.log(`[ReferralLog ${traceId}] Logged in ${Date.now() - startedAt}ms (${hops} hop(s))${parsed.deduped ? ' [deduped]' : ''}`);
    return jsonResponse({ ok: true, deduped: !!parsed.deduped, traceId }, 200, origin);
  } catch (err: any) {
    console.error(`[ReferralLog ${traceId}] Forward failed:`, err?.name, err?.message);
    return jsonResponse({ ok: false, reason: 'forward-failed', error: err?.message, traceId }, 502, origin);
  }
}
