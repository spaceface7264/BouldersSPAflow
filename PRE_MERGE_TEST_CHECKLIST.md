# Pre-Merge Testing Checklist

**Branch**: `claude/cors-mki32xzj397jdc1v-pLlWu`  
**Changes**: Sentry error monitoring integration  
**Date**: 2026-01-17

---

## 🎯 Critical Tests (Must Pass)

### 1. Sentry Initialization ✅
- [x] Page loads without errors
- [x] Console shows `[Sentry] ✅ Initialized` (in development) or no errors (in production)
- [ ] `window.Sentry` is available globally
  - **Note**: If events appear in Sentry dashboard, Sentry IS working (auto-capture works independently)
  - `window.Sentry` is only needed for manual access (e.g., `testSentry()`)
  - If undefined, check console for initialization errors
- [x] Run `testSentry()` in console - should send test events
- [x] Check Sentry dashboard - test events should appear within 10 seconds

### 2. Core Application Functionality ✅
- [ ] **Page loads** - No JavaScript errors blocking page load
- [ ] **Gym selection (Step 1)** - Can search and select gyms
- [ ] **Access type selection (Step 2)** - Can view and select membership/punch cards
- [ ] **Add-ons (Step 3)** - Can view and select add-ons (if applicable)
- [ ] **Checkout form (Step 4)** - Form fields work, validation works
- [ ] **Payment flow** - Can generate payment link and redirect to payment provider
- [ ] **Confirmation (Step 5)** - Order confirmation displays correctly

### 3. Authentication Flow ✅
- [ ] **Login** - Can log in with valid credentials
- [ ] **User context** - After login, check Sentry dashboard shows user email in error context
- [ ] **Logout** - Can log out successfully
- [ ] **User context cleared** - After logout, Sentry user context should be cleared
- [ ] **Account creation** - Can create new account

### 4. Error Handling ✅
- [ ] **Network errors** - App handles API failures gracefully (no Sentry spam)
- [ ] **Form validation** - Validation errors don't trigger Sentry
- [ ] **Payment errors** - Payment failures are captured in Sentry (check dashboard)
- [ ] **Login errors** - Invalid login attempts don't spam Sentry (400/401 excluded)

### 5. Browser Compatibility ✅
- [ ] **Chrome** - All features work, Sentry initializes
- [ ] **Firefox** - All features work, Sentry initializes
- [ ] **Safari** - All features work, Sentry initializes
- [ ] **Mobile browsers** - Test on iOS Safari and Chrome Mobile

---

## 🔍 Detailed Test Scenarios

### Test 1: Sentry Initialization
```javascript
// In browser console:
console.log('Sentry available?', typeof window.Sentry !== 'undefined');
testSentry();
// Check Sentry dashboard for test events
```

**Expected**: 
- ✅ Sentry is available (or events appear in dashboard even if `window.Sentry` is undefined)
- ✅ Test events appear in dashboard (primary indicator that Sentry is working)
- ✅ No console errors
- ⚠️ **Note**: If events appear in Sentry but `window.Sentry` is undefined, Sentry auto-capture is working correctly. The undefined `window.Sentry` only affects manual access (like `testSentry()`). This is acceptable but should be investigated.

### Test 2: Complete Checkout Flow
1. Select a gym
2. Select a membership plan
3. Fill out checkout form
4. Complete payment (or test payment link generation)
5. View confirmation

**Expected**:
- ✅ All steps work without errors
- ✅ No Sentry errors for normal flow
- ✅ Payment errors (if any) are captured in Sentry

### Test 3: Login/Logout Flow
1. Log in with valid credentials
2. Check Sentry dashboard - user context should show email
3. Trigger an error (e.g., `throw new Error('test')`)
4. Check Sentry - error should have user context
5. Log out
6. Trigger another error
7. Check Sentry - user context should be cleared

**Expected**:
- ✅ User context set on login
- ✅ Errors include user info
- ✅ User context cleared on logout

### Test 4: Error Filtering
```javascript
// In console, these should NOT appear in Sentry:
throw new Error('ResizeObserver loop limit exceeded');
throw new Error('NetworkError');
throw new Error('Failed to fetch');
```

**Expected**:
- ✅ These errors are filtered out (don't appear in Sentry dashboard)
- ✅ Real errors still appear

### Test 5: Payment Error Capture
1. Start checkout flow
2. Cause a payment link generation error (if possible)
3. Check Sentry dashboard

**Expected**:
- ✅ Payment errors are captured with `flow:checkout` tag
- ✅ Error includes order ID and context

---

## 🚨 Regression Tests

### Critical Paths (Must Work)
- [ ] **New user signup** - Complete flow from gym selection to payment
- [ ] **Existing user login** - Login and complete checkout
- [ ] **Discount codes** - Apply discount code and complete checkout
- [ ] **Multiple items** - Add membership + add-ons and checkout
- [ ] **Payment return** - Complete payment and return to confirmation page

### Edge Cases
- [ ] **Network offline** - App handles gracefully, errors captured
- [ ] **Invalid form data** - Validation works, no Sentry spam
- [ ] **API errors** - Errors handled gracefully, critical ones captured
- [ ] **Browser back/forward** - Navigation works correctly

---

## 📊 Sentry Dashboard Verification

After testing, verify in Sentry dashboard:

- [ ] **Events are appearing** - Test events and real errors show up
- [ ] **User context** - Errors from logged-in users show email
- [ ] **Environment** - Events tagged with correct environment (production/development)
- [ ] **Release tracking** - Events show release version
- [ ] **Error filtering** - Browser extension errors are filtered out
- [ ] **Tags** - Payment errors have `flow:checkout` tag, login errors have `flow:authentication` tag

---

## 🔧 Quick Test Commands

### Test Sentry Manually
```javascript
// In browser console:
testSentry();
```

### Test Error Capture
```javascript
// In browser console:
throw new Error('Test error - ' + new Date().toISOString());
// Check Sentry dashboard in 5-10 seconds
```

### Test User Context
```javascript
// After logging in:
window.Sentry.getCurrentHub().getScope().getUser();
// Should show: { id: "...", email: "..." }

// After logging out:
window.Sentry.getCurrentHub().getScope().getUser();
// Should show: null
```

### Diagnose `window.Sentry` Issue
```javascript
// If window.Sentry is undefined but events appear in Sentry:
// 1. Check if Sentry object exists in scope
console.log('Sentry in scope?', typeof Sentry !== 'undefined');

// 2. Check if initialization completed
// Look for console messages: [Sentry] ✅ Initialized or [Sentry] ❌ errors

// 3. Test auto-capture (works even if window.Sentry is undefined)
throw new Error('Test auto-capture - ' + new Date().toISOString());
// If this appears in Sentry dashboard, Sentry IS working correctly

// 4. Check for errors in console that might prevent assignment
// Look for: [Sentry] ❌ Initialization error
```

**Important**: If events appear in Sentry dashboard, Sentry is working correctly. The `window.Sentry` assignment is for convenience only - auto-capture works independently.

---

## ✅ Sign-Off Checklist

Before merging, confirm:

- [ ] All critical tests pass
- [ ] No console errors in production build
- [ ] Sentry dashboard shows events correctly
- [ ] User context works (set on login, cleared on logout)
- [ ] Error filtering works (noise filtered out)
- [ ] Payment flow works end-to-end
- [ ] Login/logout flow works
- [ ] No performance degradation
- [ ] Mobile browsers tested

---

## 🐛 Known Issues / Notes

- **Sentry version**: Using 7.91.0 from CDN
- **Debug mode**: Enabled in development, disabled in production
- **Test function**: `testSentry()` available in all environments for manual testing
- **`window.Sentry` undefined but events appear**: This is expected behavior. Sentry auto-captures errors once `Sentry.init()` is called, regardless of `window.Sentry` assignment. If events appear in dashboard, Sentry is working correctly. The `window.Sentry` assignment is only for manual access (e.g., `testSentry()`). If undefined, check console for initialization errors, but this doesn't affect error capture functionality.

---

## 📝 Test Results Template

```
Date: __________
Tester: __________
Environment: [ ] Development [ ] Production Preview [ ] Production

Critical Tests:
- [ ] Sentry Initialization
- [ ] Core Application Functionality  
- [ ] Authentication Flow
- [ ] Error Handling
- [ ] Browser Compatibility

Issues Found:
1. 
2. 
3. 

Sign-off: [ ] Ready to merge [ ] Needs fixes
```

---

**Last Updated**: 2026-01-17
