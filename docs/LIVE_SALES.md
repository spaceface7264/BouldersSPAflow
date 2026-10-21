# Live sales ledger (Conversion Dashboard)

After a confirmed purchase, `app.js` calls `logLiveSale(orderId)` (fire-and-forget, inside
`trackConfirmedPurchase`). `functions/api/sales/log.ts` fetches the order from BRP with the
customer's own token and stores order-level data in Cloudflare D1. Nothing is stored unless BRP
returns the order. Checkout never waits on this and never fails because of it.

Stored: order id, date, gym, products, amounts, paid status, 99 kr flag, landing path, UTM
source/medium/campaign, click-id *type*. Never: names, emails, phone, customer id, click-id values.

Numbers are preliminary. The morning BRP pull is the official source.

## One-time setup

1. Create the database:
   `npx wrangler d1 create boulders-sales`
2. Create the tables:
   `npx wrangler d1 execute boulders-sales --remote --file=migrations/0001_live_sales.sql`
3. Bind it to the Pages project: Cloudflare dashboard → Workers & Pages →
   bouldersspaflow → Settings → Bindings → Add → D1 database →
   variable name `SALES_DB`, database `boulders-sales`. Do it for Production and Preview.
4. Deploy as usual. Until step 3 is done the endpoint answers `not-configured` and does nothing.

## Check it

`npx wrangler d1 execute boulders-sales --remote --command "SELECT sale_date, gym_name, COUNT(*) FROM live_sales GROUP BY 1,2 ORDER BY 1 DESC LIMIT 20"`
