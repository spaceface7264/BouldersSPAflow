# Quick Test: Server-Side Analytics

## 5-Minute Test

### Step 1: Open DevTools
1. Open your test page
2. Press **F12** (or Cmd+Option+I on Mac)
3. Go to **Network** tab
4. Filter by **XHR** or **Fetch**

### Step 2: Accept Cookies
1. Click **"Accept All"** or accept Analytics cookies
2. Wait 2-3 seconds (for GA4 to initialize)

### Step 3: Trigger API Call
1. **Add item to cart** (this triggers **POST** `/api/orders`)
   - ⚠️ **Important**: Headers only appear on **POST** requests (funnel endpoints)
   - ❌ **NOT** on GET requests like `/api/products/valuecards`
2. Look for **POST** request in Network tab (e.g., `/api/orders` or `/api-proxy?path=/api/orders`)

### Step 4: Check Headers
1. Click on the API request
2. Go to **Headers** tab
3. Scroll to **Request Headers**
4. Look for:
   - ✅ `x-ga-client-id: 1234567890.1234567890`
   - ✅ `x-ga-user-id: 12345` (if authenticated)

### ✅ Success!
If you see `x-ga-client-id` header → **It's working!**

### ⚠️ Not Seeing Headers?

**Check these:**
1. **Are you testing a POST request?** (Headers only on POST, not GET)
2. **Did you accept cookies?** (Check console: `localStorage.getItem('boulders_cookie_consent')`)
3. **Did you wait 2-3 seconds?** (GA4 needs time to initialize)
4. **Is it a funnel endpoint?** (orders, payment, items - not products)

See `DEBUG_ANALYTICS_HEADERS.md` for detailed troubleshooting.

---

## Console Commands

### Check Consent
```javascript
JSON.parse(localStorage.getItem('boulders_cookie_consent') || 'null')
```

### Check DataLayer
```javascript
window.dataLayer.filter(e => e.consent || e.analytics_storage)
```

### Check GTM Status
```javascript
console.log('GTM Loaded:', window.GTM_LOADED);
```

---

## Test Without Consent

1. **Clear consent**: `localStorage.removeItem('boulders_cookie_consent'); location.reload();`
2. **Trigger API call**
3. **Check headers** → Should **NOT** see `x-ga-client-id`

---

## Full Testing Guide

See `TESTING_SERVER_SIDE_ANALYTICS.md` for comprehensive testing instructions.
