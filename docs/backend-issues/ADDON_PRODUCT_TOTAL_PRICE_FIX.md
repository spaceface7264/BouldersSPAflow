# Addon Product Total Price Fix

## Problem Description

When adding addon products to subscriptions via the boost modal, the addon products appeared in the frontend UI and cart, but the **total price in the payment window did not include the addon product price**.

### Symptoms
- ✅ Addon products visible in boost modal
- ✅ Addon products appear in cart summary
- ❌ Payment window shows incorrect total (missing addon price)
- ❌ Order total from backend API doesn't include addon prices

### Test Case
- **Subscription ID**: 537
- **Addon Product ID**: 543 (Value Card type)
- **Expected**: Subscription price + 100 kr (addon) = correct total
- **Actual**: Only subscription price shown in payment window

## Root Cause

The issue had two main causes:

### 1. Missing `additionTo` Field
Addon products were being added to orders as standalone items without linking them to the parent subscription item. The BRP API requires the `additionTo` field to link addon products to their parent subscription, which ensures:
- The backend treats them as part of the subscription
- The order total includes the addon prices
- The payment link reflects the correct total

### 2. Incorrect Product Type Detection
The code was attempting to add Value Card addons as Article items, causing a `403 Forbidden` error with `INCORRECT_PRODUCT_TYPE`. The detection logic wasn't properly identifying Value Card products vs Article products.

## Solution

### 1. Store Subscription Item ID

After adding a subscription to an order, we now store the subscription item ID for linking addons:

**Location**: `app.js` - `ensureSubscriptionAttached()` function

```javascript
// CRITICAL: Store subscription item ID for linking addons via additionTo
const subscriptionItem = updatedOrder?.subscriptionItems?.[0];
if (subscriptionItem?.id) {
  state.subscriptionItemId = subscriptionItem.id;
  console.log('[ensureSubscriptionAttached] ✅ Stored subscription item ID:', state.subscriptionItemId);
}
```

**State Addition**:
```javascript
subscriptionItemId: null, // Subscription item ID from order - used to link addons via additionTo
```

### 2. Update `addArticleItem()` Method

Added `additionTo` parameter to link article addons to subscriptions:

**Location**: `app.js` - `OrderAPI.addArticleItem()` method

```javascript
async addArticleItem(orderId, productId, additionTo = null) {
  // ...
  const payload = {
    articleProduct: productId,
    businessUnit: state.selectedBusinessUnit,
    ...(additionTo ? { additionTo } : {}), // Link to parent subscription item if provided
  };
  // ...
}
```

### 3. Update `addValueCardItem()` Method

Added `additionTo` parameter to link value card addons to subscriptions:

**Location**: `app.js` - `OrderAPI.addValueCardItem()` method

```javascript
async addValueCardItem(orderId, productId, quantity = 1, additionTo = null) {
  // ...
  const payload = {
    valueCardProduct: productId,
    ...(additionTo ? { additionTo } : {}), // Link to parent subscription item if provided
  };
  // ...
}
```

### 4. Improved Product Type Detection

Enhanced the detection logic to properly identify Value Card vs Article products:

**Location**: `app.js` - `handleCheckout()` function

```javascript
// Determine if addon is a value card or article
const numericId = typeof addonId === 'string' ? parseInt(addonId, 10) : addonId;
const addon = findAddon(addonId);

// Primary method: Check if product ID exists in state.valueCards
const isInValueCards = state.valueCards && state.valueCards.some(vc => {
  const vcId = typeof vc.id === 'string' ? parseInt(vc.id, 10) : vc.id;
  return vcId === numericId || String(vc.id) === String(addonId) || vc.id === addonId;
});

// Also check allRawProducts (includes value cards before filtering)
const isInRawValueCards = state.allRawProducts && state.allRawProducts.some(p => {
  const pId = typeof p.id === 'string' ? parseInt(p.id, 10) : p.id;
  return (pId === numericId || String(p.id) === String(addonId) || p.id === addonId) &&
         (p.productType === 'VALUE_CARD' || p.productType === 'VALUECARD' || 
          (!p.priceWithInterval && !p.subscriptionInterval));
});

// Secondary method: Check productType field if available
const hasValueCardType = addon && (
  addon.productType === 'VALUE_CARD' ||
  addon.productType === 'VALUECARD' ||
  (addon.product && (addon.product.productType === 'VALUE_CARD' || addon.product.productType === 'VALUECARD'))
);

const isValueCard = isInValueCards || isInRawValueCards || hasValueCardType || hasValueCardFields;

if (isValueCard) {
  // Add as value card with additionTo link
  await orderAPI.addValueCardItem(state.orderId, numericId, 1, state.subscriptionItemId);
} else {
  // Add as article with additionTo link
  await orderAPI.addArticleItem(state.orderId, numericId, state.subscriptionItemId);
}
```

### 5. Updated Verification Logic

Enhanced verification to check both article items and value card items:

**Location**: `app.js` - `handleCheckout()` function

```javascript
// Check both article items and value card items (addons can be either type)
const articleItems = updatedOrder?.articleItems || [];
const valueCardItems = updatedOrder?.valueCardItems || [];
const articleProductIds = articleItems.map(item => item.product?.id).filter(Boolean);
const valueCardProductIds = valueCardItems.map(item => item.product?.id).filter(Boolean);
const allProductIds = [...articleProductIds, ...valueCardProductIds];

// Check if all added addons are in the order (either as articles or value cards)
const allAddonsPresent = addedAddonIds.every(id => 
  allProductIds.includes(Number(id)) || allProductIds.includes(String(id))
);
```

## How It Works

### Flow Diagram

```
1. User selects subscription with "Boost" label
   ↓
2. Boost modal shows addon products
   ↓
3. User selects addon product (e.g., Value Card ID 543)
   ↓
4. User proceeds to checkout
   ↓
5. Subscription added to order
   ↓
6. Subscription item ID stored in state.subscriptionItemId
   ↓
7. Addon product type detected (Value Card vs Article)
   ↓
8. Addon added with additionTo = subscriptionItemId
   ↓
9. Backend links addon to subscription
   ↓
10. Order total includes addon price
    ↓
11. Payment window shows correct total ✅
```

### API Request Examples

**Before Fix** (Missing `additionTo`):
```json
POST /api/orders/{orderId}/items/articles
{
  "articleProduct": 543,
  "businessUnit": 1
}
```

**After Fix** (With `additionTo`):
```json
POST /api/orders/{orderId}/items/valuecards
{
  "valueCardProduct": 543,
  "additionTo": 12345  // Subscription item ID
}
```

## Testing

### Test Case 1: Value Card Addon
- **Subscription**: ID 537
- **Addon**: ID 543 (Value Card, 100 kr)
- **Expected Result**: Payment window shows subscription price + 100 kr

### Verification Steps
1. Select subscription with "Boost" label
2. Select addon product in boost modal
3. Proceed to checkout
4. Check browser console for logs:
   - `✅ Stored subscription item ID: [id]`
   - `Adding addon 543 as value card (linked to subscription item [id])`
   - `✅ All addons verified in order`
   - `✅ Order total with addons: [total] DKK`
5. Verify payment window shows correct total

### Console Logs to Monitor

**Successful Flow**:
```
[checkout] Subscription item ID for linking: 12345
[checkout] Addon 543 type detection: { isInValueCards: true, isValueCard: true, ... }
[checkout] Adding addon 543 as value card (linked to subscription item 12345)
[checkout] ✅ Add-on added: 543
[checkout] ✅ All addons verified in order
[checkout] ✅ Order total with addons: [total] DKK
```

**Error Detection**:
```
[checkout] ❌ Failed to add add-on 543: Error: Add article item failed: 403 - {"errorCode":"INCORRECT_PRODUCT_TYPE"}
```

## Backend Requirements

For addon products to work correctly, they must be:

1. **Configured as Addition** in backend:
   - Product must be linked as an addition to the subscription product
   - Configure visibility options (e.g., "Optional" for NEW_CUSTOMER flow)

2. **Product Settings**:
   - Assigned to same business units as subscription
   - Price configured
   - "Kan bookes via internet" checkbox checked
   - Product label "boostProduct" added (for boost modal)

3. **Product Type**:
   - Can be Value Card, Article, or Subscription type
   - Frontend automatically detects type and uses correct API endpoint

## API Endpoints Used

- `POST /api/ver3/orders/{orderId}/items/subscriptions` - Add subscription
- `POST /api/ver3/orders/{orderId}/items/valuecards` - Add value card addon (with `additionTo`)
- `POST /api/ver3/orders/{orderId}/items/articles` - Add article addon (with `additionTo`)
- `GET /api/ver3/orders/{orderId}` - Get order (verify addons included)

## Files Modified

- `app.js`:
  - Added `state.subscriptionItemId` to store subscription item ID
  - Updated `ensureSubscriptionAttached()` to store subscription item ID
  - Updated `addArticleItem()` to accept `additionTo` parameter
  - Updated `addValueCardItem()` to accept `additionTo` parameter
  - Enhanced product type detection in `handleCheckout()`
  - Updated verification logic to check both article and value card items

## Related Documentation

- [Backend Setup Requirements](./ADDON_PRODUCT_BACKEND_SETUP.md) - How to configure addon products in backend
- [API Integration Guide](../implementation/API-INTEGRATION.md) - General API integration patterns
- [Boost Modal Implementation](../implementation/BOOST_MODAL_IMPLEMENTATION.md) - How boost modal works

## Status

✅ **RESOLVED** - Addon products are now correctly linked to subscriptions and included in payment totals.

## Date

January 23, 2026
