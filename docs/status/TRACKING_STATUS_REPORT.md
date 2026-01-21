# Tracking Setup Status Report

**Date**: 2026-01-20  
**Branch**: main

## Overview

Current tracking implementation status for client-side GTM/GA4 ecommerce events and infrastructure.

---

## Client-Side Tracking (GTM/GA4)

### Infrastructure Status

#### GTM Container
- **Container ID**: `GTM-KHB92N9P` (Web container)
- **Server Container**: `GTM-P8DL49HC` (via Stape)
- **Server Container URL**: `https://gtm.join.boulders.dk`
- **Loading**: Conditional (only loads after cookie consent)
- **Status**: ✅ Configured

#### GA4 Property
- **Property**: `boulders-api-flow`
- **Measurement ID**: `G-5LK4VMR8E2`
- **Status**: ✅ Configured (requires GTM tags to be set up)

#### Cookie Consent
- **Implementation**: ✅ Active
- **Categories**: Essential, Analytics, Marketing, Functional
- **GTM Loading**: Only loads if Analytics or Marketing consent granted
- **Storage**: localStorage (`boulders_cookie_consent`)

---

## Events Currently Firing

### 1. `select_item` Event ✅

**Status**: ✅ Implemented and firing

**Location**: `app.js` - `handlePlanSelection()` function (line ~8393)

**Triggered When**:
- User clicks on a membership product card
- User clicks on a punch card product card
- Product selection changes

**Data Sent**:
```javascript
{
  event: 'select_item',
  ecommerce: {
    items: [{
      item_id: '123',
      item_name: 'Adult Membership',
      price: 445.00,
      quantity: 1,
      item_category: 'membership', // or 'punch-card'
      item_list_id: 'membership', // optional
      item_list_name: 'membership' // optional
    }]
  }
}
```

**Implementation Details**:
- Function: `trackSelectItemEvent()` (line ~8335)
- Calls: `window.GTM.trackSelectItem()`
- Fires in: `handlePlanSelection()` (line ~8422)

---

### 2. `add_to_cart` Event ✅

**Status**: ✅ Implemented and firing

**Location**: `app.js` - `updateCartSummary()` function (line ~10361)

**Triggered When**:
- New items are added to cart (membership, punch card, or addons)
- Only tracks when cart item count increases (not on every cart update)

**Data Sent**:
```javascript
{
  event: 'add_to_cart',
  ecommerce: {
    currency: 'DKK',
    value: 445.00,
    items: [{
      item_id: '123',
      item_name: 'Adult Membership',
      price: 445.00,
      quantity: 1,
      item_category: 'membership'
    }]
  }
}
```

**Implementation Details**:
- Function: `window.GTM.trackAddToCart()` (from `gtm-utils.js`)
- Fires in: `updateCartSummary()` (line ~10361)
- Condition: Only when `newCartItemCount > previousCartItemCount`

---

### 3. `begin_checkout` Event ✅

**Status**: ✅ Implemented and firing

**Location**: `app.js` - `handleCheckout()` function (line ~11738)

**Triggered When**:
- User clicks checkout button
- Validation passes
- Checkout process starts

**Data Sent**:
```javascript
{
  event: 'begin_checkout',
  ecommerce: {
    currency: 'DKK',
    value: 445.00,
    items: [{
      item_id: '123',
      item_name: 'Adult Membership',
      price: 445.00,
      quantity: 1,
      item_category: 'membership'
    }]
  }
}
```

**Implementation Details**:
- Function: `window.GTM.trackBeginCheckout()` (from `gtm-utils.js`)
- Fires in: `handleCheckout()` (line ~11740)
- Condition: Only if `state.cartItems && state.cartItems.length > 0`

---

### 4. `purchase` Event ✅

**Status**: ✅ Implemented and firing

**Location**: `app.js` - `loadOrderForConfirmation()` function (line ~13992)

**Triggered When**:
- Order is successfully completed
- Payment is confirmed
- User returns from payment provider

**Data Sent**:
```javascript
{
  event: 'purchase',
  ecommerce: {
    transaction_id: '817247',
    value: 445.00,
    tax: 0,
    shipping: 0,
    currency: 'DKK',
    items: [{
      item_id: '123',
      item_name: 'Adult Membership',
      price: 445.00,
      quantity: 1,
      item_category: 'membership'
    }]
  }
}
```

**Implementation Details**:
- Function: `window.GTM.trackPurchase()` (from `gtm-utils.js`)
- Fires in: `loadOrderForConfirmation()` (line ~14003)
- Condition: Only if `purchaseItems.length > 0` and `transactionId` exists

---

## Infrastructure Components

### 1. GTM Utilities (`gtm-utils.js`) ✅

**Status**: ✅ Active

**Functions Available**:
- `pushToDataLayer(eventName, eventData)` - Core function to push events
- `trackSelectItem(product, itemListId, itemListName)` - Track product selection
- `trackAddToCart(items, value, currency)` - Track items added to cart
- `trackBeginCheckout(items, value, currency)` - Track checkout initiation
- `trackPurchase(transactionId, items, value, tax, shipping, currency)` - Track completed purchase
- `formatProductForGA4(product)` - Format product data for GA4
- `formatPrice(priceInDKK)` - Format price for GA4

**Global Access**: `window.GTM` object

---

### 2. DataLayer ✅

**Status**: ✅ Initialized

**Location**: `index.html` (line ~104)

**Initialization**:
```javascript
window.dataLayer = window.dataLayer || [];
```

**Usage**: All events are pushed to `window.dataLayer` via `pushToDataLayer()`

---

### 3. Cookie Consent Management ✅

**Status**: ✅ Active

**Location**: `app.js` - Cookie consent functions (line ~16960)

**Functions**:
- `getCookieConsent()` - Get current consent from localStorage
- `setCookieConsent(accepted, categories)` - Save consent
- `getCookieCategoryConsent(category)` - Get category-specific consent
- `loadGTMIfConsented()` - Load GTM if consent granted
- `unloadGTM()` - Unload GTM if consent withdrawn

**GTM Loading**:
- Only loads if Analytics OR Marketing consent is granted
- Loads via `loadGTMIfConsented()` function
- Container ID: `GTM-KHB92N9P`

---

## Event Flow Summary

```
1. User visits page
   └─> Cookie consent banner shown
   └─> GTM NOT loaded yet

2. User accepts cookies (Analytics/Marketing)
   └─> GTM loads (GTM-KHB92N9P)
   └─> DataLayer initialized

3. User clicks product
   └─> select_item event fired ✅
   └─> Pushed to DataLayer
   └─> GTM captures event (if tags configured)

4. Cart updates
   └─> add_to_cart event fired ✅ (if new items added)
   └─> Pushed to DataLayer
   └─> GTM captures event (if tags configured)

5. User clicks checkout
   └─> begin_checkout event fired ✅
   └─> Pushed to DataLayer
   └─> GTM captures event (if tags configured)

6. Payment completed
   └─> purchase event fired ✅
   └─> Pushed to DataLayer
   └─> GTM captures event (if tags configured)
```

---

## What's Working

✅ **Client-Side Events**: All 4 ecommerce events are implemented and firing  
✅ **GTM Utilities**: Complete utility library for event tracking  
✅ **DataLayer**: Properly initialized and receiving events  
✅ **Cookie Consent**: Working and controlling GTM loading  
✅ **Event Data**: Properly formatted for GA4 ecommerce schema  
✅ **Price Formatting**: Automatic conversion from cents to DKK  

---

## What's Missing / Not Configured

### Server-Side Analytics ❌

**Status**: ❌ Not implemented (reverted)

**Missing**:
- GA4 client ID capture
- Analytics headers (`x-ga-client-id`, `x-ga-user-id`) on API requests
- Server-side event stitching

**Impact**: Cannot connect client-side events with server-side API events

---

### GTM Tags Configuration ⚠️

**Status**: ⚠️ Unknown (requires GTM access to verify)

**Required Tags** (must be configured in GTM):
- `GA4 - Configuration` tag (Measurement ID: `G-5LK4VMR8E2`)
- `GA4 - Select Item` event tag
- `GA4 - Add to Cart` event tag
- `GA4 - Begin Checkout` event tag
- `GA4 - Purchase` event tag

**Verification**: Check GTM container `GTM-KHB92N9P` to confirm tags are configured and published

---

### GA4 Consent Mode ❌

**Status**: ❌ Not initialized

**Missing**:
- GA4 Consent Mode default initialization (deny by default)
- Consent mode updates when user grants/withdraws consent

**Impact**: May not comply with GDPR consent requirements for GA4

---

## Testing Status

### Client-Side Events ✅

**Verification Method**:
1. Open browser console
2. Check for `[GTM] Pushed event:` messages
3. Check DataLayer: `window.dataLayer.filter(e => e.event)`
4. Use GTM Preview mode to verify events

**Expected Console Output**:
```
[GTM] Pushed event: select_item {ecommerce: {...}}
[GTM] Pushed event: add_to_cart {ecommerce: {...}}
[GTM] Pushed event: begin_checkout {ecommerce: {...}}
[GTM] Pushed event: purchase {ecommerce: {...}}
```

### GTM Tags ⚠️

**Verification Method**:
1. Go to GTM → Container `GTM-KHB92N9P`
2. Check Tags section
3. Verify all 5 tags exist and are published
4. Use GTM Preview mode to test

### GA4 Data ⚠️

**Verification Method**:
1. Go to GA4 → Property `boulders-api-flow`
2. Use DebugView (with `?debug_mode=true`)
3. Check Real-time reports
4. Verify events appear in GA4

---

## Recommendations

### Immediate Actions

1. **Verify GTM Tags**: Check GTM container to ensure all GA4 tags are configured and published
2. **Test Events**: Use GTM Preview mode to verify events are being captured
3. **Verify GA4**: Check GA4 DebugView to confirm events are reaching GA4

### Future Enhancements

1. **Server-Side Analytics**: Implement GA4 client ID capture and analytics headers (if needed)
2. **GA4 Consent Mode**: Initialize consent mode for GDPR compliance
3. **Additional Events**: Consider adding `view_item`, `remove_from_cart` events
4. **User Properties**: Add user_id tracking when authenticated

---

## Files Reference

### Core Implementation
- `gtm-utils.js` - GTM utility functions
- `app.js` - Event triggering logic
- `index.html` - GTM container initialization

### Documentation
- `docs/GTM_IMPLEMENTATION.md` - GTM implementation guide
- `docs/TRACKING_DEBUG_GUIDE.md` - Debugging guide
- `docs/GTM_CONFIGURATION_CHECKLIST.md` - GTM setup checklist

---

## Summary

**Client-Side Tracking**: ✅ Fully implemented and firing  
**Infrastructure**: ✅ GTM utilities, DataLayer, cookie consent all working  
**GTM Configuration**: ⚠️ Requires verification in GTM container  
**Server-Side Analytics**: ❌ Not implemented  
**GA4 Consent Mode**: ❌ Not initialized  

**Overall Status**: Client-side events are firing correctly. GTM tags need to be verified in GTM container, and server-side analytics is not implemented.
