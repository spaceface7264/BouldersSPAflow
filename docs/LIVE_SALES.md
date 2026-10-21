# Live sales ledger (Conversion Dashboard)

After a confirmed purchase, `app.js` calls `logLiveSale(orderId)` (fire-and-forget, inside
`trackConfirmedPurchase`). `functions/api/sales/log.ts` fetches the order from BRP with the
customer's own token and stores order-level data in Cloudflare D1. Nothing is stored unless BRP
returns the order. Checkout never waits on this and never fails because of it.

Stored: order id, date, gym, products, amounts, paid status, 99 kr flag, landing path, last-touch
UTM source/medium/campaign + click-id *type*, and first-touch equivalents (`first_*`). Never:
names, emails, phone, customer id, click-id values.

Numbers are preliminary. The morning BRP pull is the official source.

## Attribution (browser)

On each land, join builds a **touch** from (in order):

1. `utm_source` / `utm_medium` / `utm_campaign` and whether `gclid` / `fbclid` / `ttclid` is present
2. Else `document.referrer` (external only): e.g. google → `google`/`organic`, instagram →
   `instagram`/`organic`, other hosts → hostname/`referral`

**With Cookiebot statistics consent:** first + last touch live in `localStorage`
(`boulders_sales_attribution_v2`) for **7 days** (TTL refreshed on each touch). First visit in
the window sets both; later visits keep first and overwrite last. Consent revoke clears that key.

**Without statistics consent:** sessionStorage first-touch only (same as before), still with
referrer fill for the current session. No cross-day memory.

On purchase, the client sends **last** as `attribution` (fills `utm_*` / Live channel) and
**first** as `attributionFirst` (fills `first_*`).

## One-time setup

1. Create the database:
   `npx wrangler d1 create boulders-sales`
2. Create the tables:
   `npx wrangler d1 execute boulders-sales --remote --file=migrations/0001_live_sales.sql`
   `npx wrangler d1 execute boulders-sales --remote --file=migrations/0002_attribution_first_touch.sql`
3. Bind it to the Pages project: Cloudflare dashboard → Workers & Pages →
   bouldersspaflow → Settings → Bindings → Add → D1 database →
   variable name `SALES_DB`, database `boulders-sales`. Do it for Production and Preview.
4. Deploy as usual. Until step 3 is done the endpoint answers `not-configured` and does nothing.

## Check it

`npx wrangler d1 execute boulders-sales --remote --command "SELECT sale_date, gym_name, COUNT(*) FROM live_sales GROUP BY 1,2 ORDER BY 1 DESC LIMIT 20"`
