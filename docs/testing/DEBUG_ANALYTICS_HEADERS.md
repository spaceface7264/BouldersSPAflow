# Debugging: Analytics Headers Not Showing

## Important: Which Requests Have Headers?

Analytics headers (`x-ga-client-id` and `x-ga-user-id`) are **ONLY** added to these funnel endpoints:

✅ **POST** `/api/orders` - Create order  
✅ **POST** `/api/orders/{orderId}/items/subscriptions` - Add membership  
✅ **POST** `/api/orders/{orderId}/items/valuecards` - Add punch card  
✅ **POST** `/api/orders/{orderId}/items/articles` - Add add-on  
✅ **POST** `/api/payment/generate-link` - Generate payment link  

❌ **GET** `/api/products/valuecards` - **NO headers** (just loading products)  
❌ **GET** `/api/products/subscriptions` - **NO headers** (just loading products)  
❌ Any other GET requests - **NO headers**

---

## Step 1: Verify Cookie Consent

Open browser console and run:

```javascript
// Check if consent is granted
const consent = JSON.parse(localStorage.getItem('boulders_cookie_consent') || 'null');
console.log('Consent:', consent);
console.log('Has Analytics:', consent?.categories?.analytics);
console.log('Has Marketing:', consent?.categories?.marketing);
```

**Expected**: Should show `analytics: true` or `marketing: true`

**If not granted**: Accept cookies first!

---

## Step 2: Verify GA4 Client ID Captured

Open browser console and run:

```javascript
// Check if GTM is loaded
console.log('GTM Loaded:', window.GTM_LOADED);

// Check if gtag is available
console.log('gtag available:', typeof window.gtag === 'function');

// Try to get client ID manually
if (window.gtag) {
  window.gtag('get', 'G-5LK4VMR8E2', 'client_id', (clientId) => {
    console.log('GA4 Client ID:', clientId);
  });
} else {
  console.log('gtag not available - GTM may not be loaded yet');
}
```

**Expected**: Should show a client ID like `1234567890.1234567890`

**If null/undefined**: 
- Wait 2-3 seconds after accepting cookies
- Check console for `[Analytics] GA4 client ID captured` message
- Verify GTM is loaded

---

## Step 3: Test with Correct Endpoint

You need to trigger a **POST** request to see headers. Try:

1. **Add item to cart** (creates order - POST /api/orders)
2. **Add membership to order** (POST /api/orders/{orderId}/items/subscriptions)
3. **Click checkout** (POST /api/payment/generate-link)

### How to Test:

1. **Open Network tab** → Filter by "XHR" or "Fetch"
2. **Accept cookies** (if not already accepted)
3. **Wait 2-3 seconds** for GA4 to initialize
4. **Add a product to cart** (this triggers POST /api/orders)
5. **Click on the POST request** to `/api/orders` or `/api-proxy?path=/api/orders`
6. **Check Request Headers** for `x-ga-client-id`

---

## Step 4: Check Console Logs

Look for these messages in browser console:

```
[Analytics] Analytics utilities initialized
[Analytics] GA4 consent mode updated: {analytics_storage: 'granted', ...}
[Analytics] GA4 client ID captured: 1234567890.1234567890
```

If you don't see these:
- Consent may not be granted
- GTM may not be loaded
- GA4 may not be initialized

---

## Step 5: Manual Test - Check Headers Function

Open browser console and run:

```javascript
// Import the function (if using modules)
// Or check via Network tab after triggering a POST request

// Check what headers would be generated
// Note: This requires the analytics module to be accessible
// Better to check via Network tab on actual POST request
```

**Better approach**: Check Network tab on a POST request to see actual headers.

---

## Step 6: Verify Implementation

Check that analytics headers are being added. In Network tab:

1. **Trigger a POST request** (add to cart, checkout, etc.)
2. **Click on the request**
3. **Go to Headers tab**
4. **Scroll to Request Headers**
5. **Look for**:
   - `x-ga-client-id: 1234567890.1234567890`
   - `x-ga-user-id: 12345` (if authenticated)

---

## Common Issues

### Issue 1: Headers Not on GET Requests

**Symptom**: Looking at GET `/api/products/valuecards` - no headers

**Solution**: This is expected! Headers are only on POST funnel endpoints. Test with adding to cart or checkout.

### Issue 2: Consent Not Granted

**Symptom**: No headers even on POST requests

**Solution**: 
1. Accept cookies (Analytics or Marketing)
2. Wait 2-3 seconds
3. Try again

### Issue 3: Client ID Not Captured

**Symptom**: Consent granted but no `x-ga-client-id` header

**Solution**:
1. Check console for `[Analytics] GA4 client ID captured` message
2. Wait longer (3-5 seconds) for GA4 to initialize
3. Check if GTM is loaded: `console.log(window.GTM_LOADED)`
4. Check if gtag is available: `console.log(typeof window.gtag)`

### Issue 4: Headers on Proxy Requests

**Symptom**: Request goes through `/api-proxy?path=...` and headers not visible

**Solution**: 
- Headers should still be in Request Headers
- Check the actual request, not the proxy URL
- Headers are sent to the proxy, which forwards them to the API

---

## Quick Test Checklist

- [ ] Cookies accepted (Analytics or Marketing)
- [ ] Waited 2-3 seconds after accepting
- [ ] Testing with POST request (not GET)
- [ ] POST request is to funnel endpoint (orders, payment, etc.)
- [ ] Checked Request Headers (not Response Headers)
- [ ] Console shows `[Analytics] GA4 client ID captured`

---

## Still Not Working?

1. **Clear everything and start fresh**:
   ```javascript
   localStorage.removeItem('boulders_cookie_consent');
   location.reload();
   ```

2. **Accept cookies again**

3. **Wait 5 seconds** for everything to initialize

4. **Add item to cart** (triggers POST /api/orders)

5. **Check Network tab** → POST request → Headers → Request Headers

6. **Look for** `x-ga-client-id` header

If still not working, check:
- Browser console for errors
- Network tab for failed requests
- GTM Preview mode to verify GTM is working
