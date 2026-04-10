# Boulders Membership Flow

Production membership signup and member **profile** experiences for Boulders climbing gyms, with BRP API3 integration, payments, and Cloudflare deployment.

## What ships today

The site is **not** a React SPA. User-facing code is **vanilla JavaScript** bundled with **Vite**:

| Entry | Role |
|--------|------|
| `index.html` + `app.js` | Multi-step **join / signup** flow (gym pick, access type, checkout, confirmation). |
| `profile.html` + `profile-main.js` | Authenticated **profile** (dashboard, classes, activity, gyms, settings). Imports `profile/initialize-login-page.js` and shared `app.js` for API/auth. |

TypeScript appears only under **`functions/`** (Cloudflare Pages/Workers API proxy). There is **no** parallel React app in this repo.

## Features (join flow)

- Multi-step signup with validation and step navigation  
- Gym selection with search, distance when geolocation is allowed  
- Membership and punch card selection with pricing  
- Discount codes with live price updates  
- Cart and checkout; BRP payment link generation  
- Order confirmation  
- Danish/English strings where implemented  
- Responsive layout and accessibility-oriented patterns in places  

## Tech stack

- **Build**: Vite 6 (`vite.config.ts`) — multi-page build: `index.html`, `profile.html`, `profile-main.js`  
- **UI code**: ES modules, DOM APIs, large shared `styles.css` / `profile-layout.css`  
- **Maps (profile)**: Leaflet  
- **HTML hygiene (profile)**: DOMPurify for markup assigned under `profile/` (see `setProfileHtml` in `profile/initialize-login-page.js`)  
- **Edge**: Cloudflare Pages + `functions/api-proxy` for CORS-safe API access  
- **Monitoring**: Sentry (browser + optional Vite source map upload when `SENTRY_AUTH_TOKEN` is set)  

PostCSS/Tailwind are present for the toolchain; primary styling is custom CSS, not utility-first Tailwind pages.

## Repository layout

```
├── index.html              # Join flow document
├── profile.html            # Profile app document
├── app.js                  # Join flow + shared API/auth used by profile
├── profile-main.js         # Vite entry: profile page bootstrap
├── profile/                # Profile-only modules (e.g. initialize-login-page.js)
├── styles.css, profile-layout.css
├── utils/, api-utils.js, …
├── vite.config.ts
├── functions/api-proxy/    # TypeScript worker / Pages function
├── docs/                   # OpenAPI, deployment, implementation notes
└── README.md
```

## Getting started

**Prerequisites:** Node.js 18+, npm.

```bash
npm install
npm run dev          # http://localhost:5173 — Vite dev server + API proxies
npm run build        # tsc (functions) + vite build → dist/
npm run preview      # preview production build
npm run lint         # ESLint on functions/**/*.ts
```

**Deploy (examples):**

```bash
npm run deploy           # Cloudflare Pages (see script)
npm run deploy:cloudflare
```

More detail: `docs/deployment/`.

## API integration

- OpenAPI reference: `docs/brp-api3-openapi.yaml`  
- Typical BRP base: `https://boulders.brpsystems.com/apiserver/api/ver3`  
- Join API and proxies are described under `docs/implementation/`  

## License / scope

This project is part of the Boulders membership system.
