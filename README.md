# Boulders Membership Flow (Frontend Hand-off)

This repository contains the complete single-page purchase flow for Boulders memberships. It is delivered as a static HTML/CSS/JavaScript experience that is ready for a backend team to wire up to real APIs.

The visuals, step logic, validation, and payload construction are finished. All network activity is stubbed, with clear hooks for attaching live services.

## Tech Stack

- Static HTML entry (`index.html`) plus a single orchestrating script (`app.js`)
- CSS authored in `styles.css` with utility-inspired structure (no Tailwind runtime)
- Vite + TypeScript scaffold remains in `src/` for future migration, but the production build currently ships the static bundle
- Tooling: ESLint, TypeScript, Vite dev server (see `package.json`)

## Project Layout

```
API Prod2/
├── index.html    # Markup, templates, data-* bindings
├── styles.css           # Complete design system and component styles
├── app.js               # Catalog rendering, wizard state, payload builder
├── INTEGRATION.md       # Backend integration guide & endpoint map
├── README.md            # (this file)
├── package.json         # Scripts/tooling if you prefer running through Vite
└── src/…                # Starter React/Vite scaffold (unused by default build)
```

## Frontend Capabilities

- Multi-step wizard (membership → add-ons → account → payment → confirmation)
- Dynamic template cloning for plans, value cards, and add-ons
- Form validation (required fields, guardian toggle, same-address helper)
- Checkout payload assembly via `buildCheckoutPayload()`
- Confirmation view with placeholder order details
- Accessibility touches: `aria-live` regions, keyboard-friendly controls

## Integration Summary

All data, prices, and responses are mocked locally. Replace them with real services following the guide in **INTEGRATION.md**. Highlights:

| Area | What Exists | Backend Task |
| --- | --- | --- |
| Catalog | Static arrays (`MEMBERSHIP_PLANS`, `VALUE_CARDS`, `ADDONS`) | Swap for `fetch` calls and hydrate templates |
| Checkout | `handleCheckout()` logs payload and advances to confirmation | Call your checkout API, handle success/error states |
| Payments | Card fields are formatted only | Connect to PSP / payment intent endpoint |
| Confirmation | `buildOrderSummary()` uses placeholders | Populate with backend response data |
| Referral | Hard-coded code/text | Inject real referral URL before rendering |

Backend engineers can rely on the data attributes (`data-api-field`, `data-component`, `data-summary-field`, `data-action`) already present in the DOM. No markup changes are required to attach listeners or hydrate fields.

## Local Development

```bash
npm install
npm run dev    # Serves index.html and assets through Vite
npm run build  # Optional: produces a static bundle in dist/
```

No build step is required to inspect the hand-off: opening `index.html` in a browser works because the assets are plain HTML/CSS/JS. The Vite toolchain is useful if you want hot reloads or TypeScript support while iterating.

## What Remains for Backend

- Connect membership/value-card/add-on endpoints and remove the seed data
- Implement checkout submission, success, and failure flows
- Integrate payment provider logic (card tokenisation, Apple Pay, etc.)
- Replace placeholder confirmation data with real values
- Localise copy using the `data-i18n-key` attributes if required

Refer to **INTEGRATION.md** for endpoint suggestions, payload examples, and DOM binding notes. Frontend and backend teams should coordinate before altering markup so selectors stay stable.

## Support

Please reach out to the frontend owner if you plan to restructure templates or introduce additional state so we can keep the hand-off aligned with the integration plan.
