# Sådan Deployer Du Til Preview og Production

## Vigtigt: Jeg Kan Ikke Deploye For Dig

Jeg kan **ikke** pushe til GitHub eller deploye til Cloudflare. Det skal du gøre selv.

## Hvad Sker Automatisk?

### Preview Deployment
- ✅ **Opdateres automatisk** når du pusher til `main` branch på GitHub
- ✅ Ingen ekstra handling nødvendig
- ✅ Tager ca. 4 minutter efter push

### Production Deployment
- ⚠️ **Opdateres IKKE automatisk** - skal deployes manuelt efter test på preview
- ✅ Deployes manuelt via Cloudflare Dashboard når preview er testet og godkendt

## Sådan Deployer Du

### Option 1: Automatisk Deployment (Anbefalet)

**Til Preview (automatisk):**

```bash
# 1. Commit dine ændringer
git add .
git commit -m "Beskrivelse af ændringer"

# 2. Push til GitHub
git push origin main

# 3. Vent 4 minutter
# → Preview opdateres automatisk
# → Production opdateres IKKE automatisk
```

**Hvad sker der:**
- GitHub modtager din push
- Cloudflare Pages detekterer ændringen
- Build starter automatisk
- ✅ Preview deployment opdateres
- ❌ Production deployment opdateres IKKE (kun manuelt)

### Option 2: Manuelt Deployment til Production (Efter Test på Preview)

**Til Production (kun efter test på preview):**

1. Test først på preview: `bouldersspaflow-preview.pages.dev`
2. Verificer at alt virker korrekt
3. Gå til Cloudflare Dashboard
4. **Workers & Pages** → **`bouldersspaflow`** (Production)
5. Gå til **Deployments** tab
6. Find den deployment du vil deploye (samme commit som preview)
7. Klik på **"..."** (tre prikker) ved siden af deployment
8. Vælg **"Promote to production"** eller **"Deploy"**
9. Bekræft deployment

**Eller:**
- Klik **"New deployment"**
- Vælg branch/commit (samme som preview)
- Klik **Deploy**

## Hvad Kan Du Sige Til Mig?

### Hvis Du Vil Committe og Pushe:

**Sag mig:**
- `"commit og push"` eller
- `"commit changes"` eller
- `"push til GitHub"`

**Så hjælper jeg dig med:**
- ✅ At committe dine ændringer
- ✅ At pushe til GitHub
- ✅ Preview opdateres automatisk efter push

**Eksempel:**
```
Dig: "commit og push"
Mig: Jeg committer dine ændringer og pusher til GitHub
     → Preview opdateres automatisk om 4 minutter
```

### Hvis Du Vil Deploye Manuelt Til Production:

**⚠️ VIGTIGT: Test først på preview!**

**Sag mig:**
- `"deploy til production"` eller
- `"deploy manuelt"` eller
- `"promote til production"`

**Så hjælper jeg dig med:**
- ✅ At guide dig gennem Cloudflare Dashboard
- ✅ At forklare hvordan du deployer manuelt
- ✅ At finde den rigtige deployment (samme commit som preview)

**Eksempel:**
```
Dig: "deploy til production"
Mig: ✅ Har du testet på preview først?
     ✅ Jeg guider dig gennem Cloudflare Dashboard
     → Du deployer manuelt til production
```

## Typisk Workflow

### Scenario: Du Har Lavet Ændringer

```
1. [Dig] "commit og push"
   → Jeg committer og pusher til GitHub

2. [Automatisk] Preview opdateres om 4 minutter
   → bouldersspaflow-preview.pages.dev
   → Production opdateres IKKE automatisk

3. [Dig] Test på preview
   → Tjek at alt virker
   → Tjek API calls
   → Tjek UI

4. [Dig] Hvis noget fejler på preview:
   → Fix lokalt
   → "commit og push" igen
   → Preview opdateres automatisk
   → Test igen

5. [Dig] Når alt virker på preview:
   → "deploy til production"
   → Jeg guider dig gennem manuel deployment

6. [Manuel] Production opdateres
   → join.boulders.dk
```

## Hvad Sker Når Du Pusher?

### Automatisk Process (Preview):

```
1. git push origin main
   ↓
2. GitHub modtager push
   ↓
3. Cloudflare Pages detekterer ændring
   ↓
4. Build starter automatisk
   ↓
5. ✅ Preview deployment opdateres (4 min)
   ↓
6. ❌ Production deployment opdateres IKKE automatisk
```

### Manuel Process (Production):

```
1. Test på preview → Alt virker ✅
   ↓
2. Gå til Cloudflare Dashboard
   ↓
3. Vælg production projekt
   ↓
4. Vælg deployment (samme commit som preview)
   ↓
5. Klik "Promote to production"
   ↓
6. ✅ Production opdateres
```

## Eksempler På Hvad Du Kan Sige

### Committe og Pushe:
- ✅ `"commit og push"`
- ✅ `"commit changes"`
- ✅ `"push til GitHub"`
- ✅ `"gem og push"`

### Deploye Manuelt:
- ✅ `"deploy til production"`
- ✅ `"deploy manuelt"`
- ✅ `"retry production build"`

### Teste:
- ✅ `"test preview"`
- ✅ `"tjek preview"`

## Vigtige Noter

### ⚠️ Jeg Kan Ikke:
- ❌ Pushe til GitHub direkte (jeg kan guide dig)
- ❌ Deploye til Cloudflare direkte (jeg kan guide dig)
- ❌ Vente på deployment (det sker automatisk)

### ✅ Jeg Kan:
- ✅ Committe dine ændringer lokalt
- ✅ Pushe til GitHub (hvis du har git sat op)
- ✅ Guide dig gennem Cloudflare Dashboard
- ✅ Forklare deployment processen

## Quick Reference

| Handling | Hvad Du Siger | Hvad Der Sker |
|----------|---------------|---------------|
| **Commit & Push** | `"commit og push"` | Jeg committer og pusher → Preview opdateres automatisk |
| **Deploy Production** | `"deploy til production"` | Jeg guider dig gennem Cloudflare Dashboard |
| **Test Preview** | `"test preview"` | Jeg hjælper dig med at teste på preview URL |

## Næste Gang

**Når du har lavet ændringer:**

1. Sig: `"commit og push"`
2. Vent 4 minutter
3. Test på preview: `bouldersspaflow-preview.pages.dev`
4. Hvis alt virker → Production opdateres automatisk
5. Eller sig: `"deploy til production"` for manuel deployment

