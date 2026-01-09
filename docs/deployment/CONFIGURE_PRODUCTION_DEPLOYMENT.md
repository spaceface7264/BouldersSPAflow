# Konfigurer Production Deployment (Kun Manuel)

## Problem

Hvis production opdateres automatisk sammen med preview, giver preview ikke mening. Production skal kun opdateres manuelt efter test på preview.

## Løsning: Deaktiver Automatisk Production Deployment

### Step 1: Tjek Nuværende Konfiguration

1. Gå til Cloudflare Dashboard
2. **Workers & Pages** → **`bouldersspaflow`** (Production)
3. Gå til **Settings** → **Builds & deployments**
4. Tjek **Branch control** sektionen

### Step 2: Konfigurer Branch Control

**For Production (`bouldersspaflow`):**

1. Gå til **Settings** → **Builds & deployments**
2. Find **Branch control** sektionen
3. **Production branch:** `main` (behold dette)
4. **Builds for non-production branches:** 
   - ✅ **Enabled** (for preview branches)
   - Eller: **Disabled** (hvis du kun vil deploye fra main)

**Vigtigt:** Production deployment skal være **manuel**, ikke automatisk.

### Step 3: Verificer Preview Konfiguration

**For Preview (`bouldersspaflow-preview`):**

1. Gå til **Settings** → **Builds & deployments**
2. **Production branch:** `main`
3. **Builds for non-production branches:** 
   - ✅ **Enabled** (automatisk preview for alle branches)

### Step 4: Test Konfigurationen

**Test Workflow:**

```
1. Push til main branch
   → Preview opdateres automatisk ✅
   → Production opdateres IKKE automatisk ✅

2. Test på preview
   → bouldersspaflow-preview.pages.dev

3. Hvis alt virker:
   → Deploy manuelt til production
   → join.boulders.dk
```

## Hvordan Deaktiverer Du Automatisk Production Deployment?

### Option A: Via Cloudflare Dashboard

1. Gå til **`bouldersspaflow`** (Production)
2. **Settings** → **Builds & deployments**
3. Find **"Automatic deployments"** toggle
4. **Deaktiver** automatisk deployment
5. Gem indstillinger

### Option B: Via Build Settings

Hvis der ikke er en toggle:

1. Gå til **Settings** → **Builds & deployments**
2. **Deploy command:** 
   - Sæt til: `true` (gør ingenting)
   - Eller: Fjern deploy command helt
3. Dette sikrer at production kun deployes manuelt

## Verificer Konfiguration

### ✅ Korrekt Konfiguration:

**Preview (`bouldersspaflow-preview`):**
- ✅ Opdateres automatisk ved push til `main`
- ✅ Giver dig mulighed for at teste før production

**Production (`bouldersspaflow`):**
- ❌ Opdateres IKKE automatisk
- ✅ Deployes kun manuelt efter test på preview

### ❌ Forkert Konfiguration:

**Hvis begge opdateres automatisk:**
- ❌ Preview giver ikke mening
- ❌ Ingen mulighed for at teste før production
- ❌ Risiko for at deploye fejl til production

## Workflow Efter Konfiguration

### Korrekt Workflow:

```
1. [Lokal] Lav ændringer
2. [GitHub] Push til main
3. [Automatisk] Preview opdateres (4 min)
4. [Dig] Test på preview
5. [Dig] Hvis fejl → Fix → Push → Preview opdateres
6. [Dig] Når alt virker → Deploy manuelt til production
7. [Manuel] Production opdateres
```

### Forkert Workflow (Hvis begge er automatiske):

```
1. [Lokal] Lav ændringer
2. [GitHub] Push til main
3. [Automatisk] Preview opdateres (4 min)
4. [Automatisk] Production opdateres også (4 min) ❌
5. [Dig] Ingen mulighed for at teste før production ❌
```

## Tjek Din Nuværende Konfiguration

**Spørg dig selv:**
- Opdateres production automatisk når du pusher til main?
- Hvis ja → Deaktiver automatisk production deployment
- Hvis nej → Perfekt! Du er allerede konfigureret korrekt

## Næste Steps

1. ✅ Tjek om production opdateres automatisk
2. ✅ Hvis ja → Deaktiver automatisk production deployment
3. ✅ Test workflow: Push → Preview opdateres → Test → Deploy manuelt til production
4. ✅ Verificer at production kun opdateres manuelt

