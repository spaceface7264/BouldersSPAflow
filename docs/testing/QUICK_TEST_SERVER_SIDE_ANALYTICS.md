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
1. **Add item to cart** (or any action that triggers API)
2. Look for API request in Network tab (e.g., `/api/orders`)

### Step 4: Check Headers
1. Click on the API request
2. Go to **Headers** tab
3. Scroll to **Request Headers**
4. Look for:
   - ✅ `x-ga-client-id: 1234567890.1234567890`
   - ✅ `x-ga-user-id: 12345` (if authenticated)

### ✅ Success!
If you see `x-ga-client-id` header → **It's working!**

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
