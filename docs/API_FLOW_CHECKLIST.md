# API Flow Checklist

## Konfiguration & Setup

- [ ] Production URL er låst til `https://api-join.boulders.dk`
- [ ] Sprog default (da-DK) sendes i Accept-Language header på alle requests
- [ ] Business unit gemmes i state og inkluderes i alle API requests
- [ ] Reference data loader henter nødvendige lookups
- [ ] Reference data caches og opdateres ved business unit skift

## Grundlæggende Funktionalitet

- [ ] Alle haller vises
- [ ] Geolocation viser nærmeste hal
- [ ] Produkter vises
- [ ] Profil kan oprettes
- [ ] Profil kan logges ind på
- [ ] Profiler kan ikke oprettes igen på eksisterende email
- [ ] Accept/afvisning af marketing reflekteres i BRP
- [ ] Postnummer auto-udfyldning virker
- [ ] Validering af email format
- [ ] Validering af password (minimum 6 tegn)
- [ ] Validering af påkrævede felter

## Medlemskaber

- [ ] Medlemskaber viser korrekt Betal Nu periode
- [ ] Medlemskaber viser korrekt Betal Nu pris (med halve kroner)
- [ ] Korrekt medlemskab vises i BRP
- [ ] Korrekt dato periode vises i BRP
- [ ] Kontrakt status vises efter gennemført køb
- [ ] Kontrakt link er korrekt

## Kampagne Medlemskaber

- [ ] Kampagne medlemskaber viser korrekt bundet indtil
- [ ] Profiler med medlemskab inden for 6 måneder blokeres fra at oprette kampagner
- [ ] Kampagner viser advarsel mod at hoppe fra køb efter Checkout

## 15 Dages Adgang

- [ ] 15 dages viser korrekt periode med adgang
- [ ] 15 dages viser korrekt pris

## Klippekort

- [ ] Klippekort viser korrekt pris
- [ ] Klippekort tilkobles profilen i backend

## Betaling

- [ ] Betalingslink genereres korrekt
- [ ] Betalingsmetoder vises (Kort, Apple Pay, MobilePay)
- [ ] Redirect til betalingsudbyder virker
- [ ] Return fra betaling håndteres korrekt
- [ ] Betalingsstatus opdateres (leftToPay = 0)
- [ ] Ordre status opdateres til "Betalet"
- [ ] Betalingsfejl vises korrekt
- [ ] Retry betaling funktion virker

## Add-ons / Boost

- [ ] Add-ons vises korrekt
- [ ] Add-ons kan tilføjes til kurv
- [ ] Add-ons pris beregnes korrekt
- [ ] Add-ons tilkobles ordren i backend

## Rabatkoder

- [ ] Rabatkode kan indtastes
- [ ] Rabatkode valideres
- [ ] Pris opdateres efter rabatkode
- [ ] Forkert rabatkode viser fejl
- [ ] Rabat reflekteres i total pris

## Værge Flow (Mindreårige)

- [ ] Værge felter vises når alder < 18
- [ ] Værge profil kan oprettes med `isGuardianPurchase: true`
- [ ] Både værge og barn profil oprettes i samme request
- [ ] Værge linkes til barn i backend via `POST /api/customers/:customerId/other-user`
- [ ] Værge email valideres
- [ ] Værge password valideres
- [ ] Ordre refererer korrekt værge/barn ID'er

## Ordre Bekræftelse

- [ ] Ordre bekræftelse vises efter betaling
- [ ] Ordre detaljer er korrekte
- [ ] Medlemskab detaljer vises
- [ ] Betalingsbeløb vises korrekt
- [ ] Ordre ID vises
- [ ] Email bekræftelse sendes (hvis implementeret)

## Authentication & Token Management

- [ ] Login gemmer access/refresh tokens i session store
- [ ] Tokens valideres ved app reload (`POST /api/auth/validate`)
- [ ] Udløbet access token refreshes automatisk hvis refresh token findes
- [ ] Session clears hvis refresh fejler
- [ ] Password reset flow virker (`POST /api/auth/reset-password`)
- [ ] HTTP helper inkluderer automatisk tokens i requests
- [ ] Token expiration håndteres gracefully

## Fejlhåndtering

- [ ] API fejl vises brugervenligt
- [ ] Betalingsfejl håndteres
- [ ] Netværksfejl håndteres
- [ ] Valideringsfejl vises ved felter
- [ ] Session timeout håndteres
- [ ] Rate limiting håndteres (429 errors)

## Multi-step Navigation

- [ ] Step validering forhindrer spring over trin
- [ ] Step indikator opdateres korrekt
- [ ] Data bevares ved navigation
- [ ] URL opdateres korrekt

## Aldersverifikation

- [ ] Aldersverifikation for medlemskab
- [ ] Mindstealder kontrolleres
- [ ] Værge flow aktiveres automatisk for mindreårige

## State Management

- [ ] Business unit gemmes i central state
- [ ] Sprog gemmes i central state
- [ ] Reference data caches i state
- [ ] State opdateres ved business unit skift
- [ ] Session data bevares ved navigation
- [ ] Checkout state gemmes i sessionStorage

## Analytics Integration (Server-side)

- [ ] GA4 tag loader med Consent Mode (deny by default)
- [ ] Consent Mode opdateres når bruger giver samtykke
- [ ] GA4 client ID hentes efter consent (`gtag('get', ...)`)
- [ ] Client ID gemmes i kortlived state (ikke disk)
- [ ] Client ID clears hvis consent trækkes tilbage
- [ ] `x-ga-client-id` header sendes med funnel requests
- [ ] `x-ga-user-id` header sendes med customer ID når autentificeret
- [ ] Headers inkluderes i: POST /api/orders, POST /api/orders/{orderId}/items/*, POST /api/payment/generate-link
- [ ] Headers springes over hvis consent er denied

## API Integration Specifikke

- [ ] Business unit inkluderes i alle order/customer requests
- [ ] Add-ons hentes efter medlemskab valg (`GET /api/products/subscriptions/{productId}/additions`)
- [ ] Ordre oprettes med `POST /api/orders`
- [ ] Medlemskab tilføjes med `POST /api/orders/{orderId}/items/subscriptions`
- [ ] Klippekort tilføjes med `POST /api/orders/{orderId}/items/valuecards`
- [ ] Add-ons tilføjes med `POST /api/orders/{orderId}/items/articles`
- [ ] Betalingslink genereres med `POST /api/payment/generate-link`
