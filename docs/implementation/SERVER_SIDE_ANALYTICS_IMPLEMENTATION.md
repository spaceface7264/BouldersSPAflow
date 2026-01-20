# Server-Side Analytics Implementation

## Overview

This document describes the implementation of server-side analytics integration (Steps 13-17) that enables connecting client-side browser events with server-side API events for complete funnel tracking.

## Implementation Date

2026-01-20

## What Was Implemented

### Step 14: Load GA4 with Consent Defaults ✅

- **Location**: `index.html` (lines 103-120)
- **Implementation**: GA4 Consent Mode is initialized with all storage denied by default
- **Format**: Uses dataLayer push before GTM/GA4 loads
- **Code**:
  ```javascript
  window.dataLayer.push({
    'consent': 'default',
    'analytics_storage': 'denied',
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
  });
  ```

### Step 15: Capture GA4 Client ID After Opt-In ✅

- **Location**: `utils/analytics.js`
- **Implementation**: 
  - `captureGA4ClientId()` function uses `gtag('get', measurementId, 'client_id', callback)` to retrieve client ID
  - Client ID is stored in memory (not persisted to localStorage)
  - Automatically cleared when consent is withdrawn
  - Measurement ID: `G-5LK4VMR8E2` (boulders-api-flow)
- **Integration**: Called automatically when consent is granted via `updateGA4ConsentMode()`

### Step 16: Send Analytics Headers with Funnel Requests ✅

- **Location**: `utils/analytics.js` and `app.js`
- **Implementation**: 
  - `getAnalyticsHeaders(customerId)` function generates headers based on consent status
  - Headers only included if user has granted analytics/marketing consent
  - Headers sent to all required endpoints:
    - ✅ `POST /api/orders` (OrderAPI.createOrder)
    - ✅ `POST /api/orders/{orderId}/items/subscriptions` (OrderAPI.addSubscriptionItem)
    - ✅ `POST /api/orders/{orderId}/items/valuecards` (OrderAPI.addValueCardItem)
    - ✅ `POST /api/orders/{orderId}/items/articles` (OrderAPI.addArticleItem)
    - ✅ `POST /api/payment/generate-link` (PaymentAPI.generatePaymentLink)

### Step 17: Consent Mode Updates ✅

- **Location**: `utils/analytics.js` and `app.js`
- **Implementation**:
  - `updateGA4ConsentMode()` updates GA4 consent mode when consent changes
  - Works with both `gtag()` (preferred) and `dataLayer` (fallback)
  - Automatically captures client ID when consent is granted
  - Clears client ID when consent is withdrawn
  - Integrated into `setCookieConsent()` function

## Files Modified

### New Files

1. **`utils/analytics.js`** (New)
   - Analytics utility module
   - GA4 client ID capture
   - Analytics header generation
   - Consent mode management

### Modified Files

1. **`app.js`**
   - Added analytics imports
   - Initialized analytics utilities in DOMContentLoaded
   - Updated `setCookieConsent()` to call `updateGA4ConsentMode()`
   - Updated `unloadGTM()` to clear GA4 client ID
   - Updated `OrderAPI.createOrder()` to include analytics headers
   - Updated `OrderAPI.addSubscriptionItem()` to include analytics headers
   - Updated `OrderAPI.addValueCardItem()` to include analytics headers
   - Updated `OrderAPI.addArticleItem()` to include analytics headers
   - Updated `PaymentAPI.generatePaymentLink()` to include analytics headers

2. **`index.html`**
   - Added GA4 Consent Mode initialization (deny by default)

## Headers Sent

When consent is granted and GA4 client ID is available, the following headers are sent:

- `x-ga-client-id`: GA4 client ID (e.g., `1234567890.1234567890`)
- `x-ga-user-id`: BRP customer ID (when user is authenticated, e.g., `12345`)

**Note**: Headers are only sent if:
1. User has granted analytics or marketing consent
2. GA4 client ID has been captured (after consent and GA4 initialization)
3. For `x-ga-user-id`: Customer is authenticated and customer ID is available

## Consent Flow

1. **Page Load**:
   - GA4 Consent Mode initialized with all storage denied
   - Analytics utilities initialized
   - Existing consent checked and GA4 consent mode updated if consent exists

2. **User Grants Consent**:
   - `setCookieConsent()` called
   - GTM loads (if analytics/marketing consent)
   - `updateGA4ConsentMode()` called → GA4 consent mode updated to "granted"
   - After 500ms delay, `captureGA4ClientId()` called → Client ID captured

3. **User Withdraws Consent**:
   - `setCookieConsent()` called
   - GTM unloaded
   - `updateGA4ConsentMode()` called → GA4 consent mode updated to "denied"
   - `clearGA4ClientId()` called → Client ID cleared from memory

4. **API Requests**:
   - Before each API call, `getAnalyticsHeaders(customerId)` called
   - Headers only included if consent granted and client ID available
   - Headers sent with request to backend

## Testing

**📋 Full Testing Guide**: See `docs/testing/TESTING_SERVER_SIDE_ANALYTICS.md` for comprehensive step-by-step testing instructions.

### Quick Test Checklist

- [ ] Verify GA4 Consent Mode initializes with "denied" on page load
- [ ] Verify consent mode updates to "granted" when user accepts cookies
- [ ] Verify GA4 client ID is captured after consent (check browser console)
- [ ] Verify `x-ga-client-id` header is sent with API requests (check Network tab)
- [ ] Verify `x-ga-user-id` header is sent when user is authenticated
- [ ] Verify headers are NOT sent when consent is denied
- [ ] Verify client ID is cleared when consent is withdrawn
- [ ] Test with existing consent (page reload with consent already granted)

### Quick Test Steps

1. **Open DevTools** → Network tab
2. **Accept cookies** (Analytics/Marketing)
3. **Wait 2 seconds** for GA4 to initialize
4. **Trigger API call** (add to cart, checkout, etc.)
5. **Check Request Headers** for `x-ga-client-id` and `x-ga-user-id`

## Debugging

### Check GA4 Client ID

```javascript
// In browser console
import { getGA4ClientId } from './utils/analytics.js';
console.log('GA4 Client ID:', getGA4ClientId());
```

### Check Analytics Headers

```javascript
// In browser console
import { getAnalyticsHeaders } from './utils/analytics.js';
console.log('Analytics Headers:', getAnalyticsHeaders(state.customerId));
```

### Verify Consent Mode

```javascript
// In browser console
window.dataLayer.filter(e => e.consent || e.analytics_storage)
```

## Backend Integration

The backend should:
1. Receive `x-ga-client-id` header on all funnel requests
2. Receive `x-ga-user-id` header when user is authenticated
3. Use these IDs to stitch client-side and server-side events in GA4
4. Fall back to anonymous tracking if headers are not present

## Measurement ID

- **GA4 Measurement ID**: `G-5LK4VMR8E2`
- **Property**: `boulders-api-flow`
- **GTM Container**: `GTM-KHB92N9P` (Web), `GTM-P8DL49HC` (Server)

## Notes

- Client ID is stored in memory only (not persisted) for privacy compliance
- Client ID is automatically cleared when consent is withdrawn
- Headers are only sent when consent is granted and client ID is available
- Backend should handle cases where headers are not present (anonymous tracking)

## Related Documentation

- `docs/implementation/CLIENT_SIDE_IMPLEMENTATION.md` - Steps 13-17 reference
- `docs/implementation/IMPLEMENTATION_GUIDE_REFERENCE.md` - Implementation guide
- `docs/GTM_IMPLEMENTATION.md` - GTM setup
- `docs/TRACKING_DEBUG_GUIDE.md` - Tracking debugging
