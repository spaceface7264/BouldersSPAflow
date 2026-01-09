# Ét Projekt vs To Projekter

## Nuværende Setup: To Projekter

### `bouldersspaflow` (Production)
- Domain: `join.boulders.dk`
- Deployment: Manuel (efter test på preview)

### `bouldersspaflow-preview` (Preview)
- Domain: `bouldersspaflow-preview.pages.dev`
- Deployment: Automatisk (ved push til main)

## Kan Du Bruge Ét Projekt?

**Ja, men med begrænsninger:**

### Option A: Ét Projekt (`bouldersspaflow`)

**Fordele:**
- ✅ Enklere at administrere
- ✅ Færre projekter i dashboard
- ✅ Production + Preview environments i samme projekt

**Ulemper:**
- ⚠️ Preview environments oprettes automatisk for hver commit
- ⚠️ Preview URL'er ændrer sig for hver deployment (fx `abc123.bouldersspaflow.pages.dev`)
- ⚠️ Svært at have en fast preview URL til testing
- ⚠️ Production kan være automatisk ELLER manuel, men ikke begge

**Hvordan det virker:**
```
1. Push til main
2. Cloudflare opretter automatisk preview deployment
3. Preview URL: abc123.bouldersspaflow.pages.dev (unik for hver commit)
4. Production opdateres automatisk ELLER manuelt (ikke begge)
```

### Option B: To Projekter (Nuværende Setup)

**Fordele:**
- ✅ Fast preview URL: `bouldersspaflow-preview.pages.dev`
- ✅ Preview opdateres automatisk
- ✅ Production er manuel (efter test)
- ✅ Klar separation mellem test og production
- ✅ Nemt at teste på samme URL hver gang

**Ulemper:**
- ⚠️ To projekter at administrere
- ⚠️ Lidt mere komplekst setup

**Hvordan det virker:**
```
1. Push til main
2. Preview projekt opdateres automatisk → bouldersspaflow-preview.pages.dev
3. Test på preview
4. Deploy manuelt til production → join.boulders.dk
```

## Anbefaling

### ✅ Behold To Projekter (Nuværende Setup)

**Hvorfor:**
- ✅ Fast preview URL gør testing nemmere
- ✅ Klar separation mellem test og production
- ✅ Du kan teste på samme URL hver gang
- ✅ Production er beskyttet mod automatisk deployment

**Workflow:**
```
1. Push til main
2. Preview opdateres automatisk → bouldersspaflow-preview.pages.dev
3. Test på preview (samme URL hver gang)
4. Deploy manuelt til production → join.boulders.dk
```

### ❌ Ét Projekt (Ikke Anbefalet)

**Hvorfor ikke:**
- ❌ Preview URL ændrer sig for hver commit
- ❌ Svært at have en fast URL til testing
- ❌ Enten automatisk ELLER manuel production (ikke begge)

## Hvis Du Vil Forenkle Til Ét Projekt

### Step 1: Slet Preview Projekt

1. Gå til `bouldersspaflow-preview`
2. **Settings** → Scroll ned → **Delete project**

### Step 2: Konfigurer Production Projekt

1. Gå til `bouldersspaflow`
2. **Settings** → **Builds & deployments**
3. **Builds for non-production branches:** Enabled
4. Dette opretter automatisk preview deployments for hver commit

### Step 3: Brug Preview Deployments

- Hver commit får sin egen preview URL
- Fx: `abc123.bouldersspaflow.pages.dev`
- URL'en findes i **Deployments** tab

**Ulempe:** Du skal finde den nye preview URL for hver commit.

## Konklusion

### ✅ Anbefalet: Behold To Projekter

**Fordele:**
- Fast preview URL til testing
- Klar separation mellem test og production
- Production er beskyttet mod automatisk deployment
- Nemmere workflow

**Nuværende setup er optimal!**

### ❌ Alternativ: Ét Projekt

**Kun hvis:**
- Du ikke har brug for fast preview URL
- Du er okay med at finde ny preview URL for hver commit
- Du vil have færre projekter i dashboard

## Mit Råd

**Behold de to projekter!** 

Din nuværende setup giver dig:
- ✅ Fast preview URL til testing
- ✅ Automatisk preview deployment
- ✅ Manuel production deployment (efter test)
- ✅ Klar separation mellem test og production

Dette er den bedste praksis for dit use case.

