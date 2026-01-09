# Cloudflare Pages Setup Guide

## Opret Pages Deployment til Preview

### Step 1: Opret Pages Project i Cloudflare Dashboard

1. Gå til [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Vælg dit account
3. Gå til **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**

### Step 2: Vælg Repository

1. Vælg dit GitHub repository (`spaceface7264/BouldersSPAflow`)
2. Klik **Begin setup**

### Step 3: Configure Build Settings

**Project name:**
```
boulders-membership-flow-preview
```
(eller et andet navn du foretrækker)

**Production branch:**
```
main
```

**Build command:**
```
npm run build
```

**Build output directory:**
```
dist
```

**Root directory:**
```
/
```
(eller lad den være tom)

**Node.js version:**
```
22
```
(eller den version du bruger)

### Step 4: Environment Variables (hvis nødvendigt)

Hvis du har environment variables, tilføj dem under **Environment variables**:
- `NODE_VERSION` = `22` (hvis nødvendigt)

### Step 5: Deploy

1. Klik **Save and Deploy**
2. Vent på første deployment
3. Du får en preview URL: `https://boulders-membership-flow-preview-*.pages.dev`

### Step 6: Test Preview URL

1. Åbn preview URL'en i browseren
2. Tjek console for API calls
3. `/api-proxy` endpoint skulle virke nu ✅
4. Locations skulle loade korrekt ✅

## Hvad virker nu?

✅ **Pages Function** (`/api-proxy`) virker automatisk
✅ **API calls** går gennem proxy (ingen CORS problemer)
✅ **Preview URL** opdateres automatisk ved nye commits
✅ **Production** (`join.boulders.dk`) bruger samme setup

## Troubleshooting

### Build fejler

**Hvis build fejler med "error occurred while running build command":**

1. **Tjek Node version:**
   - Cloudflare Pages understøtter Node 18, 20, 22
   - I build settings, sæt **Node.js version** til `22` (eller `20`)

2. **Tjek build command:**
   - Skal være: `npm run build`
   - Ikke: `npm run build && ...` (kun build command)

3. **Tjek build output directory:**
   - Skal være: `dist`
   - Ikke: `./dist` eller `/dist`

4. **Tjek om dependencies mangler:**
   - Cloudflare Pages installerer automatisk via `npm install`
   - Hvis fejl, tjek at `package.json` er korrekt

5. **Tjek TypeScript fejl:**
   - Kør `npm run build` lokalt først
   - Fix eventuelle TypeScript fejl før deployment

**Hvis `/api-proxy` ikke virker:**
- Tjek at `functions/api-proxy/index.ts` er deployet
- Tjek build logs for fejl
- Verificer at `dist/functions/api-proxy/index.ts` eksisterer efter build

**Hvis API calls fejler:**
- Tjek console for CORS errors
- Verificer at `useProxy` er `true` på Pages domain
- Tjek at `baseUrl` er `/api-proxy` på Pages domain

