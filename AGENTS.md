# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Boulders Membership Flow (`join.boulders.dk`) — a React 18 + TypeScript SPA for climbing gym membership signup. Built with Vite, Tailwind CSS, Zustand, React Hook Form + Zod, and React Router v6. No local backend or database; all data comes from external BRP API3 (`boulders.brpsystems.com`) and `api-join.boulders.dk`, proxied by Vite in dev mode.

### Running the dev server

```
npm run dev          # starts Vite on port 5173
```

The Vite dev server proxies `/api/ver3` to `boulders.brpsystems.com` and `/api` to `api-join.boulders.dk`, so no local backend setup is needed. See `vite.config.ts` proxy section for details.

### Environment variables

Copy `env.example` to `.env`. The key variable is `VITE_API_AUTH_TOKEN` (needed for BRP API authentication). The app runs and renders the signup flow without it, but API-dependent features (order creation, payments) will fail without a valid token.

### Build & type check

```
npm run build        # runs tsc + vite build → outputs to dist/
npx tsc --noEmit     # type check only
```

### Lint (known issue)

`npm run lint` currently fails due to a pre-existing config bug in `.eslintrc.cjs`: it extends `@typescript-eslint/recommended` instead of the correct `plugin:@typescript-eslint/recommended`. The ESLint config also references `eslint-plugin-import` and `eslint-import-resolver-typescript` which are not listed in `package.json`. TypeScript type checking (`npx tsc --noEmit`) is the reliable way to check for errors.

### No automated tests

The repository has no test framework or test files configured. Validation is done via TypeScript type checking and manual testing.

### Deployment

Production deployment targets Cloudflare Pages. See `docs/deployment/` for guides. Not needed for local development.
