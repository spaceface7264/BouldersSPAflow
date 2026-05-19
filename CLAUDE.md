# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                # Vite dev server on :5173 (HTTPS if key.pem/cert.pem exist)
npm run build              # tsc + vite build → dist/
npm run lint               # ESLint on .ts/.tsx, max-warnings 0
npm run preview            # Preview the production build
npm run deploy             # Build + wrangler pages deploy to boulders-membership-flow
npm run deploy:cloudflare  # Build + wrangler deploy --assets=./dist (Workers)
```

There is no test runner configured. `PRE_MERGE_TEST_CHECKLIST.md` and `test-security.sh` / `test-xss.html` are manual checks; treat them as smoke tests, not an automated suite.

The dev server proxies API calls so the frontend can talk to BRP without CORS:
- `/api/ver3/*` → `https://boulders.brpsystems.com/apiserver`
- `/api/*` (everything else) → `https://api-join.boulders.dk`

Both proxies forward `Accept-Language` (defaulting to `da-DK`). See `vite.config.ts`.

## Architecture

This repo is **two apps coexisting in one tree** — be careful which one you are editing.

### 1. The shipped app: vanilla JS + a single HTML page

What actually runs in production:

- `index.html` — the entry point Vite builds. Contains Cookiebot, Google Consent Mode, GTM, and inline Sentry init bootstrap.
- `app.js` — ~24k lines of vanilla JS. This is the real signup flow. It owns global `state`, route handling, all step rendering, BRP API calls, cart math, coupon/discount logic, payment-link generation, and the landing-page variants.
- `styles.css` — ~10k lines of hand-written CSS (no Tailwind output despite `tailwind.config.js`).
- `utils/*.js` — ES module helpers imported by `app.js` (`apiRequest.js`, `apiConfig.js`, `format.js`, `geo.js`, `geolocation.js`, `tokenStorage.js`, `input.js`, `validation.js`, `errors.js`, `toast.js`, `dom.js`, `string.js`, `date.js`, `locale.js`).
- `sanitize.js`, `gtm-utils.js`, `postal-codes-dk.js` — additional root-level modules.
- `sentry.config.js` — Sentry SDK config (Sentry itself is loaded from CDN in `index.html`).

Landing routes live inside `app.js` in `LANDING_ROUTE_CONFIG`: `/freetrial`, `/membership-offer`, `/99kr` (firstclimb day-ticket). They are SPA routes handled by `app.js` — there is no router library.

### 2. The TypeScript/React scaffold (in progress, not yet the shipped flow)

A parallel React app is being built but is not what users see in production yet:

- `src/main.tsx`, `src/App.tsx` — minimal placeholder shell.
- `app/App.tsx` — another React entry (overlap with `src/`).
- `features/signup/` — feature module with `components/`, `routes/`, `api/`, `schemas/`, `state/`. Uses React Hook Form + Zod + Zustand + React Query.
- `shared/` — `ui/` (Button, Card, Input, Select, Stepper), `lib/` (http, tokens), `types/`, `constants/`, `styles/tokens.css`.

When the user asks for a change to the live signup behavior, default to editing `app.js` and `index.html` unless they explicitly point at `features/` or `src/`. When working in the React tree, respect the ESLint `import/no-internal-modules` allowlist (`.eslintrc.cjs`): cross-feature imports are forbidden; go through `shared/**` or the feature's public surface.

### Backend & API proxy

All API traffic goes to BRP API3. The full OpenAPI 3.0 spec is at `docs/brp-api3-openapi.yaml` — consult it before guessing endpoint shapes.

In production (Cloudflare Pages), `functions/api-proxy/index.ts` is the CORS-validating proxy:
- Caller passes the target path in `?path=` (e.g. `/api-proxy?path=/api/ver3/services/...`).
- Origin allowlist is enforced (production domains + `*.pages.dev` + localhost dev ports). Unknown origins get 403.
- Path allowlist (`/api/*`, `/services/*`, `/ver3/*`) is defense-in-depth.
- Routing rule (do not "simplify" — backend confirmed):
  - `/api/ver3/*` → `https://boulders.brpsystems.com/apiserver/api/ver3/*` (full prefix kept)
  - `/services/*` → `https://boulders.brpsystems.com/apiserver/api/ver3/services/*`
  - `/ver3/*` → `https://boulders.brpsystems.com/apiserver/api/ver3/*`
  - everything else → `https://api-join.boulders.dk/*`
- 1 MB body cap. `Authorization` and `Accept-Language` are forwarded.

`functions/api/referrals/` holds additional Pages Functions. `vite.config.ts` has a `copyFunctionsPlugin` that copies `functions/` (and `postal-codes-dk.js`, `_headers`) into `dist/` at build close — Pages then deploys them.

### Build details worth knowing

- `vite.config.ts` resolves `base` from `VITE_BASE_PATH` or `GITHUB_REPOSITORY` (for GH Pages-style hosting), defaulting to `/`.
- Sentry source-map upload runs only when `SENTRY_AUTH_TOKEN` is set at build time; `SENTRY_ORG`/`SENTRY_PROJECT`/`VITE_SENTRY_RELEASE` override defaults.
- `sourcemap: true` is on for prod builds (uploaded then deleted from `dist/assets`).
- `tsconfig.json` only includes `src` and `functions`; legacy `app.js` and `utils/*.js` are not type-checked.

## Conventions

- Production frontend is Danish-first. Default `Accept-Language` is `da-DK`; copy is bilingual via i18n in `app.js`.
- Money is half-krone–rounded; always use `formatCurrencyHalfKrone` / `formatPriceHalfKrone` / `roundToHalfKrone` from `utils/format.js` rather than ad-hoc rounding.
- HTML inserted into the DOM must go through `sanitizeHTML` from `sanitize.js`.
- Debug logging is gated on `window.DEBUG_LOGS === true`; outside that flag `console.log`/`warn` are no-ops. Use `devLog`/`devWarn` in `app.js`.
- Auth/session state is cookie-backed via `utils/tokenStorage.js` (`readLoginSessionCookie`, `writeLoginSessionCookie`, `clearLoginSessionCookie`, `hydrateFromCookie`).
- Dates sent to BRP use the user's *local* calendar date, not UTC — see `getTodayLocalDateString` in `app.js`.
