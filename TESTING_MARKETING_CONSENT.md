# Testing Marketing Email Consent

## 🧪 How to Verify Marketing Consent is Sent to API

This guide helps you verify that the marketing email consent checkbox value is correctly captured and sent to the API.

---

## 📋 Test Steps

### 1. Open Browser DevTools
1. Open your browser (Chrome/Firefox/Edge)
2. Press `F12` or `Cmd+Option+I` (Mac) to open DevTools
3. Go to the **Console** tab
4. Go to the **Network** tab (keep it open)

### 2. Navigate to Signup Form
1. Go to the signup page
2. Fill out the form until you reach Step 4 (Info/Account step)
3. You should see two checkboxes:
   - ☐ I accept the Terms and Conditions (required)
   - ☑ I want to receive marketing emails (pre-checked by default)

### 3. Test Marketing Consent Checkbox

#### Test Case 1: Marketing Consent CHECKED (Default)
1. **Verify checkbox is checked** - The marketing consent checkbox should be checked by default
2. **Check console logs** - You should see:
   ```
   [checkout] ===== MARKETING CONSENT CHECK =====
   [checkout] Marketing consent checkbox value: true
   [checkout] Marketing consent checkbox checked: true
   [checkout] Marketing consent in payload: { terms: true, marketing: true }
   [checkout] Marketing consent in customerData (allowMassSendEmail): true
   ```
3. **Complete checkout** - Fill out the form and click checkout
4. **Check Network tab** - Look for `POST /api/customers` request
5. **Verify request payload** - In the Network tab, click on the request and check the **Payload** tab:
   ```json
   {
     "customer": {
       "email": "user@example.com",
       "firstName": "John",
       "lastName": "Doe",
       ...
       "allowMassSendEmail": true
     }
   }
   ```

#### Test Case 2: Marketing Consent UNCHECKED
1. **Uncheck the marketing consent checkbox**
2. **Check console logs** - You should see:
   ```
   [checkout] Marketing consent checkbox value: false
   [checkout] Marketing consent checkbox checked: false
   [checkout] Marketing consent in payload: { terms: true, marketing: false }
   [checkout] Marketing consent in customerData (allowMassSendEmail): false
   ```
3. **Complete checkout** - Fill out the form and click checkout
4. **Check Network tab** - Verify `allowMassSendEmail: false` in the request payload

---

## 🔍 Verification Methods

### Method 1: Browser Console Logs

During checkout, watch for these specific log messages:

```
[checkout] ===== MARKETING CONSENT CHECK =====
[checkout] Marketing consent checkbox value: true/false
[checkout] Marketing consent checkbox checked: true/false
[checkout] Marketing consent in payload: { terms: true, marketing: true/false }
[checkout] Marketing consent in customerData (allowMassSendEmail): true/false
[checkout] ===== END MARKETING CONSENT CHECK =====
```

And in the API call:
```
[Step 6] Marketing consent (allowMassSendEmail) in request: true/false
```

### Method 2: Network Tab Inspection

1. Open **Network** tab in DevTools
2. Filter by `customers` or `api`
3. Find the `POST /api/customers` request
4. Click on it to view details
5. Go to **Payload** or **Request** tab
6. Look for `allowMassSendEmail` field in the JSON payload

**Expected Payload Structure:**
```json
{
  "customer": {
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    ...
    "allowMassSendEmail": true  // ← This field should be present
  }
}
```

### Method 3: Manual Console Check

You can manually check the checkbox state in the console:

```javascript
// Check current checkbox state
const marketingCheckbox = document.getElementById('marketingConsent');
console.log('Marketing checkbox checked:', marketingCheckbox?.checked);

// Check what will be sent in payload
const payload = buildCheckoutPayload();
console.log('Marketing consent in payload:', payload.consent?.marketing);
```

### Method 4: Verify API Response

After customer creation, check the API response:

1. In **Network** tab, find `POST /api/customers` request
2. Click on it and go to **Response** tab
3. Verify the customer was created successfully
4. Check if the response includes the `allowMassSendEmail` field (if API returns it)

---

## ✅ Success Indicators

### ✅ Marketing Consent is Working If:

1. **Console logs show correct values:**
   - `Marketing consent checkbox value: true` (when checked)
   - `Marketing consent checkbox value: false` (when unchecked)
   - `Marketing consent in customerData (allowMassSendEmail): true/false`

2. **Network request includes the field:**
   - `allowMassSendEmail: true` appears in request payload when checked
   - `allowMassSendEmail: false` appears in request payload when unchecked

3. **API accepts the request:**
   - `POST /api/customers` returns `200` or `201` status
   - No validation errors about missing or invalid `allowMassSendEmail`

### ❌ Marketing Consent is NOT Working If:

1. **Console logs show:**
   - `Marketing consent in customerData (allowMassSendEmail): undefined`
   - No marketing consent logs appear

2. **Network request missing the field:**
   - `allowMassSendEmail` field is not present in the request payload

3. **API errors:**
   - Validation errors about `allowMassSendEmail` field
   - Field type errors

---

## 🐛 Troubleshooting

### Issue: Marketing consent not appearing in payload

**Check:**
1. Is the checkbox element present? 
   ```javascript
   document.getElementById('marketingConsent')
   ```
2. Does it have the correct `data-api-field` attribute?
   ```javascript
   document.getElementById('marketingConsent')?.dataset.apiField
   // Should return: "consent.marketing"
   ```
3. Is `buildCheckoutPayload()` being called?
   - Check console for `[checkout] Full payload:` log

### Issue: Marketing consent always undefined

**Possible causes:**
1. Checkbox not found by `buildCheckoutPayload()`
2. `data-api-field` attribute missing or incorrect
3. Checkbox not in the DOM when payload is built

**Fix:**
- Verify checkbox HTML has: `data-api-field="consent.marketing"`
- Verify checkbox is inside the form that's being processed

### Issue: API rejects allowMassSendEmail

**Check:**
1. Is the field name correct? (should be `allowMassSendEmail`)
2. Is the value a boolean? (should be `true` or `false`, not string)
3. Check API documentation for correct field name/type

---

## 📊 Quick Test Checklist

- [ ] Marketing consent checkbox is visible on the form
- [ ] Checkbox is checked by default
- [ ] Console shows marketing consent logs during checkout
- [ ] Network request includes `allowMassSendEmail` field
- [ ] Field value matches checkbox state (true when checked, false when unchecked)
- [ ] API accepts the request without errors
- [ ] Works when checkbox is checked
- [ ] Works when checkbox is unchecked

---

## 🔧 Debug Commands

Paste these in browser console to debug:

```javascript
// Check checkbox state
const checkbox = document.getElementById('marketingConsent');
console.log('Checkbox exists:', !!checkbox);
console.log('Checkbox checked:', checkbox?.checked);
console.log('Checkbox data-api-field:', checkbox?.dataset.apiField);

// Check payload building
const payload = buildCheckoutPayload();
console.log('Full payload:', payload);
console.log('Consent in payload:', payload.consent);
console.log('Marketing consent:', payload.consent?.marketing);

// Simulate checkout to see what would be sent
const customerData = {
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  ...(payload.consent?.marketing !== undefined && { allowMassSendEmail: payload.consent.marketing })
};
console.log('Customer data that would be sent:', customerData);
console.log('allowMassSendEmail in customerData:', customerData.allowMassSendEmail);
```

---

## 📝 Notes

- Marketing consent checkbox is **pre-checked by default** (opt-out model)
- Field name sent to API: `allowMassSendEmail` (boolean)
- Field is only included if checkbox value is defined (not undefined)
- If checkbox is unchecked, `allowMassSendEmail: false` will be sent

