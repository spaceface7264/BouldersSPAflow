# ~~RESOLVED~~ - Pricing Calculation Mismatch for productId 134

> **Status:** ✅ RESOLVED - January 2026
> 
> **Resolution:** Issue was a frontend calculation mismatch, not a backend bug. Frontend now matches backend pricing logic (day >= 16 = rest of month + full next month).
> 
> See `BACKEND_BUG_PRODUCTID_134_RESOLVED.md` for details.

## ~~Original Problem~~ (Resolved)
~~Backend ignorerer `startDate`-parameteren når man tilføjer subscription item for productId 134 ("Medlemskab"), men accepterer den for productId 56 ("Junior") og productId 135 ("Student").~~

## Symptomer
- **Frontend sender:** `startDate: "2026-01-05"` (i dag)
- **Backend returnerer:** `initialPaymentPeriod.start: "2026-02-01"` (næste måned)
- **Resultat:** Backend beregner ikke partial-month pricing, så payment window viser fuld månedlig pris (469 DKK) i stedet for reduceret pris (408.48 DKK)

## Bevis fra logs
```
Payload sendes med startDate: "2026-01-05"
Response viser: startDateAccepted: false
Response viser: responseStartDate: "2026-02-01"
```

## Sammenligning med andre produkter
- **productId 56 (Junior):** Backend accepterer startDate → `startDateAccepted: true` → Korrekt reduceret pris
- **productId 135 (Student):** Backend accepterer startDate → `startDateAccepted: true` → Korrekt reduceret pris
- **productId 134 (Medlemskab):** Backend ignorerer startDate → `startDateAccepted: false` → Forkert fuld pris

## Frontend workaround
Frontend beregner partial-month pricing client-side for display (408.48 DKK), men payment window bruger backend's pris (469 DKK), hvilket skaber mismatch.

## Løsning
Dette skal fixes på backend-siden. Backend skal:
1. Respektere `startDate`-parameteren for alle produkter, ikke kun for nogle
2. Beregne partial-month pricing korrekt når startDate er i dag
3. Returnere korrekt reduceret pris i `order.price.amount`

## Test cases
1. Tilføj subscription item med productId 134 og startDate = i dag
2. Verificer at backend returnerer `initialPaymentPeriod.start` = i dag (ikke næste måned)
3. Verificer at backend beregner partial-month pricing korrekt
4. Verificer at payment window viser korrekt reduceret pris

