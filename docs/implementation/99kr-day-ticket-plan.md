# /99kr "Your First Climb" — Day-Ticket Landing Plan

Scaffolded plan. No code yet. Branch: `feat/99kr-day-ticket` off `main`.

## Product
- **Name:** Your First Climb
- **Price:** 99 kr
- **Includes:** Entry + rental shoes
- **Audience:** First-time visitors only
- **BRP label:** `Dagsbillet`
- **Product type:** Most likely a value card (one-off purchase), not a subscription

## Goal
Single-product, high-converting, explanatory, frictionless landing at `/99kr`. First impression for first-time climbers — UX quality directly drives conversion.

## Architecture
Reuse the existing label-based landing-route pattern. Do not invent new architecture. Closest precedent: `LandingFreeTrial` in `app.js`.

## Implementation steps

### 1. Route registration
`app.js` ~line 77 (`LANDING_ROUTE_CONFIG`):

```js
'/99kr': Object.freeze({
  componentName: 'LandingDayTicket',
  labelKey: 'Dagsbillet',
  mode: 'single',
}),
```

Append `/99kr` to `NON_INDEXABLE_PATHS`.

### 2. Product loading
In `loadProductsFromAPI` (~line 3015) add `isDayTicketLandingRoute` branch. Day tickets are value cards, so the value-card endpoint must be hit. `displayLabelOptions`: allow `secret`, `public`, `publiccampaign`.

### 3. Landing render
In `renderLandingRoute` (~line 3540):
- Add `ensureDayTicketCategoryItem()` mirroring `ensureFreeTrialCategoryItem`. Custom category div with hero copy ("Din første klatretur — 99 kr inkl. lejesko"), first-time-visitor framing, single CTA.
- Extend `getLandingTargetList()` and `hideNonLandingCategories()` to handle `LandingDayTicket`.
- Add `LandingDayTicket` render: `renderLandingCards((products || []).slice(0, 1))`.
- Dispatch in the `if/else` near line 3640.

### 4. FAQ adaptation
`app.js` ~line 23686 (`FAQ_DATA`): add a `dayticket` category with translation keys for:
- What's included (entry + rental shoes)
- First-time-only eligibility
- Validity (one day)
- How to use it on arrival (gym check-in, ID, shoe sizing)
- What to do after the day (upgrade paths — 15-day pass / membership)
- Age and group rules

In `getActiveFAQs`: return `['dayticket']` when `state.landingRouteConfig?.componentName === 'LandingDayTicket'` for the steps where FAQ is visible.

### 5. Translations (da / en / de)
- Hero / category title and description on `/99kr`
- All FAQ q/a keys for `dayticket`
- CTA copy (e.g. `cart.activateDayTicket` / `cart.checkout` variant)
- Confirmation copy variant if the standard one doesn't fit

### 6. Cart / checkout verification
The standard value-card path should work as-is, but verify:
- Checkout button label
- Confirmation/success screen copy
- That the success screen handles a one-off ticket correctly (no membership-only assumptions)

### 7. Visual polish
The day-ticket page must feel premium:
- Hero image or illustration block above the card
- Three value-prop icons row: "Klatring", "Lejesko inkluderet", "Hele dagen"
- A "What to expect on arrival" reassurance section
- One clear primary CTA, no secondary distractions

## Open decisions before building
- Hero imagery / illustration source
- Final Danish copy (the why + the what + the after)
- First-time-visitor enforcement model: client-side guard (email known to BRP?) or trust BRP's `Dagsbillet` label assumption
- Upsell path after success: link to membership or 15-day pass on the confirmation screen

## Out of scope for first cut
- Cross-sell carousel
- A/B variants
- Marketing tracking events beyond what already fires for other landing routes

## Pick-up checklist for next session
1. Re-read `LandingFreeTrial` end-to-end first (closest precedent)
2. Verify with stakeholder which BRP product carries the `Dagsbillet` label and whether it's modeled as a value card
3. Start with step 1, work down
