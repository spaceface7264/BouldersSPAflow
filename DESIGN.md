# DESIGN.md

Design rationale for the Join Boulders signup app. This document explains *why* the codebase is shaped the way it is — decisions and constraints that aren't obvious from reading any single file. For commands and a high-level map, see `CLAUDE.md`.

## What this app is

A single-page signup flow at `join.boulders.dk` that lets people buy a Boulders membership, a 15-day trial pass, or a punch card, plus pay add-ons, all backed by BRP's third-party gym-management API (BRP API3). It is the only customer-facing way to start an account; the BRP-hosted alternative is what we replaced.

Constraints that shape the design:

- The catalog (products, prices, gyms, coupons, subscriptions) lives in BRP and is the source of truth. We do not have a database of our own.
- Danish-first market. Copy, currency rounding, postal-code lookup, and timezone behavior all assume DK defaults.
- Marketing runs paid campaigns that point at specific URLs (`/freetrial`, `/membership-offer`, `/99kr`) and need bespoke landing pages without each becoming its own deploy.
- Deploys land on Cloudflare Pages; there is no traditional backend server we own — only Pages Functions for the API proxy and a couple of helpers.

## Two apps in one tree (and why)

The codebase contains both a shipped vanilla-JS app and an in-progress React/TS rewrite of the same flow. This is intentional, not abandoned-but-forgotten:

- `index.html` + `app.js` + `styles.css` + `utils/*.js` is what `join.boulders.dk` serves today. `app.js` is one file by design — every step, the global `state` object, route handling, BRP calls, cart math, and landing variants live there so a single grep finds anything. The cost is size (~24k lines) and the lack of TypeScript type-checking on it (`tsconfig.json` covers only `src` and `functions`).
- `src/main.tsx` → `app/App.tsx` → `features/signup/*` + `shared/*` is a feature-sliced React rewrite (React Router, React Query, Zustand, React Hook Form + Zod, Tailwind). It currently builds but is **not mounted in production** — `index.html` has no `#root` and only loads `./app.js`. The ESLint `import/no-cycle` + `import/no-internal-modules` rules in `.eslintrc.cjs` exist to keep this scaffold disciplined as it grows.

The migration plan is to port the flow step-by-step into `features/signup/`, then eventually flip `index.html` to mount the React app. Until that flip, "edit the signup" means `app.js`.

## Frontend architecture (the shipped app)

### Single global `state` object

`app.js` keeps one `const state = { ... }` (around line 4848) that captures everything for the current session: selected gym, language, plan, cart items, totals, applied discount, fetched product lists by category, auth state, order/customer IDs, payment status flags, test-mode toggles. Steps read and mutate it directly — there is no store library, no reducer, no event bus. Two reasons this works:

- Each session is short and local; there's no multi-tab coordination beyond cookies for the BRP token.
- Reads of `state` in render code make the dependency graph obvious without indirection.

In-flight async work is deduped with module-level promises (`orderCreationPromise`, `subscriptionAttachPromise`, `productsLoadPromise`, etc.) plus cooldown timestamps (`tokenValidationCooldownUntil`, `gymLoadCooldownUntil`, `customerSyncCooldownUntil`, `loginCooldownUntil`). This is the de-facto rate limiter for outbound BRP calls and the guard against double-creates when users smash buttons.

### Routing without a router

There is no router library. Landing variants live in `LANDING_ROUTE_CONFIG` at the top of `app.js`:

```
/freetrial         → LandingFreeTrial,        labelKey: 'LandingFreeTrial',     mode: 'single'
/membership-offer  → LandingFirstMonthFree,   labelKey: 'LandingFirstMonthFree', mode: 'multi'
/99kr              → LandingFirstClimb,       labelKey: 'firstclimb',           mode: 'single'
```

`resolveLandingRouteConfig()` reads `window.location.pathname` once on load. The `labelKey` is a BRP product label — the route filters BRP's product catalog to whatever carries that label, so marketing can launch a new campaign by attaching a label to a product in BRP without a code change. `mode: 'single'` auto-selects the one matching product; `mode: 'multi'` shows a chooser. `NON_INDEXABLE_PATHS` lists routes that get `<meta name="robots" content="noindex">` injected so paid landing pages don't compete with the canonical home page in search.

### Product taxonomy via BRP labels

BRP doesn't model "this is a membership" vs. "this is a punch card" — everything is a product with attached **labels**. We layer our own visibility/categorization rules on top of those labels (see `app.js` around lines 3159–3475):

| Label                  | Meaning in this app                                                    |
| ---------------------- | ---------------------------------------------------------------------- |
| `Hidden`               | Force-exclude even if otherwise public (highest priority).             |
| `Public`               | Regular membership shown on the main step.                             |
| `PublicCampaign`       | Time-bound campaign card; lives in `state.campaignSubscriptions`/`campaignValueCards` with a countdown driven by `state.campaignEndDate`. |
| `15-Day Trial Pass`    | Day-pass product surfaced separately so it can have its own activation-date picker (`state.subscriptionStartDate`). |
| `firstclimb`           | The 99 kr "Your First Climb" offer. One-per-customer rule: customers who have ever held a `firstclimb`-labeled product are blocked. |
| `boostProduct`         | Surfaced in a separate boost modal, not the main flow.                 |
| `availableFor: PUBLIC` | BRP-native field used as a fallback signal when labels are absent.     |

The match is case-insensitive and whitespace-collapsed (`normalizeFirstclimbLabelName`) because BRP allows free-form label naming. This is the place where "did marketing launch the campaign correctly?" answers come from — verify the label on the product in BRP first.

### Money

All prices are half-krone rounded. `utils/format.js` provides `roundToHalfKrone`, `formatPriceHalfKrone`, and `formatCurrencyHalfKrone`. Reason: BRP returns prices with sub-krone precision but every customer-facing price at Boulders ends in `.00` or `.50`. Ad-hoc rounding has caused cart totals to disagree with the BRP payment link, so always go through the helpers.

A separate, related rule: coupon-driven 100% discounts cannot redirect to a PSP — the PSP refuses zero totals. Those orders are finalized client-side. This is why the proxy/payment-link code paths split on "is the final total zero?" before generating a link.

### Locale & dates

- Default `Accept-Language` is `da-DK` everywhere (Vite dev proxy, Cloudflare proxy, BRP requests). The app supports an English toggle via i18n, but data sent *to* BRP always uses DK conventions.
- Dates sent to BRP (e.g., 15-day-pass activation, today's signup date) use the user's **local** calendar day via `getTodayLocalDateString`, not UTC. Reason: a user clicking "start today" at 23:00 CET should not get a BRP record dated tomorrow.

## Backend integration

### Why a proxy exists

BRP's API and `api-join.boulders.dk` both reject browser requests cross-origin. We do not run a backend, so the proxy is a Cloudflare Pages Function (`functions/api-proxy/index.ts`) that the frontend points at via a single query-string `path=`. The proxy is intentionally dumb — it does origin validation, path allowlisting, header forwarding, body size capping, and route prefixing to the right BRP base URL. It does not do business logic.

### Environment-aware base URLs

`utils/apiConfig.js` picks the base URL by hostname:

- `localhost` → empty base; Vite's dev proxy handles `/api` and `/api/ver3` rewriting (see `vite.config.ts`).
- `*.pages.dev`, `join.boulders.dk`, `boulders.dk` → use `/api-proxy?path=...` (the Pages Function).
- `*.workers.dev` → call `api-join.boulders.dk` directly (the Workers deploy isn't behind the proxy).
- Anything else → direct to `api-join.boulders.dk`.

`buildApiUrl` then either appends the path or encodes it as `?path=...` depending on `useProxy`. This is the single seam where the frontend stops caring about deploy target.

### BRP path conventions

The proxy splits BRP traffic based on the path prefix because BRP itself has two surfaces and a confusingly named third:

- `/api/ver3/*` → `https://boulders.brpsystems.com/apiserver/api/ver3/*` (the prefix is preserved in full — backend confirmed; do not "simplify").
- `/services/*` → `https://boulders.brpsystems.com/apiserver/api/ver3/services/*`.
- `/ver3/*` → `https://boulders.brpsystems.com/apiserver/api/ver3/*`.
- Everything else → `https://api-join.boulders.dk/*` (our Boulders-side helper API; not BRP).

The full OpenAPI 3.0 spec for BRP API3 is checked in at `docs/brp-api3-openapi.yaml` — read it before guessing endpoint shapes; BRP's docs site has had stale examples.

### Tokens

`utils/tokenStorage.js` reads/writes a login session cookie (`readLoginSessionCookie`, `writeLoginSessionCookie`, `clearLoginSessionCookie`, `hydrateFromCookie`). The proxy forwards `Authorization` verbatim when present. Anonymous endpoints (product list, business units) don't need it; the customer/order endpoints do.

## Security model

- **Origin allowlist** in the proxy: `join.boulders.dk`, the canonical `*.pages.dev` preview, and dev ports. Anything else gets 403 before the upstream is contacted. Path allowlist (`/api/*`, `/services/*`, `/ver3/*`) is defense in depth.
- **No internal error leakage**: the proxy returns a generic `"Internal server error"` to the client and logs the real stack server-side.
- **1 MB body cap** on inbound proxy requests.
- **HTML sanitization** via `sanitize.js` (DOMPurify) for anything written into the DOM that isn't a primitive literal we control. The combination of i18n strings, API-sourced product names, and `innerHTML` usage in `app.js` means this rule has to be followed at every insertion point.
- **CSP & friends** live in `_headers` (copied into `dist/` at build time).
- **Sentry** is loaded from the CDN in `index.html` so it can capture errors during module load. The bundler-side `@sentry/vite-plugin` only uploads source maps when `SENTRY_AUTH_TOKEN` is present at build time, so local builds don't accidentally write to the production Sentry project.

## Observability

- **Sentry** captures unhandled errors and traces (10% sample). Environment is `production` only on `join.boulders.dk`; everywhere else is `development`. A common-noise denylist (`NetworkError`, `Failed to fetch`, extension-injected errors) is configured in `index.html`.
- **Logs are silent by default**: `console.log`/`console.warn` are no-ops unless `window.DEBUG_LOGS === true`. Use `devLog`/`devWarn` in code so that flipping the global flag re-enables logging. This is the only realistic way to debug a customer-reported issue in prod without redeploying.
- **GTM + Google Consent Mode v2** are wired such that nothing fires before Cookiebot resolves consent. `gtm-utils.js` is the typed wrapper around `dataLayer.push`.

## Build & deploy

- Vite is the bundler. `tsc` runs first (build script: `tsc && vite build`) so the React tree's type errors fail the build even though `app.js` is unchecked.
- `copyFunctionsPlugin` in `vite.config.ts` copies `functions/`, `postal-codes-dk.js`, and `_headers` into `dist/` at `closeBundle` so a `wrangler pages deploy ./dist` ships everything Pages expects.
- `resolveBasePath()` lets the same build be hosted under `/` or a subpath via `VITE_BASE_PATH` / `GITHUB_REPOSITORY`. Production is always `/`.
- Two deploy targets exist: Cloudflare Pages (the default, `npm run deploy`) and Cloudflare Workers (`npm run deploy:cloudflare`). Workers exists because Pages Functions has had outages where the Workers target was the fallback.

## Known design debt

- **`app.js` is too big** to navigate without grep. The ongoing rewrite under `features/signup/` is the long-term answer; until it lands, prefer small targeted edits over restructuring in `app.js`.
- **No automated tests.** `PRE_MERGE_TEST_CHECKLIST.md`, `test-security.sh`, and `test-xss.html` are manual aids. Add tests inside `features/signup/` (where TS + a real entry point makes them tractable) rather than retrofitting onto `app.js`.
- **Two React entry points** (`src/main.tsx` and `app/App.tsx`) is awkward — `src/main.tsx` boots, but the actual app shell lives in `app/App.tsx`. Pick one before mounting the React tree in prod.
- **Tailwind compiles but the shipped page uses `styles.css`.** Tailwind classes inside the React tree only matter once it goes live.
- **Coupon → zero-total flow** finalizes client-side because PSPs reject zero-amount payment links. This split is a known soft spot; any change to checkout has to keep both branches working.
