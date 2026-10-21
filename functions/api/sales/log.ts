// Cloudflare Pages Function: live sales ledger for the Boulders Conversion Dashboard.
//
// The browser sends { orderId, landingPath, attribution } plus the customer's
// Bearer token right after a confirmed purchase. We do NOT trust the browser's
// product data: this function fetches the order from BRP with that token and
// stores what BRP says. A fake call cannot create a sale that BRP doesn't have.
//
// Privacy: only order-level, non-personal fields are stored (order id, gym,
// products, amounts, status, landing path, UTM). Never names, emails, phone
// numbers, customer ids or click ids.
//
// IMPORTANT: This is a non-blocking ledger, NOT a source of truth.
// Failures here must NEVER affect checkout. The client fires this with
// keepalive and ignores the response. Official numbers come from the
// morning BRP pull.

const ALLOWED_ORIGINS = [
  'https://join.boulders.dk',
  'https://bouldersspaflow.pages.dev',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
];

const BRP_ORDER_URL = (orderId: string) => `https://api-join.boulders.dk/api/orders/${encodeURIComponent(orderId)}`;

// Minimal D1 typing so we don't need extra packages.
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

interface Env {
  SALES_DB?: D1Database;
  ENVIRONMENT?: string;
}

interface LogPayload {
  orderId?: number | string;
  landingPath?: string | null;
  attribution?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    click_id_type?: string | null;
  } | null;
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

function clamp(value: unknown, max: number): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

// BRP amounts are in øre (CurrencyOut). Mirrors extractCurrencyOutKr in app.js.
function toKr(currencyOut: any): number | null {
  if (currencyOut == null) return null;
  if (typeof currencyOut === 'number') return Math.round(currencyOut) / 100;
  if (typeof currencyOut === 'object') {
    if (typeof currencyOut.amount === 'number') return Math.round(currencyOut.amount) / 100;
    const nested = currencyOut.value ?? currencyOut.discount;
    if (nested != null) return toKr(nested);
  }
  return null;
}

// YYYY-MM-DD in Copenhagen time.
function copenhagenDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

interface SaleItem {
  item_type: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  amount_kr: number | null;
}

function extractItems(order: any): SaleItem[] {
  const groups: Array<[string, string]> = [
    ['subscriptionItems', 'membership'],
    ['valueCardItems', 'value-card'],
    ['articleItems', 'addon'],
    ['entryItems', 'entry'],
  ];
  const out: SaleItem[] = [];
  for (const [key, type] of groups) {
    for (const item of order?.[key] || []) {
      const product = item?.product || {};
      out.push({
        item_type: type,
        product_id: clamp(product.id ?? item?.id, 50),
        product_name: clamp(product.name, 200),
        quantity: Number.isInteger(item?.quantity) && item.quantity > 0 ? item.quantity : 1,
        amount_kr: toKr(item?.price?.amount ?? item?.price),
      });
    }
  }
  return out;
}

// Same rule as productHasFirstclimbBlockingLabel in app.js (99 kr / FirstClimb).
const FIRSTCLIMB_LABELS = ['første gang', 'firstclimb'];
function normLabel(v: unknown): string {
  return String(v || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}
function orderIsFirstClimb(order: any): boolean {
  for (const key of ['subscriptionItems', 'valueCardItems', 'articleItems', 'entryItems']) {
    for (const item of order?.[key] || []) {
      const labels = Array.isArray(item?.product?.productLabels) ? item.product.productLabels : [];
      if (labels.some((l: any) => FIRSTCLIMB_LABELS.includes(normLabel(l?.name)))) return true;
    }
  }
  return false;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const requestOrigin = request.headers.get('Origin');
  const origin = validateOrigin(requestOrigin);

  if (requestOrigin && !origin) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, null);
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  // Not set up yet (no D1 binding): fail soft.
  if (!env.SALES_DB) {
    console.warn('[SalesLog] SALES_DB binding missing — silently dropping');
    return jsonResponse({ ok: false, reason: 'not-configured' }, 200, origin);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401, origin);
  }

  let body: LogPayload;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
  }

  const orderId = clamp(body.orderId, 50);
  if (!orderId || !/^\d+$/.test(orderId)) {
    return jsonResponse({ error: 'orderId required (numeric)' }, 400, origin);
  }

  const traceId = crypto.randomUUID();

  // Verify against BRP with the customer's own token.
  let order: any;
  try {
    const res = await fetch(BRP_ORDER_URL(orderId), {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Accept-Language': 'da-DK',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[SalesLog ${traceId}] BRP order lookup ${res.status} for order ${orderId}`);
      return jsonResponse({ ok: false, reason: 'order-not-verified', traceId }, 200, origin);
    }
    order = await res.json();
  } catch (err: any) {
    console.error(`[SalesLog ${traceId}] BRP lookup failed:`, err?.name, err?.message);
    return jsonResponse({ ok: false, reason: 'order-lookup-failed', traceId }, 200, origin);
  }

  const items = extractItems(order);
  if (!items.length) {
    return jsonResponse({ ok: false, reason: 'no-items', traceId }, 200, origin);
  }

  const statusId = Number.isInteger(order?.orderStatus?.id) ? order.orderStatus.id : null;
  const statusName = clamp(order?.orderStatus?.name ?? order?.status, 50);
  const leftToPay = toKr(order?.leftToPay ?? order?.price?.leftToPay);
  const paid = statusName === 'Betalet' || statusId === 2 || leftToPay === 0 ? 1 : 0;

  const now = new Date();
  const attribution = body.attribution || {};
  const clickIdType = ['gclid', 'fbclid', 'ttclid'].includes(String(attribution.click_id_type))
    ? String(attribution.click_id_type) : null;
  const environment = env.ENVIRONMENT ||
    (origin && origin.endsWith('.pages.dev') ? 'preview' : origin?.includes('localhost') ? 'dev' : 'production');

  const db = env.SALES_DB;
  const statements: D1PreparedStatement[] = [
    // Idempotent: first call inserts; later calls only refresh status/paid.
    db.prepare(
      `INSERT INTO live_sales (order_id, logged_at, sale_date, gym_id, gym_name, status_id, status_name, paid,
         total_kr, is_first_climb, landing_path, utm_source, utm_medium, utm_campaign, click_id_type, environment)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
       ON CONFLICT(order_id) DO UPDATE SET
         status_id = excluded.status_id,
         status_name = excluded.status_name,
         paid = MAX(live_sales.paid, excluded.paid)`
    ).bind(
      orderId,
      now.toISOString(),
      copenhagenDate(now),
      clamp(order?.businessUnit?.id, 20),
      clamp(order?.businessUnit?.name ?? order?.businessUnit?.label, 100),
      statusId,
      statusName,
      paid,
      toKr(order?.price?.amount ?? order?.price),
      orderIsFirstClimb(order) ? 1 : 0,
      clamp(body.landingPath, 200),
      clamp(attribution.utm_source, 100),
      clamp(attribution.utm_medium, 100),
      clamp(attribution.utm_campaign, 150),
      clickIdType,
      environment,
    ),
    ...items.map((it, i) =>
      db.prepare(
        `INSERT OR IGNORE INTO live_sale_items (order_id, line_no, item_type, product_id, product_name, quantity, amount_kr)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      ).bind(orderId, i, it.item_type, it.product_id, it.product_name, it.quantity, it.amount_kr)
    ),
  ];

  try {
    await db.batch(statements);
    console.log(`[SalesLog ${traceId}] Logged order ${orderId} (${items.length} line(s), paid=${paid})`);
    return jsonResponse({ ok: true, traceId }, 200, origin);
  } catch (err: any) {
    console.error(`[SalesLog ${traceId}] D1 write failed:`, err?.message);
    return jsonResponse({ ok: false, reason: 'db-write-failed', traceId }, 200, origin);
  }
}
