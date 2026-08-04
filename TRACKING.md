# Tracking — current state and handover

**Last updated:** 2026-08-04

Living status of ad-platform tracking for `join.boulders.dk`. Read this before touching tracking
code, CSP, or the GTM container. `docs/status/TRACKING_STATUS_REPORT.md` is a January 2026 snapshot
and is stale in places (it claims GTM loads only after consent — it now loads unconditionally
behind Consent Mode v2).

---

## What is live

| Platform | Status |
|---|---|
| GA4 | Firing via GTM (`select_item`, `add_to_cart`, `begin_checkout`, `purchase`, `purchase_99kr`, …) |
| Meta / Facebook Pixel | Firing, with match-quality fields added 2026-07 |
| TikTok Pixel | Firing (CSP unblocked in PR #127) |
| Google Ads — `99 kr.` day ticket | **Live since 2026-08-04**, verified end to end |
| Google Ads — other conversions | Firing, but enhanced conversions send empty data (see Open items) |

---

## Google Ads "99 kr." conversion

Requested by s360 (Thit Bøjesen, `tbj@s360digital.com`) as the Google Ads counterpart to the Meta
event for the 99 kr campaign. Full setup guide: `docs/GOOGLE_ADS_99KR_CONVERSION_SETUP.md`.

| | |
|---|---|
| Conversion ID | `805899643` |
| Conversion label | `1NImCKjKltscEPuapIAD` |
| Data Layer event | `purchase_99kr` |
| GTM container | `GTM-KHB92N9P` (`boulders.dk`) |

**The label mixes lookalike characters.** Verified against codepoints: char 1 is digit `1`, chars 3
and 18 are capital `I`, char 9 is lowercase `l`. Never retype it.

### Objects created in GTM (published 2026-08-04)

Five additions, zero modifications to existing objects:

- `DLV - phone_e164` → data layer key `phone_e164`
- `DLV - country` → `country`
- `DLV - st` → `st`
- `UPD - Purchase` — User-Provided Data variable, manual config, mapped to the current keys
- `GAds - 99 kr day ticket` — Google Ads Conversion Tracking tag

Reused rather than recreated: `--GAds - Conversion ID` (= `805899643`), `--dlv - ecommerce.value`,
`--dlv - ecommerce.currency`, `--dlv - ecommerce.transaction_id`, `DLV - email`, `DLV - fn`,
`DLV - ln`, `DLV - zip`, `DLV - ct`, and the existing trigger `ce - purchase_99kr`.

Enhanced conversions attach via an **event parameter** `user_data` = `{{UPD - Purchase}}`, matching
the convention of the agency's other `GAds -` tags — not via the "Include user-provided data"
checkbox.

### Verified

Tag Assistant on a real order (`1140107`) via the preview deployment: tag fired once, firing status
Succeeded, `Conversion Value 99`, `Currency DKK`, correct label, `user_data` carrying real email and
name. Production confirmed after deploy:

```
conversion_async.js             : loaded
window.google_trackConversion   : true
CSP refusals                    : 0
```

---

## Data Layer contract

`resolvePurchaseTrackingMetadata()` in `app.js` publishes these top-level keys on `purchase` and
`purchase_99kr`. Keys are omitted entirely when the value is unavailable — never guessed.

| Key | Format | Consumer |
|---|---|---|
| `email` | lowercased | Meta + Google |
| `phone` | digits only, no `+` | **Meta only** |
| `phone_e164` | `+45…` | **Google only** — Google discards non-E.164 |
| `fn`, `ln` | trimmed | Meta + Google |
| `zip`, `ct`, `st` | trimmed | Meta + Google |
| `country` | ISO-3166-1 alpha-2, lowercased | Meta + Google |
| `dob` | `YYYYMMDD` | Meta |
| `external_id`, `event_id` | | Meta / dedupe |

Ecommerce data sits under `ecommerce` (`value`, `currency`, `transaction_id`, `items`). Gym name is
on the item as `item_category2`, not top-level.

BRP shape gotchas, handled in `app.js`: `mobilePhone.countryCode` is an **integer** (`45`), and
address `country` is a **`CountryOutRef` object** (`{ id, alpha2, name }`), not a string.

`/99kr` orders typically carry only email and name — that flow does not collect phone or address, so
empty user-data fields there are expected, not a bug.

---

## Deployment topology

Three copies of this app are published. They are not equivalent.

| URL | Source | Headers |
|---|---|---|
| `join.boulders.dk` / `bouldersspaflow.pages.dev` | Cloudflare Pages project `bouldersspaflow`, production branch `main` | `_headers` applied |
| `main.bouldersspaflow-preview.pages.dev` | Cloudflare Pages project `bouldersspaflow-preview` | `_headers` applied |
| `spaceface7264.github.io/BouldersSPAflow` | `.github/workflows/deploy.yml` on every push to `main` | **none — no CSP, no HSTS** |

`_headers` is a Cloudflare Pages feature. The GitHub Pages copy ignores it and publishes the full
signup and checkout flow with no security headers. Retiring that workflow is an open decision.

`npm run deploy` in `package.json` is **stale** — it targets `--project-name=boulders-membership-flow`,
which no longer resolves, and deploys the repo root rather than `./dist`. Do not rely on it.

### Verify a deploy

```bash
curl -sI https://join.boulders.dk/99kr | tr ';' '\n' | grep 'script-src' | grep -o googleadservices
```

Grep `script-src` specifically. `connect-src` has always allowed `*.googleadservices.com`, so
matching the whole header gives a false pass.

---

## CSP notes

`_headers` is the single source of the production policy. Vendor domains must be added there or the
browser blocks the tag **before any request leaves** — GTM and the ad platform both report success,
so the failure is silent. This has bitten twice: TikTok (PR #127) and Google Ads (PR #128).

Google Ads needs, per [Google's CSP reference](https://developers.google.com/tag-platform/security/guides/csp):
`www.googleadservices.com`, `www.google.com`, `pagead2.googlesyndication.com` and
`tagmanager.google.com` in `script-src`; `google.com` / `www.google.dk` in `connect-src`;
`tagmanager.google.com` in `style-src` (needed for GTM Preview to work on the live site).

---

## Open items

**Ours:**

- GitHub Pages publishes a headerless copy of the checkout flow on every merge to `main`. Decide
  whether to retire `.github/workflows/deploy.yml`.
- GTM reports *Container quality: Urgent — 3 issues*. Never opened.
- `npm run deploy` points at a dead project name.
- Draft email to Thit at s360 covering the three findings below is **written but not sent** — Rami is
  holding it until other fixes land.

**s360's (do not change these without them):**

- `-- User-Provided Data` maps `--dlv - customer.email` and `--dlv - customer.address.*`, keys this
  site has not published for a long time, so it resolves to empty. Nine tags use it — all four
  `GAds -` conversions, four `GA4 - Event -` purchases, and `GAds User-provided Data Event` — meaning
  enhanced conversions send nothing. Matches the *"Enhanced conversions has setup issues"* diagnostic
  in the Ads account. `UPD - Purchase` is mapped correctly and can be reused.
- The 99 kr day ticket is a value-card product in BRP, so the trigger `purchase - category value-card`
  also matches it. Every 99 kr order records as both `99 kr.` and `Value Card Purchase`, double
  counting in campaign optimisation.
- Google Ads conversion tracking was blocked by CSP on production until 2026-08-04, so historical
  conversion data has gaps across all `GAds -` tags.

---

## Gotchas for whoever picks this up

- **Never edit a GTM trigger from inside a tag.** Triggers are shared objects; editing one changes
  every tag using it. To change a tag's trigger, use the pencil icon on the Triggering card and pick
  a different trigger from the list.
- **Test on the preview deployment, not production**, when the change is not yet deployed.
  GTM Preview needs `tagmanager.google.com` allowed in CSP, which only deployed builds have.
- **A test purchase is a real 99 kr charge**, and the flow blocks emails that already used the offer.
  Refund in BRP afterwards.
- Before publishing a GTM container, check the workspace change count matches what you intended.
  Added vs Modified matters: modifying a shared object affects live tags.

## Related PRs

- [#127](https://github.com/spaceface7264/BouldersSPAflow/pull/127) — TikTok domains in CSP
- [#128](https://github.com/spaceface7264/BouldersSPAflow/pull/128) — Google Ads CSP + `phone_e164` / `country` + setup doc
- [#129](https://github.com/spaceface7264/BouldersSPAflow/pull/129) — country selector name-first
- [#130](https://github.com/spaceface7264/BouldersSPAflow/pull/130) — conversion label correction
