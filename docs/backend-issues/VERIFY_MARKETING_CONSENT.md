# How to Verify Marketing Consent Functionality

## 🧪 Quick Verification Steps

### Step 1: Open Browser DevTools
1. Open your browser (Chrome/Firefox/Edge)
2. Press `F12` or `Cmd+Option+I` (Mac) to open DevTools
3. Go to **Console** tab
4. Go to **Network** tab (keep both tabs open)

### Step 2: Navigate to Signup Form
1. Go to your signup page (local: `http://localhost:5173` or production URL)
2. Fill out the form:
   - Select a gym
   - Select a membership plan
   - Fill in personal information
   - **Notice the marketing consent checkbox** - it should be **checked by default**

### Step 3: Test Case 1 - Marketing Consent CHECKED (Default)

#### A. Verify Checkbox State
```javascript
// In browser console, run:
document.getElementById('marketingConsent')?.checked
// Should return: true
```

#### B. Complete Checkout
1. Fill out all required fields
2. Click checkout/submit button
3. **Watch the Console tab** for these logs:

**Expected Console Output:**
```
[checkout] Creating customer...
[checkout] Full payload: {
  "consent": {
    "terms": true,
    "marketing": true    ← Should be true
  },
  ...
}
[checkout] Customer data before cleanup: {
  ...
  "allowMassSendEmail": true    ← Should be present and true
}
[checkout] Marketing consent (allowMassSendEmail): true
[checkout] Customer data prepared: {
  ...
  "allowMassSendEmail": true    ← Should still be present after cleanup
}
[Step 6] Creating customer: /api/customers
[Step 6] Customer data being sent: {
  "customer": {
    ...
    "allowMassSendEmail": true    ← Should be in the API request
  }
}
```

#### C. Check Network Tab
1. In **Network** tab, filter by `customers` or `api`
2. Find the `POST /api/customers` request
3. Click on it
4. Go to **Payload** or **Request** tab
5. Look for `allowMassSendEmail` in the JSON

**Expected Payload:**
```json
{
  "customer": {
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    ...
    "allowMassSendEmail": true    ← MUST be present
  }
}
```

### Step 4: Test Case 2 - Marketing Consent UNCHECKED

#### A. Uncheck the Marketing Consent Checkbox
1. Scroll to the consent section
2. **Uncheck** the "I want to receive marketing emails" checkbox
3. Verify it's unchecked:
```javascript
// In browser console:
document.getElementById('marketingConsent')?.checked
// Should return: false
```

#### B. Complete Checkout Again
1. Fill out the form again (or refresh and start over)
2. **Uncheck** the marketing consent checkbox
3. Complete checkout
4. **Watch Console logs:**

**Expected Console Output:**
```
[checkout] Full payload: {
  "consent": {
    "terms": true,
    "marketing": false    ← Should be false
  },
  ...
}
[checkout] Customer data before cleanup: {
  ...
  "allowMassSendEmail": false    ← Should be false
}
[checkout] Marketing consent (allowMassSendEmail): false
[checkout] Customer data prepared: {
  ...
  "allowMassSendEmail": false    ← Should still be false after cleanup
}
[Step 6] Customer data being sent: {
  "customer": {
    ...
    "allowMassSendEmail": false    ← Should be false in API request
  }
}
```

#### C. Verify in Network Tab
- Check the `POST /api/customers` request payload
- Should see: `"allowMassSendEmail": false`

---

## ✅ Success Criteria

### Marketing Consent is Working If:

1. ✅ **Checkbox is checked by default** when page loads
2. ✅ **Console shows `marketing: true`** in payload when checked
3. ✅ **Console shows `allowMassSendEmail: true`** in customerData when checked
4. ✅ **Network request includes `allowMassSendEmail: true`** when checked
5. ✅ **Console shows `marketing: false`** in payload when unchecked
6. ✅ **Console shows `allowMassSendEmail: false`** in customerData when unchecked
7. ✅ **Network request includes `allowMassSendEmail: false`** when unchecked
8. ✅ **API accepts the request** (returns 200/201, no validation errors)

---

## 🔍 Detailed Verification Methods

### Method 1: Console Logs (Easiest)

**What to look for:**
1. `[checkout] Full payload:` - Check `consent.marketing` value
2. `[checkout] Customer data before cleanup:` - Check `allowMassSendEmail` value
3. `[checkout] Marketing consent (allowMassSendEmail):` - Quick reference log
4. `[Step 6] Customer data being sent:` - Final payload sent to API

**Quick Check:**
```javascript
// After checkout starts, check the logs for:
// - "allowMassSendEmail": true (when checked)
// - "allowMassSendEmail": false (when unchecked)
```

### Method 2: Network Tab Inspection (Most Reliable)

1. Open **Network** tab before checkout
2. Complete checkout
3. Find `POST /api/customers` request
4. Click on it → **Payload** tab
5. Expand the JSON to see the `customer` object
6. Verify `allowMassSendEmail` field exists with correct value

**Screenshot Checklist:**
- [ ] Request shows `POST /api/customers`
- [ ] Status is `200` or `201`
- [ ] Payload contains `"allowMassSendEmail": true/false`
- [ ] No validation errors in response

### Method 3: Manual Console Testing

**Before checkout, test the payload building:**
```javascript
// Get the current payload
const payload = buildCheckoutPayload();

// Check marketing consent
console.log('Marketing consent:', payload.consent?.marketing);
console.log('Full consent object:', payload.consent);

// Check what will be sent to API
const customerData = {
  email: payload.customer?.email,
  firstName: payload.customer?.firstName,
  // ... other fields ...
  ...(payload.consent?.marketing !== undefined && { 
    allowMassSendEmail: payload.consent.marketing 
  }),
};

console.log('allowMassSendEmail will be:', customerData.allowMassSendEmail);
```

### Method 4: Check API Response

After customer creation, verify the API response:

1. In **Network** tab, find `POST /api/customers`
2. Go to **Response** tab
3. Check if the created customer includes marketing consent info
4. Some APIs return the created customer object with all fields

---

## 🐛 Troubleshooting

### Issue: `allowMassSendEmail` is undefined in logs

**Check:**
```javascript
// Is checkbox present?
document.getElementById('marketingConsent')

// Does it have the correct attribute?
document.getElementById('marketingConsent')?.dataset.apiField
// Should return: "consent.marketing"

// Is it checked?
document.getElementById('marketingConsent')?.checked
```

**Fix:** Ensure checkbox has `data-api-field="consent.marketing"` attribute

### Issue: `allowMassSendEmail` missing from API request

**Check:**
1. Is `payload.consent.marketing` defined?
   ```javascript
   const payload = buildCheckoutPayload();
   console.log('consent.marketing:', payload.consent?.marketing);
   ```

2. Is the spread operator working?
   - Check console for `[checkout] Customer data before cleanup:` log
   - Should show `allowMassSendEmail` field

**Fix:** Verify the spread operator syntax is correct

### Issue: API rejects `allowMassSendEmail`

**Check:**
1. Is the field name correct? (should be `allowMassSendEmail`)
2. Is the value a boolean? (should be `true` or `false`, not string `"true"`)
3. Check API documentation for correct field name/type

**Fix:** Verify API expects `allowMassSendEmail` (boolean)

---

## 📊 Quick Test Checklist

Run through this checklist:

- [ ] Marketing consent checkbox is visible on form
- [ ] Checkbox is **checked by default**
- [ ] Can uncheck the checkbox
- [ ] Console shows `consent.marketing: true` when checked
- [ ] Console shows `consent.marketing: false` when unchecked
- [ ] Console shows `allowMassSendEmail: true` in customerData when checked
- [ ] Console shows `allowMassSendEmail: false` in customerData when unchecked
- [ ] Network request includes `allowMassSendEmail: true` when checked
- [ ] Network request includes `allowMassSendEmail: false` when unchecked
- [ ] API accepts request with `allowMassSendEmail: true` (no errors)
- [ ] API accepts request with `allowMassSendEmail: false` (no errors)

---

## 🎯 Quick Verification Commands

Paste these in browser console to quickly verify:

```javascript
// 1. Check checkbox state
const checkbox = document.getElementById('marketingConsent');
console.log('Checkbox exists:', !!checkbox);
console.log('Checkbox checked:', checkbox?.checked);
console.log('Checkbox data-api-field:', checkbox?.dataset.apiField);

// 2. Check what will be in payload
const payload = buildCheckoutPayload();
console.log('Marketing consent in payload:', payload.consent?.marketing);

// 3. Simulate customerData creation
const customerData = {
  email: 'test@example.com',
  firstName: 'Test',
  ...(payload.consent?.marketing !== undefined && { 
    allowMassSendEmail: payload.consent.marketing 
  }),
};
console.log('allowMassSendEmail would be:', customerData.allowMassSendEmail);
console.log('Full customerData:', customerData);
```

---

## 📝 Expected Behavior Summary

| Checkbox State | `payload.consent.marketing` | `customerData.allowMassSendEmail` | API Request |
|---------------|---------------------------|----------------------------------|-------------|
| ✅ Checked (default) | `true` | `true` | `"allowMassSendEmail": true` |
| ☐ Unchecked | `false` | `false` | `"allowMassSendEmail": false` |

---

## 🎬 Step-by-Step Video Guide (Text Version)

1. **Open DevTools** → Console + Network tabs
2. **Load signup page** → See checkbox checked by default
3. **Fill form** → Complete all required fields
4. **Watch Console** → See marketing consent logs
5. **Click Checkout** → Trigger customer creation
6. **Check Network** → Find `POST /api/customers` request
7. **Verify Payload** → See `allowMassSendEmail: true` in request
8. **Check Response** → API should return success (200/201)
9. **Repeat with unchecked** → Verify `allowMassSendEmail: false` is sent

---

## 💡 Pro Tips

1. **Use Network tab filtering**: Type `customers` in the filter box to quickly find the request
2. **Save Network logs**: Right-click → "Save all as HAR" to save for later review
3. **Use Console filtering**: Type `marketing` or `allowMassSendEmail` to filter logs
4. **Check both states**: Always test with checkbox checked AND unchecked

