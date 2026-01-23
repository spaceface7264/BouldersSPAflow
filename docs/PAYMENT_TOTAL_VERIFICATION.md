# Payment Total Verification - Critical Maintenance Guide

## Overview

This document outlines the critical points that must be maintained to ensure the payment window always shows the correct total (subscription + addons).

## Root Cause (Fixed)

The issue was that when pricing fix strategies delete and re-add subscription items, they create **NEW subscription item IDs**. The old ID was still stored in `state.subscriptionItemId`, causing addons to fail with `ID_NOT_FOUND` when trying to link via `additionTo`.

## Critical Points to Maintain

### 1. Subscription Item ID Must Be Updated After Pricing Fix

**Location**: `app.js` - Two places:
- `addSubscriptionItem()` method (line ~1596)
- `handleCheckout()` function (line ~14367)

**What to check**:
- When `_fixBackendPricingBug()` succeeds, it returns a fixed order with a NEW subscription item
- We MUST extract the new subscription item ID and update `state.subscriptionItemId`
- If this is not done, addons will fail with `ID_NOT_FOUND`

**Code pattern**:
```javascript
if (fixedOrder) {
  const newSubscriptionItem = fixedOrder?.subscriptionItems?.[0];
  if (newSubscriptionItem?.id) {
    state.subscriptionItemId = newSubscriptionItem.id; // CRITICAL: Update ID
  }
}
```

### 2. Subscription Item ID Must Be Verified Before Adding Addons

**Location**: `app.js` - `handleCheckout()` function (line ~13930)

**What to check**:
- Before adding addons, verify `state.subscriptionItemId` exists in the current order
- If missing or invalid, fetch the order to get the current subscription item ID
- This handles cases where the ID might be stale or missing

**Code pattern**:
```javascript
// Verify subscription item ID exists in current order
let validSubscriptionItemId = state.subscriptionItemId;
if (!validSubscriptionItemId) {
  const currentOrder = await orderAPI.getOrder(state.orderId);
  validSubscriptionItemId = currentOrder?.subscriptionItems?.[0]?.id;
  state.subscriptionItemId = validSubscriptionItemId; // Update stored ID
}
```

### 3. Payment Must Be Blocked If Addons Fail to Add

**Location**: `app.js` - `handleCheckout()` function (line ~14020)

**What to check**:
- If addons fail to add (especially with `ID_NOT_FOUND` or `403 Forbidden`), payment MUST be blocked
- Do NOT silently continue - this would result in incorrect payment totals
- Show clear error messages to the user

**Code pattern**:
```javascript
} catch (error) {
  if (error.message.includes('ID_NOT_FOUND') || error.status === 403) {
    throw new Error('Cannot proceed - addons failed to add');
  }
}
```

### 4. Final Order Verification Before Payment Link

**Location**: `app.js` - `handleCheckout()` function (line ~14427)

**What to check**:
- Before generating payment link, verify all addons are present in the final order
- Refresh the order one final time to get the latest price with addons
- Use `verifyOrderBeforePayment()` function to catch any issues

**Code pattern**:
```javascript
const verificationResult = verifyOrderBeforePayment(orderBeforePayment);
if (!verificationResult.isValid) {
  throw new Error(`Cannot proceed: ${verificationResult.issues.join('; ')}`);
}
```

### 5. Payment Overview Must Use Backend Order Price When Addons Present

**Location**: `app.js` - `updatePaymentOverview()` function (line ~12179)

**What to check**:
- When addons are present, ALWAYS use `state.fullOrder.price.amount` from backend
- Do NOT use client-side calculations - they don't account for addons properly
- The backend order price is the authoritative source for what will be sent to payment window

**Code pattern**:
```javascript
const hasAddons = state.addonIds && state.addonIds.size > 0;
if (hasAddons) {
  // Always use backend order price - it includes addons
  payNowAmount = orderPriceDKK;
  // Skip client-side price verification
}
```

## Verification Function

A comprehensive verification function `verifyOrderBeforePayment()` has been added that checks:
1. Subscription item exists in order
2. Subscription item ID matches stored ID
3. All selected addons are present in order
4. Addons are linked to subscription (have `additionTo` field)
5. Order structure is valid

**Usage**: This function is automatically called before payment link generation.

## Testing Checklist

Before deploying changes that touch order/payment logic, verify:

- [ ] Subscription item ID is updated after pricing fix
- [ ] Subscription item ID is verified before adding addons
- [ ] Payment is blocked if addons fail to add
- [ ] Final order verification runs before payment link
- [ ] Payment overview uses backend price when addons present
- [ ] Console logs show correct subscription item ID throughout flow
- [ ] Test with: Subscription + Addon → Verify payment window shows correct total

## Debugging

If payment totals are incorrect:

1. Check console for `[checkout]` logs - they show subscription item ID updates
2. Check for `ID_NOT_FOUND` errors when adding addons
3. Verify `state.subscriptionItemId` matches the subscription item ID in the order
4. Use `window.verifyOrderPrice(orderId)` to debug order pricing
5. Use `window.checkPaymentOverview()` to check payment overview state

## Common Pitfalls

1. **Forgetting to update subscription item ID after pricing fix** - This is the #1 cause of the issue
2. **Not verifying subscription item ID exists before using it** - Can cause `ID_NOT_FOUND`
3. **Allowing payment to proceed when addons fail** - Results in incorrect totals
4. **Using client-side calculated prices when addons are present** - Doesn't account for addons
5. **Not refreshing order before payment link** - May have stale data

## Related Files

- `app.js` - Main implementation
- `docs/backend-issues/ADDON_PRODUCT_TOTAL_PRICE_FIX.md` - Original fix documentation
