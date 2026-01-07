# Backend Bug: Products Displayed Despite "Kan bookes via internet" Checkbox Unchecked

## Problem Description

Some subscription products are being displayed in the frontend even though they are configured in the backend to NOT be displayed (checkbox "kan bookes via internet" is unchecked).

## Affected Products

1. **Product ID 308**: `[invalid] Summer Pass`
   - Backend setting: "kan bookes via internet" = unchecked
   - API response: `allowedToOrder: true`
   - Status: Currently excluded by frontend due to missing `priceWithInterval.price.amount`

2. **Product ID 364**: `[Collaboration ESN] Studie Medlemskab: 50% 3 mdr.`
   - Backend setting: "kan bookes via internet" = unchecked
   - API response: `allowedToOrder: true`
   - Status: Currently displayed (should be excluded)

3. **Product ID 267**: `[Collaboration] Medlemskab til studiepris: 0 kr første måned`
   - Backend setting: "kan bookes via internet" = unchecked (assumed)
   - API response: `allowedToOrder: true`
   - Status: Currently displayed (should be excluded)

## Root Cause

According to the OpenAPI specification (line ~15032-15034), the `allowedToOrder` field should:
- "To determine whether the subscription product is bookable for the subscription user or not"

The `allowedToOrder` field is calculated dynamically based on:
1. The `subscriber` parameter (when provided) - checks if specific user can book the product
2. The "kan bookes via internet" checkbox setting (when no subscriber is provided)

**Issue**: When no `subscriber` parameter is provided (anonymous users), backend is not correctly setting `allowedToOrder=false` for products where "kan bookes via internet" checkbox is unchecked.

## API Endpoint

**GET** `/api/ver3/products/subscriptions?businessUnit={id}`

**Current Request** (from frontend):
```
GET /api/products/subscriptions?businessUnit=1
```

**Note**: Frontend does not send `subscriber` or `customer` parameters for anonymous users, as per OpenAPI spec (line ~8293: `ROLE_ANONYMOUS`).

## Expected Behavior

When "kan bookes via internet" checkbox is **unchecked** in backend:
- Backend should set `allowedToOrder: false` in API response
- This should apply even when no `subscriber` parameter is provided
- Frontend will then correctly exclude these products from display

## Current Workaround

Frontend is implementing defensive filtering:
1. Excludes products with `allowedToOrder: false` ✅
2. Excludes products without `priceWithInterval.price.amount` ✅
3. Validates `businessUnits` array ✅

However, products with `allowedToOrder: true` (incorrectly set) are still being displayed.

## OpenAPI Specification Reference

- **SubscriptionProductOut schema** (line ~14970)
- **allowedToOrder field** (line ~15032-15034): "To determine whether the subscription product is bookable for the subscription user or not"
- **subscriber parameter** (line ~8309-8312): "Customer ID of the subscription user. This is to determine whether the product is bookable for the subscription user."

## Requested Fix

Backend should:
1. Set `allowedToOrder: false` when "kan bookes via internet" checkbox is unchecked
2. Apply this logic even when no `subscriber` parameter is provided (anonymous users)
3. Ensure `allowedToOrder` correctly reflects the checkbox setting in all cases

## Frontend Implementation

Frontend correctly handles `allowedToOrder: false`:
```javascript
if (product.hasOwnProperty('allowedToOrder') && product.allowedToOrder === false) {
  console.log(`[Product Filter] Excluding subscription product ${product.id} (${product.name}): allowedToOrder is false`);
  return false;
}
```

Once backend correctly sets `allowedToOrder: false`, frontend will automatically exclude these products.

