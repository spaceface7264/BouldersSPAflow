# Bekræftelse: Domæner Peger På Samme Side

## ✅ Bekræftelse

**Ja, `bouldersspaflow.pages.dev` og `join.boulders.dk` er samme side.**

Begge domæner peger på samme Cloudflare Pages deployment i projektet `bouldersspaflow`.

## Hvordan Det Virker

### Cloudflare Pages Domain Setup

Når du tilføjer et custom domain til et Cloudflare Pages projekt:

1. **Standard domain:** `bouldersspaflow.pages.dev` (automatisk)
2. **Custom domain:** `join.boulders.dk` (tilføjet manuelt)

Begge domæner peger på **samme deployment** og viser **samme indhold**.

### Teknisk Forklaring

```
bouldersspaflow.pages.dev  ──┐
                             ├──→ Samme deployment
join.boulders.dk          ───┘     (samme kode, samme build)
```

## Verificering

### Sådan Tjekker Du Det:

1. **Åbn begge URLs i browseren:**
   - `https://bouldersspaflow.pages.dev`
   - `https://join.boulders.dk`

2. **Tjek at de viser samme indhold:**
   - ✅ Samme side
   - ✅ Samme funktionalitet
   - ✅ Samme API calls
   - ✅ Samme `/api-proxy` endpoint

3. **Tjek i Cloudflare Dashboard:**
   - Gå til **`bouldersspaflow`** projektet
   - **Settings** → **Custom domains**
   - Du skulle se begge domæner listet:
     - `bouldersspaflow.pages.dev` (standard)
     - `join.boulders.dk` (custom)

## Hvorfor To Domæner?

### `bouldersspaflow.pages.dev` (Standard)
- ✅ Automatisk oprettet af Cloudflare
- ✅ Altid tilgængelig
- ✅ Brug til testing/debugging
- ✅ Backup hvis custom domain fejler

### `join.boulders.dk` (Custom)
- ✅ Dit brandede domæne
- ✅ Brug til production (kunder)
- ✅ SEO og branding
- ✅ Professionelt udseende

## Vigtigt At Vide

### ✅ Begge Domæner:
- Viser samme indhold
- Bruger samme deployment
- Opdateres samtidig
- Har samme `/api-proxy` endpoint

### ⚠️ Forskelle:
- Kun domænenavnet er forskelligt
- Alt andet er identisk

## Eksempel

Hvis du deployer en ny version:

```
1. Deploy til production
   ↓
2. Både domæner opdateres:
   → bouldersspaflow.pages.dev ✅
   → join.boulders.dk ✅
   ↓
3. Begge viser samme nye version
```

## Konklusion

**Ja, de er samme side!**

- `bouldersspaflow.pages.dev` = Standard Cloudflare Pages domain
- `join.boulders.dk` = Custom domain (dit brandede domæne)
- Begge peger på samme deployment
- Begge viser samme indhold

## Test Det Selv

1. Åbn `https://bouldersspaflow.pages.dev` i én browser tab
2. Åbn `https://join.boulders.dk` i en anden tab
3. De skulle vise præcis samme side ✅

