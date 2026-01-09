# Integration Guide

This build ships the Boulders membership purchase flow as a pure front‑end implementation. The markup, data attributes, and JavaScript hooks are ready for Makeable to attach real APIs without needing to reorder the DOM.

## Data Sources & Expected APIs

| Target | Endpoint (suggested) | Notes |
| --- | --- | --- |
| Membership plans | `GET /api/memberships` | Replace `MEMBERSHIP_PLANS` seed data in `app.js` with live responses. Populate name, pricing, description, and feature list. |
| Value cards | `GET /api/ver3/products/valuecards` | Hydrate `VALUE_CARDS` data by mapping the API fields (id, name, description, price, flags). Respect any min/max quantity rules returned in the payload or configured in business logic. |
| Add-ons | `GET /api/addons` | Supplies `ADDONS` list with original/discounted pricing. |
| Postal code lookup | `GET /api/addresses/{postalCode}` | Optional convenience endpoint to auto-fill the `city` field when the user enters a postal code. |
| Checkout | `POST /api/checkout` | Receives the payload built in `handleCheckout()` and returns order number, membership number, billing period, etc. |
| Payment intent | `POST /api/payments` | Swap in real card/Apple Pay flows; replace the current toast-based stubs once PSP logic is available. |
| Referral link | `GET /api/referrals` | Provide the shareable link shown on the confirmation page; currently hard-coded as a placeholder. |

## DOM Bindings

- Elements that will be hydrated or read by the backend are tagged with `data-api-field`, `data-summary-field`, `data-component`, or `data-action` attributes in `index.html`.
- Templates (`<template id="membership-plan-template">`, etc.) are used to avoid duplicate markup. Inject real content by cloning these nodes the same way `app.js` currently does with seed data.
- Dynamic confirmation values (order number, member name, totals) are updated through `data-summary-field` selectors.

## Front-end State & Payload

`app.js` centralises all dynamic data. The helper `buildCheckoutPayload()` compiles a payload with this shape:

```json
{
  "customer": {
    "fullName": "Jane Doe",
    "dateOfBirth": "1990-05-01",
    "address": {
      "street": "Examplevej 12",
      "postalCode": "2100",
      "city": "København"
    },
    "email": "jane@example.com",
    "phone": {
      "countryCode": "+45",
      "number": "12345678"
    },
    "password": "********",
    "passwordConfirmation": "********",
    "primaryGym": "boulders-copenhagen"
  },
  "guardian": {
    "fullName": "John Doe",
    "sameAddress": true,
    "...": "Optional fields when the toggle is active"
  },
  "purchase": {
    "isGuardian": false,
    "membershipPlanId": "membership-student",
    "valueCards": [{ "planId": "value-adult", "quantity": 1 }],
    "addons": ["addon-shoes"],
    "totalAmount": 778
  },
  "consent": {
    "terms": true,
    "marketing": false
  },
  "payment": {
    "method": "card",
    "card": {
      "number": "1234 5678 9012 3456",
      "expiry": "12/28",
      "cvv": "123",
      "cardholderName": "Jane Doe"
    }
  }
}
```

The backend can accept this payload as-is or adapt the transformer to match final contracts.

## Checkout Flow

1. **Plan selection** – `selectMembershipPlan()` captures the chosen membership and auto-advances to step 2. Value card quantities and add-ons are tracked via data attributes and rendered through templates.
2. **Add-ons** – `toggleAddon()` manages the selection state. Quantities are enforced so only one value card type is active at a time (`enforceValueCardAvailability()`).
3. **Account & payment** – Required field lists (`REQUIRED_FIELDS`, `PARENT_REQUIRED_FIELDS`) gate the form. Card validation runs locally; replace `handleCheckout()` with real PSP integration.
4. **Confirmation** – `buildOrderSummary()` currently stamps placeholder order numbers. Swap these out with values returned from the checkout API and push them into `state.order` before calling `renderConfirmationView()`.

## Integration To-Do List

- Wire the catalog fetch calls and drop the static constants in `app.js` once the API endpoints are live.
- Replace `handleCheckout()`’s `console.info` and success toast with real promise handling. On success, hydrate `state.order` from the response. On failure, surface error toasts tied to backend messages.
- Connect Apple Pay / card submissions to the real payment provider. The current implementation only formats inputs; it does not create payment intents.
- Supply a billing period string (e.g. `"For perioden 1.-30. september 2025"`) and assign it to `state.billingPeriod` so cart and confirmation views show exact coverage.
- Return a referral URL from the backend instead of the `TBD-CODE` placeholder, then call `navigator.clipboard.writeText()` with that value.
- Coordinate localisation by swapping the hard-coded content (`data-i18n-key` attributes) with your translation pipeline.

## Testing Checklist

- Select each membership plan and ensure the wizard advances and totals update.
- Increment value card quantities and verify other value cards lock correctly.
- Toggle add-ons and confirm the cart/confirmation lists update in sync.
- Submit the form without filling required fields and verify error states highlight the right inputs.
- Switch payment methods and confirm the card form visibility responds appropriately.
- Trigger checkout to inspect the payload logged in the console; confirm it matches expectations before wiring APIs.

## Files to Modify for Integration

- `API Prod2/app.js` – replace static data, implement fetches, and connect checkout/payment logic.
- `API Prod2/index.html` – only extend data attributes if new backend properties are introduced.
- `API Prod2/styles.css` – adjust styling for any backend-driven state (e.g., additional badges or error states).

Ping the front-end team before altering the templates so we can keep CSS selectors stable and avoid regressions.
