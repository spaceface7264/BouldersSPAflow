# Future work backlog

Tracked improvements that are **not** blocking day-to-day development. Pick items in separate PRs when capacity allows.

---

## Quality & regression safety

- **Playwright smoke (join flow)** — One E2E path: gym select → membership → order → payment-link return. Catches most regressions that manual QA keeps recording in `progress.txt`. Needs CI, secrets/mocks strategy, and flake budget.
- **`progress.txt` / QA notes** — When Playwright exists, align scenarios with the smoke test or trim duplication.

---

## Logging & observability

- **Stop patching global `console`** (`app.js` ~62–75) — Today `console.log` / `console.warn` are replaced when `DEBUG_LOGS` is off, which silences third-party scripts (Sentry dev `beforeSend`, Cookiebot, GTM). Keep `devLog` / `devWarn` for app code; **do not** assign to `window.console.*`.
- **Sentry `release` in `index.html`** — Inline init uses a **date-only** release string; same-day deploys collide. Wire to `VITE_SENTRY_RELEASE`, `GITHUB_SHA`, or similar via build-time HTML injection (e.g. Vite `transformIndexHtml`) or by moving init into bundled JS with `import.meta.env`.

---

## Tooling & deploy hygiene

- **Drop `npx` from npm scripts** — Use local bins (`vite`, `tsc`, `eslint`). Add **`wrangler` as a devDependency** if scripts should call `wrangler` without `npx`.
- **Collapse deploy entrypoints** — Today: `deploy.sh`, `npm run deploy`, `deploy:worker`, `deploy:cloudflare`, plus `wrangler.toml` / docs that disagree (Pages vs Workers). Pick **one** production path, delete or archive the rest, update `.github/workflows/deploy.yml` and deployment docs under `docs/deployment/`.

---

## Documentation layout

- **Move root-level docs into `docs/`** (relative links and any CI references may need updates):
  - `SENTRY_SETUP.md`
  - `SENTRY_VERIFY.md`
  - `SECURITY_IMPROVEMENTS_SUMMARY.md`
  - `SECURITY_TESTING_GUIDE.md`
  - `PRE_MERGE_TEST_CHECKLIST.md`
  - `test-xss.md` (and decide whether `test-xss.html` stays at root or moves with it)
  - `progress.txt` (or `docs/progress.txt` / `docs/qa/` — pick a convention)

---

## Security headers & Sentry loading

- **Sentry loading** — Either add **SRI** on the Sentry CDN script in `index.html`, or **prefer**: initialize via **`@sentry/browser`** from npm (already a dependency), remove the CDN tag, and ship Sentry in the Vite bundle. That supports tightening **CSP** (drop `browser.sentry-cdn.com` from `script-src`).
- **CSP: nonces / drop `'unsafe-inline'`** — Blocked by large inline bootstraps in `index.html` (e.g. ~lines 21–121: consent, Sentry, etc.). **Roughly a day** of work to split into nonced scripts or external files; biggest remaining CSP win after Sentry is bundled.

---

## Auth & threat modeling

- **Token storage note** — `utils/tokenStorage.js` keeps the Bearer token in a **JS-readable cookie** by design. After client-side HTML risks are under control, add a short **`docs/`** note: threat model, XSS impact, why not `HttpOnly` for this flow, and any mitigations (short TTL, HTTPS-only, scope of cookie). Reduces rediscovery every few months.

---

## Architecture (avoid monolith growth)

- **Slow decomposition — no big-bang `app.js` rewrite** — Prefer **new features in their own modules** under `utils/` or a new `modules/` (or `features/` as vanilla ES modules), imported from `app.js` / `profile-main.js`. Keeps diffs reviewable and boundaries explicit over time.

---

## How to use this file

When starting work, **copy one bullet into a PR description** or a linked issue, then remove or strike the bullet here once shipped (or move to a “Done” section at the bottom).
