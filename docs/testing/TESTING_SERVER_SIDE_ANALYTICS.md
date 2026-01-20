# Testing Server-Side Analytics Implementation

## Quick Test Checklist

- [ ] GA4 Consent Mode initializes with "denied" on page load
- [ ] Consent mode updates to "granted" when user accepts cookies
- [ ] GA4 client ID is captured after consent
- [ ] `x-ga-client-id` header is sent with API requests
- [ ] `x-ga-user-id` header is sent when user is authenticated
- [ ] Headers are NOT sent when consent is denied
- [ ] Client ID is cleared when consent is withdrawn

---

## Test 1: Verify GA4 Consent Mode Initialization

### Step 1: Open Browser Console

1. Open your test page (e.g., `https://join.boulders.dk` or localhost)
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to **Console** tab

### Step 2: Check DataLayer for Consent Default

```javascript
// Check if consent default was pushed to dataLayer
window.dataLayer.filter(e => e.consent === 'default' || e.analytics_storage === 'denied')
```

**Expected Result**: Should see an object with:
```javascript
{
  consent: 'default',
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
}
```

### Step 3: Verify Consent Mode Before User Interaction

```javascript
// Check if gtag is available and what consent state it has
if (window.gtag) {
  console.log('gtag available');
  // Note: gtag('get') doesn't work for consent, but we can check dataLayer
} else {
  console.log('gtag not available yet (expected before consent)');
}
```

**Expected Result**: `gtag` should not be available yet (GTM not loaded until consent)

---

## Test 2: Verify Consent Mode Update When User Accepts

### Step 1: Accept Cookie Consent

1. Click "Accept All" or accept Analytics/Marketing cookies
2. Watch the browser console for log messages

### Step 2: Check Console Logs

Look for these messages:
```
[Cookie Consent] Consent saved: {...}
[Analytics] GA4 consent mode updated: {analytics_storage: 'granted', ad_storage: 'granted'}
[Analytics] GA4 client ID captured: 1234567890.1234567890
```

### Step 3: Verify Consent Mode Update in DataLayer

```javascript
// Check for consent update in dataLayer
window.dataLayer.filter(e => e.consent === 'update' || e.analytics_storage === 'granted')
```

**Expected Result**: Should see an object with:
```javascript
{
  consent: 'update',
  analytics_storage: 'granted',
  ad_storage: 'granted', // or 'denied' if only analytics accepted
  ad_user_data: 'granted',
  ad_personalization: 'granted'
}
```

### Step 4: Verify GTM Loaded

```javascript
// Check if GTM is loaded
console.log('GTM Loaded:', window.GTM_LOADED);
console.log('GTM Script:', document.querySelector('script[src*="googletagmanager.com/gtm.js"]'));
```

**Expected Result**: 
- `GTM_LOADED` should be `true`
- GTM script should be present in DOM

---

## Test 3: Verify GA4 Client ID Capture

### Step 1: Wait for Client ID Capture

After accepting consent, wait 1-2 seconds for GA4 to initialize and client ID to be captured.

### Step 2: Check Client ID in Console

```javascript
// Import and check client ID (if using modules)
// Or check directly:
console.log('GA4 Client ID:', window.__gaClientId); // Won't work - stored in module

// Better: Check via the analytics utility
// Open Network tab, find any API request, check headers
```

### Step 3: Verify Client ID via Network Tab

1. Go to **Network** tab in DevTools
2. Filter by "XHR" or "Fetch"
3. Trigger an API call (e.g., select a product, add to cart, or start checkout)
4. Click on the API request (e.g., `/api/orders`)
5. Go to **Headers** tab
6. Look for **Request Headers**

**Expected Result**: Should see:
```
x-ga-client-id: 1234567890.1234567890
```

**Note**: Client ID format is typically `TIMESTAMP.RANDOM` (e.g., `1705678901.234567890`)

### Step 4: Verify Client ID Capture Function

Open browser console and run:

```javascript
// Check if analytics module is working
// Note: This requires the module to be accessible
// Better to check via Network tab headers
```

---

## Test 4: Verify Analytics Headers on API Requests

### Step 4a: Test with Consent Granted

1. **Accept cookies** (Analytics or Marketing)
2. **Wait 2 seconds** for GA4 to initialize and client ID to be captured
3. **Trigger an API call**:
   - Select a product (triggers product loading)
   - Add to cart (triggers `POST /api/orders`)
   - Add subscription item (triggers `POST /api/orders/{orderId}/items/subscriptions`)
   - Generate payment link (triggers `POST /api/payment/generate-link`)

### Step 4b: Check Request Headers

1. Go to **Network** tab
2. Find the API request (filter by "api" or "orders" or "payment")
3. Click on the request
4. Go to **Headers** tab
5. Scroll to **Request Headers**

**Expected Headers** (when consent granted and authenticated):
```
x-ga-client-id: 1234567890.1234567890
x-ga-user-id: 12345
```

**Expected Headers** (when consent granted but not authenticated):
```
x-ga-client-id: 1234567890.1234567890
```

### Step 4c: Test All Required Endpoints

Test each endpoint that should send analytics headers:

1. **`POST /api/orders`**
   - Action: Add first item to cart
   - Check: Request headers should include `x-ga-client-id`

2. **`POST /api/orders/{orderId}/items/subscriptions`**
   - Action: Add membership to existing order
   - Check: Request headers should include `x-ga-client-id`

3. **`POST /api/orders/{orderId}/items/valuecards`**
   - Action: Add punch card to existing order
   - Check: Request headers should include `x-ga-client-id`

4. **`POST /api/orders/{orderId}/items/articles`**
   - Action: Add add-on to existing order
   - Check: Request headers should include `x-ga-client-id`

5. **`POST /api/payment/generate-link`**
   - Action: Click checkout and proceed to payment
   - Check: Request headers should include `x-ga-client-id` and `x-ga-user-id` (if authenticated)

---

## Test 5: Verify Headers NOT Sent When Consent Denied

### Step 1: Clear Consent

1. Open browser console
2. Run:
```javascript
localStorage.removeItem('boulders_cookie_consent');
location.reload();
```

Or use the cookie settings UI to reject analytics cookies.

### Step 2: Verify Consent Cleared

```javascript
// Check consent
JSON.parse(localStorage.getItem('boulders_cookie_consent') || 'null')
```

**Expected Result**: Should be `null` or have `analytics: false`

### Step 3: Trigger API Call

1. Try to add item to cart or make any API call
2. Go to **Network** tab
3. Check request headers

**Expected Result**: 
- `x-ga-client-id` should **NOT** be present
- `x-ga-user-id` should **NOT** be present

### Step 4: Verify Client ID Cleared

```javascript
// Check console logs
// Should see: [Analytics] GA4 client ID cleared
```

---

## Test 6: Verify Customer ID Header (x-ga-user-id)

### Step 1: Authenticate User

1. Complete login/registration flow
2. Verify user is authenticated (check `state.customer` or `state.customerId`)

### Step 2: Check Customer ID in State

Open browser console:
```javascript
// Check if customer ID is available
console.log('Customer ID:', state.customer?.id || state.customerId);
```

### Step 3: Trigger API Call

1. Make an API call (e.g., create order, generate payment link)
2. Check **Network** tab → **Headers** → **Request Headers**

**Expected Result**: Should see:
```
x-ga-client-id: 1234567890.1234567890
x-ga-user-id: 12345  // Your customer ID
```

### Step 4: Test Without Authentication

1. Log out or clear session
2. Make an API call
3. Check headers

**Expected Result**: 
- `x-ga-client-id` should be present (if consent granted)
- `x-ga-user-id` should **NOT** be present

---

## Test 7: Verify Consent Withdrawal

### Step 1: Accept Consent First

1. Accept analytics cookies
2. Wait for client ID to be captured
3. Verify headers are being sent (Test 4)

### Step 2: Withdraw Consent

1. Open cookie settings
2. Uncheck "Analytics" and "Marketing" cookies
3. Save settings

### Step 3: Verify Client ID Cleared

Check console logs:
```
[Cookie Consent] GTM unloaded
[Analytics] GA4 client ID cleared
```

### Step 4: Verify Headers Not Sent

1. Make an API call
2. Check **Network** tab → **Headers**

**Expected Result**: 
- `x-ga-client-id` should **NOT** be present
- `x-ga-user-id` should **NOT** be present

---

## Test 8: Verify Existing Consent on Page Reload

### Step 1: Accept Consent

1. Accept analytics cookies
2. Wait for client ID capture
3. Note the client ID from Network tab

### Step 2: Reload Page

1. Reload the page (F5 or Cmd+R)
2. **Do NOT** interact with cookie banner

### Step 3: Verify Consent Restored

Check console logs:
```
[Analytics] Analytics utilities initialized
[Analytics] GA4 consent mode updated: {analytics_storage: 'granted', ...}
[Analytics] GA4 client ID captured: 1234567890.1234567890
```

### Step 4: Verify Headers Still Sent

1. Make an API call immediately (without accepting cookies again)
2. Check **Network** tab → **Headers**

**Expected Result**: Headers should be present (consent was restored from localStorage)

---

## Debugging Commands

### Check Current Consent State

```javascript
// Get consent from localStorage
const consent = JSON.parse(localStorage.getItem('boulders_cookie_consent') || 'null');
console.log('Consent:', consent);
```

### Check GA4 Client ID (via Network Tab)

1. Open **Network** tab
2. Make an API call
3. Check request headers for `x-ga-client-id`

### Check DataLayer Events

```javascript
// View all dataLayer events
console.log('DataLayer:', window.dataLayer);

// Filter for consent events
window.dataLayer.filter(e => e.consent || e.analytics_storage);
```

### Check GTM Status

```javascript
console.log('GTM Loaded:', window.GTM_LOADED);
console.log('GTM Container:', window.GTM_CONTAINER_ID);
console.log('GTM Script:', document.querySelector('script[src*="googletagmanager.com/gtm.js"]'));
```

### Check gtag Availability

```javascript
console.log('gtag available:', typeof window.gtag === 'function');
```

### Manually Trigger Client ID Capture

```javascript
// This won't work directly (module scope), but you can check Network tab
// Or check if consent is granted and GTM is loaded
const consent = JSON.parse(localStorage.getItem('boulders_cookie_consent') || 'null');
console.log('Has consent:', consent?.categories?.analytics || consent?.categories?.marketing);
console.log('GTM loaded:', window.GTM_LOADED);
```

---

## Common Issues & Solutions

### Issue: Headers Not Being Sent

**Possible Causes:**
1. Consent not granted → Check localStorage for `boulders_cookie_consent`
2. Client ID not captured → Wait 2-3 seconds after consent, check console logs
3. GA4 not initialized → Check if GTM is loaded, check for errors in console

**Solution:**
```javascript
// Check consent
const consent = JSON.parse(localStorage.getItem('boulders_cookie_consent') || 'null');
console.log('Consent:', consent);

// Check GTM
console.log('GTM Loaded:', window.GTM_LOADED);

// Reload and accept consent again
```

### Issue: Client ID Not Captured

**Possible Causes:**
1. GA4 not loaded yet → Wait longer (2-3 seconds)
2. gtag not available → Check if GTM is loaded correctly
3. Measurement ID mismatch → Verify `G-5LK4VMR8E2` is correct

**Solution:**
- Wait 2-3 seconds after accepting consent
- Check console for `[Analytics] GA4 client ID captured` message
- Check Network tab for GTM script loading

### Issue: Headers Sent But Wrong Values

**Possible Causes:**
1. Customer ID not available → Check `state.customer?.id` or `state.customerId`
2. Client ID is null → Check if consent was granted and GA4 initialized

**Solution:**
```javascript
// Check customer ID
console.log('Customer:', state.customer);
console.log('Customer ID:', state.customer?.id || state.customerId);
```

---

## Automated Testing (Future)

For automated testing, you could:

1. Use Playwright/Puppeteer to:
   - Accept cookies
   - Wait for client ID capture
   - Intercept network requests
   - Verify headers are present

2. Use Cypress to:
   - Test consent flow
   - Verify headers in API calls
   - Test consent withdrawal

---

## Next Steps After Testing

1. **Verify Backend Receives Headers**
   - Check backend logs for `x-ga-client-id` and `x-ga-user-id` headers
   - Verify backend processes these headers correctly

2. **Verify Server-Side Events in GA4**
   - Check GA4 DebugView for server-side events
   - Verify events are stitched with client-side events using client ID

3. **Monitor Production**
   - Check that headers are being sent in production
   - Monitor for any errors in console or network requests

---

## Related Documentation

- `docs/implementation/SERVER_SIDE_ANALYTICS_IMPLEMENTATION.md` - Implementation details
- `docs/TRACKING_DEBUG_GUIDE.md` - General tracking debugging
- `docs/GTM_IMPLEMENTATION.md` - GTM setup
