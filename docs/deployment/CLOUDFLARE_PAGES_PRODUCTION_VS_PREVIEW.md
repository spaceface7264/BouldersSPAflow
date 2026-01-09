# Cloudflare Pages: Production vs Preview

## Dine 2 Deployments

### 1. **`bouldersspaflow`** (Production)
- **Domain:** `join.boulders.dk` + `bouldersspaflow.pages.dev`
- **Purpose:** Live production site
- **Bruges til:** Endelige brugere, kunder, marketing

### 2. **`bouldersspaflow-preview`** (Preview)
- **Domain:** `bouldersspaflow-preview.pages.dev`
- **Purpose:** Test og preview af ændringer
- **Bruges til:** Testing, QA, review før production

## Hvornår Bruger Du Hvilken?

### **Production (`bouldersspaflow` / `join.boulders.dk`)**

**Bruges til:**
- ✅ **Live brugere** - når kunder besøger `join.boulders.dk`
- ✅ **Production deployment** - kun når koden er klar til at gå live
- ✅ **Stabile versioner** - kun efter test og godkendelse

**Hvornår deployer du til Production?**
- Når preview er testet og godkendt
- Når du er klar til at gå live med ændringer
- Typisk efter merge til `main` branch (hvis automatisk deployment er sat op)

**Eksempel workflow:**
```
1. Lav ændringer i feature branch
2. Test lokalt
3. Push til GitHub
4. Preview deployment opdateres automatisk
5. Test på preview URL
6. Hvis alt virker → merge til main
7. Production deployment opdateres automatisk
```

### **Preview (`bouldersspaflow-preview`)**

**Bruges til:**
- ✅ **Testing** - test nye features før de går live
- ✅ **QA** - kvalitetssikring af ændringer
- ✅ **Review** - vis ændringer til team/klient før production
- ✅ **Debugging** - test fixes før production deployment
- ✅ **Staging** - test integration med APIs og services

**Hvornår deployer du til Preview?**
- Automatisk ved hver commit til `main` branch
- Eller manuelt når du vil teste noget specifikt

**Eksempel workflow:**
```
1. Lav ændringer
2. Commit og push til GitHub
3. Preview opdateres automatisk (4 minutter senere)
4. Test på preview URL
5. Hvis noget fejler → fix og push igen
6. Preview opdateres automatisk igen
7. Når alt virker → klar til production
```

## Automatisk Deployment

### Production Deployment
- **Trigger:** Automatisk når du pusher til `main` branch
- **Eller:** Manuelt via Cloudflare Dashboard
- **Frekvens:** Kun når du er klar til at gå live

### Preview Deployment
- **Trigger:** Automatisk ved hver commit til `main` branch
- **Frekvens:** Hver gang du pusher kode

## Best Practices

### ✅ Gør Dette:

**Preview:**
- Test alle ændringer på preview først
- Brug preview til at vise klienter/team nye features
- Debug problemer på preview før production

**Production:**
- Kun deploy til production når koden er testet og klar
- Test på preview først, altid!
- Brug production til live brugere

### ❌ Gør IKKE Dette:

**Preview:**
- Brug ikke preview til live brugere
- Glem ikke at teste på preview før production

**Production:**
- Deploy ikke direkte til production uden test
- Deploy ikke eksperimentelle features direkte til production
- Deploy ikke til production uden at teste på preview først

## Workflow Eksempel

### Scenario: Du vil tilføje en ny feature

```
1. [Lokal] Lav ændringer i koden
2. [Lokal] Test lokalt: `npm run dev`
3. [GitHub] Commit og push til `main` branch
4. [Preview] Vent 4 minutter → Preview opdateres automatisk
5. [Preview] Test på: `bouldersspaflow-preview.pages.dev`
   - Tjek at API calls virker
   - Tjek at UI ser korrekt ud
   - Tjek at alle features virker
6. [Preview] Hvis noget fejler:
   - Fix lokalt
   - Push igen
   - Preview opdateres automatisk
   - Test igen
7. [Production] Når alt virker på preview:
   - Production opdateres automatisk (hvis sat op)
   - Eller manuelt deploy til production
8. [Production] Verificer på: `join.boulders.dk`
```

## Hvordan Opdaterer De Automatisk?

### Production (`bouldersspaflow`)
- Opdateres automatisk når du pusher til `main` branch
- Eller manuelt via Cloudflare Dashboard

### Preview (`bouldersspaflow-preview`)
- Opdateres automatisk ved hver commit til `main` branch
- Giver dig en unik preview URL for hver deployment

## Sammenfatning

| Feature | Production | Preview |
|---------|-----------|---------|
| **Domain** | `join.boulders.dk` | `bouldersspaflow-preview.pages.dev` |
| **Bruges til** | Live brugere | Testing & QA |
| **Opdateres** | Når klar til live | Automatisk ved hver commit |
| **Test først?** | Ja, altid på preview | N/A (det er test) |
| **Brugere** | Kunder, endelige brugere | Team, QA, klienter |

## Næste Steps

1. ✅ **Test preview nu:** Gå til `bouldersspaflow-preview.pages.dev` og test at alt virker
2. ✅ **Verificer production:** Gå til `join.boulders.dk` og tjek at det stadig virker
3. ✅ **Ryd op:** Slet de unødvendige Workers projekter (se `CLEANUP_CLOUDFLARE_DEPLOYMENTS.md`)

