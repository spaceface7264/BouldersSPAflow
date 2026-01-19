# Security Testing Guide

This guide helps you test the security improvements made to the API proxy and XSS protection.

## Prerequisites

1. **Deploy the changes** to Cloudflare Pages (or use local dev server)
2. **Open browser DevTools** (F12) - Console and Network tabs
3. **Have the production/preview URL** ready

---

## Test 1: CORS Origin Validation ✅

**Purpose:** Verify that unknown origins are rejected

### Important Note:
Browsers **cannot** set the `Origin` header manually - it's automatically set by the browser based on the actual page origin. To test invalid origins, you need to use `curl` or check server logs.

### Test Steps:

1. **Test valid origin (from browser console):**
```javascript
// Test 1: Valid origin (should work from your actual domain)
fetch('/api-proxy?path=/api/reference/business-units')
  .then(r => {
    console.log('Status:', r.status);
    return r.json();
  })
  .then(data => {
    console.log('✅ Valid origin test:', data);
    console.log('Response headers:', [...r.headers.entries()]);
  })
  .catch(e => console.error('❌ Valid origin failed:', e));
```

2. **Test invalid origin (use curl or check server logs):**
```bash
# Run this in terminal (not browser console)
curl -v "https://your-preview-url.pages.dev/api-proxy?path=/api/reference/business-units" \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json"
```

3. **Check response status and headers:**
```javascript
// Check CORS headers on valid request
fetch('/api-proxy?path=/api/reference/business-units')
  .then(r => {
    console.log('CORS Headers:');
    console.log('Access-Control-Allow-Origin:', r.headers.get('Access-Control-Allow-Origin'));
    console.log('X-Content-Type-Options:', r.headers.get('X-Content-Type-Options'));
    console.log('Status:', r.status);
    return r.json();
  });
```

**Expected Results:**
- ✅ Valid origin: Request succeeds (200 or API response)
- ✅ CORS headers present: `Access-Control-Allow-Origin` matches your origin
- ✅ Invalid origin (tested via curl): Returns 403 with `{ error: 'Origin not allowed' }`
- ✅ Check Cloudflare logs: Should see `[API Proxy] Rejected request from unknown origin: https://evil.com`

---

## Test 2: DOMPurify Style Attribute Removal ✅

**Purpose:** Verify that `style` attributes are stripped to prevent CSS XSS

### Test Steps:

1. **Open browser console**
2. **Run this test:**
```javascript
// Test that style attributes are removed
const maliciousHTML = '<div style="background: url(javascript:alert(\'XSS\'))">Test</div>';
const sanitized = window.sanitizeHTML(maliciousHTML);
console.log('Original:', maliciousHTML);
console.log('Sanitized:', sanitized);
console.log('Style removed?', !sanitized.includes('style=') ? '✅ YES' : '❌ NO');
```

**Expected Results:**
- ✅ `style` attribute should be completely removed from output
- ✅ No `style=` should appear in sanitized HTML

---

## Test 3: Error Message Sanitization ✅

**Purpose:** Verify that error messages don't leak internal details

### Test Steps:

1. **Trigger an error** by making an invalid API request:
```javascript
// This should cause an error but not expose internal details
fetch('/api-proxy?path=/api/invalid-endpoint-that-does-not-exist')
  .then(r => r.json())
  .then(data => {
    console.log('Error response:', data);
    // Check that error.message is NOT present
    if (data.message && data.message.includes('stack') || data.message.includes('Error:')) {
      console.log('❌ ERROR: Internal details leaked!');
    } else {
      console.log('✅ Error message is sanitized');
    }
  });
```

**Expected Results:**
- ✅ Error response should only contain generic `{ error: 'Internal server error' }`
- ✅ No stack traces, file paths, or internal error details
- ✅ Check server logs (Cloudflare dashboard) - full error details should be there

---

## Test 4: Request Size Limits ✅

**Purpose:** Verify that large requests are rejected

### Test Steps:

1. **Create a large payload** (over 1MB):
```javascript
// Create a 2MB string
const largePayload = 'x'.repeat(2 * 1024 * 1024);

fetch('/api-proxy?path=/api/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Origin': window.location.origin
  },
  body: JSON.stringify({ data: largePayload })
})
  .then(r => r.json())
  .then(data => {
    if (data.error === 'Request body too large') {
      console.log('✅ Request size limit working:', data);
    } else {
      console.log('❌ Request size limit not working');
    }
  })
  .catch(e => console.log('Request failed (expected):', e));
```

**Expected Results:**
- ✅ Request should be rejected with 413 status
- ✅ Error message: `{ error: 'Request body too large' }`

---

## Test 5: CSP unsafe-eval Removal ✅

**Purpose:** Verify CSP doesn't allow eval()

### Test Steps:

1. **Check CSP header** in Network tab:
   - Open DevTools → Network tab
   - Reload page
   - Click on the main document request
   - Check Response Headers
   - Look for `Content-Security-Policy` header

2. **Verify unsafe-eval is NOT present:**
```javascript
// In console, check if eval is blocked
try {
  eval('console.log("test")');
  console.log('❌ eval() is allowed (should be blocked by CSP)');
} catch (e) {
  console.log('✅ eval() is blocked by CSP:', e.message);
}
```

**Expected Results:**
- ✅ CSP header should NOT contain `unsafe-eval`
- ✅ `eval()` should be blocked (may show CSP violation in console)

---

## Test 6: XSS Protection (DOMPurify) ✅

**Purpose:** Verify XSS attacks are prevented

### Test Steps:

1. **Use the existing test file** (if available):
   - Navigate to `/test-xss.html` on your deployment
   - Or run these tests in console:

```javascript
// Test various XSS payloads
const xssTests = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror="alert(\'XSS\')">',
  '<iframe src="javascript:alert(\'XSS\')"></iframe>',
  '<div onclick="alert(\'XSS\')">Click</div>',
  '<svg onload="alert(\'XSS\')">',
  '<body onload="alert(\'XSS\')">'
];

xssTests.forEach((payload, i) => {
  const sanitized = window.sanitizeHTML(payload);
  const safe = !sanitized.includes('<script') && 
               !sanitized.includes('onerror') &&
               !sanitized.includes('onload') &&
               !sanitized.includes('onclick') &&
               !sanitized.includes('javascript:');
  
  console.log(`Test ${i + 1}: ${safe ? '✅ PASS' : '❌ FAIL'}`, {
    input: payload,
    output: sanitized
  });
});
```

**Expected Results:**
- ✅ All XSS payloads should be sanitized
- ✅ No `<script>` tags in output
- ✅ No event handlers (`onerror`, `onload`, `onclick`) in output
- ✅ No `javascript:` URLs in output

---

## Test 7: Real-World Integration Test ✅

**Purpose:** Verify the app still works normally with security improvements

### Test Steps:

1. **Go through the signup flow:**
   - Select a gym
   - Choose membership type
   - Fill in personal information
   - Review and complete payment

2. **Check for errors:**
   - Open Console tab - should see no security-related errors
   - Check Network tab - API requests should work normally
   - Verify CORS headers are present on API responses

3. **Verify security headers:**
   - In Network tab, check any API response
   - Should see:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Access-Control-Allow-Origin: <your-origin>`

**Expected Results:**
- ✅ Signup flow completes successfully
- ✅ No console errors related to CORS or CSP
- ✅ Security headers present on all responses

---

## Test 8: Server-Side Logging ✅

**Purpose:** Verify errors are logged server-side (Cloudflare dashboard)

### Test Steps:

1. **Trigger an error** (use Test 3)
2. **Check Cloudflare dashboard:**
   - Go to Workers & Pages → Your site → Logs
   - Look for error logs with full details
   - Should see: `[API Proxy] Error details: { message, stack, name }`

**Expected Results:**
- ✅ Full error details visible in server logs
- ✅ Client receives generic error message
- ✅ No sensitive information in client responses

---

## Quick Test Checklist

Run through this checklist after deployment:

- [ ] CORS rejects unknown origins (Test 1)
- [ ] DOMPurify removes style attributes (Test 2)
- [ ] Error messages don't leak details (Test 3)
- [ ] Large requests are rejected (Test 4)
- [ ] CSP doesn't allow unsafe-eval (Test 5)
- [ ] XSS payloads are sanitized (Test 6)
- [ ] App works normally (Test 7)
- [ ] Server logs contain full error details (Test 8)

---

## Troubleshooting

### If CORS tests fail:
- Check that you're testing from an allowed origin
- Verify the Origin header is being sent correctly
- Check browser console for CORS errors

### If XSS tests fail:
- Verify DOMPurify is loaded: `typeof window.sanitizeHTML === 'function'`
- Check that sanitize.js is imported correctly
- Verify DOMPurify version in package.json

### If CSP tests show violations:
- Check browser console for CSP violation reports
- Verify CSP header is being set correctly in _headers file
- Some violations are expected (GTM inline scripts) - these are documented

---

## Next Steps After Testing

1. **If all tests pass:** Merge to main branch and deploy to production
2. **If tests fail:** Check the specific test output and review the implementation
3. **Monitor:** Set up alerts for security-related errors in production

---

## Additional Security Headers Verification

You can also use online tools to verify security headers:

1. **securityheaders.com** - Scan your production URL
2. **Mozilla Observatory** - Comprehensive security scan
3. **SSL Labs** - SSL/TLS configuration check

Expected grade: **A** or **A+** after these improvements.
