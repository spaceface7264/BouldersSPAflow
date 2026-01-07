# Cloudflare Deployment Cleanup Guide

## Nuværende Situation

Du har 5 deployment projekter:
1. ✅ **`bouldersspaflow`** (Pages) - Production (`join.boulders.dk`)
2. ✅ **`bouldersspaflow-preview`** (Pages) - Preview
3. ❌ **`boulders-spa-flow`** (Workers) - Kan slettes
4. ❌ **`bouldersspaflow`** (Workers) - Kan slettes
5. ❌ **`bouldersspa`** (Failed) - Kan slettes

## Oprydningsplan

### Step 1: Verificer Production

1. Gå til **`bouldersspaflow`** (Pages projekt)
2. Klik på projektet
3. Gå til **Settings** → **Domains & Routes**
4. Verificer at `join.boulders.dk` er tilknyttet dette projekt
5. ✅ **Behold dette projekt** - det er din production

### Step 2: Verificer Preview

1. Gå til **`bouldersspaflow-preview`** (Pages projekt)
2. Klik på projektet
3. Verificer at det virker: `bouldersspaflow-preview.pages.dev`
4. ✅ **Behold dette projekt** - det er din preview

### Step 3: Slet Unødvendige Workers

**Slet disse 3 projekter:**

#### A. Slet `boulders-spa-flow` (Workers)
1. Gå til projektet
2. Klik på **Settings** (øverst til højre)
3. Scroll ned til bunden
4. Klik **Delete project**
5. Bekræft sletning

#### B. Slet `bouldersspaflow` (Workers)
1. Gå til projektet
2. Klik på **Settings** (øverst til højre)
3. Scroll ned til bunden
4. Klik **Delete project**
5. Bekræft sletning

#### C. Slet `bouldersspa` (Failed)
1. Gå til projektet
2. Klik på **Settings** (øverst til højre)
3. Scroll ned til bunden
4. Klik **Delete project**
5. Bekræft sletning

## ⚠️ Preview Deployment Fejler

**`bouldersspaflow-preview`** viser "No deployment available" - dette skal fixes først!

### Fix Preview Deployment:

**PROBLEM FUNDET:** Build command har stavefejl: `npm run biuld` (skal være `build`)

**LØSNING:**

1. Gå til **`bouldersspaflow-preview`** projektet
2. Klik på **Settings** (øverst til højre)
3. Gå til **Builds & deployments** sektion
4. Find **Build command** feltet
5. **Ret stavefejlen:**
   - ❌ Forkert: `npm run biuld`
   - ✅ Korrekt: `npm run build`
6. Scroll ned og klik **Save**
7. Deployment starter automatisk efter gem

**Verificer også:**
- **Build output directory:** `dist`
- **Node.js version:** `22` (eller `20`)
- **Root directory:** `/` (eller tom)

**Efter rettelse:**
- Build skulle virke nu ✅
- Preview URL skulle være tilgængelig: `bouldersspaflow-preview.pages.dev`

**Option C: Check Build Logs**
- Se den fulde fejlbesked i build logs
- Fix eventuelle TypeScript eller dependency fejl

## Efter Oprydning

Du skulle have **2 projekter tilbage:**

1. ✅ **`bouldersspaflow`** (Pages) - Production
   - Domain: `join.boulders.dk` + `bouldersspaflow.pages.dev`
   - Purpose: Production deployment
   - Status: ✅ Virker

2. ⚠️ **`bouldersspaflow-preview`** (Pages) - Preview
   - Domain: `bouldersspaflow-preview.pages.dev`
   - Purpose: Preview deployments (automatisk ved nye commits)
   - Status: ⚠️ Fejler - skal fixes

## Verificer Efter Oprydning

1. ✅ Production virker: `https://join.boulders.dk`
2. ✅ Preview virker: `https://bouldersspaflow-preview.pages.dev`
3. ✅ `/api-proxy` virker på begge (Pages Functions)
4. ✅ Locations loade korrekt på begge

## Hvorfor Slette Workers?

- Workers har ikke Pages Functions → `/api-proxy` virker ikke
- Du bruger kun Pages til production og preview
- Workers er ikke nødvendige for dit use case

## Hvis Noget Går Galt

- Du kan altid oprette nye projekter
- Sletning er permanent, men deployment er hurtigt at genskabe
- Production (`join.boulders.dk`) er beskyttet - slet ikke det projekt!

