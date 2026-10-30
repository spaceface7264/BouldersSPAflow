// Server-side email and phone existence check for signup.
//
// The browser never holds BRP_INTEGRATOR_TOKEN and never receives a customer
// id, name, email, or phone from this route. BRP's customer array stays here.
// Success is only { emailMatch, phoneMatch }. Lookup failures are
// { unavailable: true } so signup can continue.
//
// Phone normalization is copied from utils/registrationIdentity.js. Do not
// import that module: Pages Functions must not pull in the browser bundle.

const ALLOWED_ORIGINS = [
  'https://join.boulders.dk',
  'https://bouldersspaflow.pages.dev',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
];

const DEFAULT_BRP_API_BASE = 'https://boulders.brpsystems.com/apiserver';

interface Env {
  BRP_INTEGRATOR_TOKEN?: string;
  BRP_API_BASE?: string;
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

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

function unavailable(origin: string | null): Response {
  return jsonResponse({ unavailable: true }, 200, origin);
}

// Same behavior as normalizePhone in utils/registrationIdentity.js.
function normalizePhone(
  countryCode: unknown,
  number: unknown,
): { country: string; number: string } | null {
  const rawNumber = typeof number === 'string' ? number.replace(/\s/g, '') : '';
  if (!rawNumber) return null;

  const country = String(countryCode ?? '')
    .replace(/\s/g, '')
    .replace(/^\+/, '');

  let digits = rawNumber.replace(/^\+/, '');
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (!digits) return null;

  return { country, number: digits };
}

function readCheckInput(parsed: unknown): {
  email: string | null;
  phone: { country: string; number: string } | null;
} {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { email: null, phone: null };
  }

  const record = parsed as { email?: unknown; mobilePhone?: unknown };
  const email =
    typeof record.email === 'string' && record.email.trim() ? record.email.trim() : null;

  let phone: { country: string; number: string } | null = null;
  const mobile = record.mobilePhone;
  if (mobile && typeof mobile === 'object' && !Array.isArray(mobile)) {
    const phoneRecord = mobile as { countryCode?: unknown; number?: unknown };
    phone = normalizePhone(phoneRecord.countryCode, phoneRecord.number);
  }

  return { email, phone };
}

function brpApiBase(env: Env): string {
  const configured = typeof env.BRP_API_BASE === 'string' ? env.BRP_API_BASE.trim() : '';
  return (configured || DEFAULT_BRP_API_BASE).replace(/\/+$/, '');
}

function integratorToken(env: Env): string | null {
  const token = typeof env.BRP_INTEGRATOR_TOKEN === 'string' ? env.BRP_INTEGRATOR_TOKEN.trim() : '';
  return token || null;
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Never read or log the BRP body. It can contain customer records.
  }
}

// Exact match only: BRP returns a JSON array of exact hits. Non-empty means match.
// Email and phone are separate requests so the two booleans stay independent.
async function hasExactMatch(
  base: string,
  token: string,
  params: Record<string, string>,
): Promise<boolean> {
  const url = new URL(`${base}/api/ver3/customers`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    await discardBody(response);
    throw new Error('lookup failed');
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('lookup failed');
  }
  if (!Array.isArray(data)) {
    throw new Error('lookup failed');
  }
  return data.length > 0;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const requestOrigin = request.headers.get('Origin');
  const origin = validateOrigin(requestOrigin);

  // This route attaches the integrator token and answers whether an email or
  // phone is registered. A missing Origin must not reach that lookup. Browser
  // POSTs from the allowlisted signup origins send Origin.
  if (!origin) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, null);
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  const token = integratorToken(env);
  if (!token) {
    console.warn('[registration check] integrator token missing');
    return unavailable(origin);
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
  }

  const { email, phone } = readCheckInput(parsed);
  if (!email && !phone) {
    return jsonResponse({ emailMatch: false, phoneMatch: false }, 200, origin);
  }

  const base = brpApiBase(env);
  try {
    const emailMatch = email
      ? await hasExactMatch(base, token, { email })
      : false;
    const phoneMatch = phone
      ? await hasExactMatch(base, token, {
          'mobilePhone.number': phone.number,
          'mobilePhone.country': phone.country,
        })
      : false;
    return jsonResponse({ emailMatch, phoneMatch }, 200, origin);
  } catch {
    // Do not log the caught error. A fetch failure message includes the
    // request URL, which contains the searched email or phone.
    console.warn('[registration check] lookup unavailable');
    return unavailable(origin);
  }
}
