# Step 6 Testing Checklist

## What to Test

### 1. Token Management Functions
- [ ] Open browser console (F12 or Cmd+Option+I)
- [ ] Check that token functions are available:
  ```javascript
  typeof window.saveTokens      // Should be 'function'
  typeof window.getAccessToken  // Should be 'function'
  typeof window.getRefreshToken // Should be 'function'
  typeof window.clearTokens     // Should be 'function'
  typeof window.isTokenExpired  // Should be 'function'
  ```
- [ ] Test saving tokens:
  ```javascript
  window.saveTokens('test-access-token', 'test-refresh-token', Date.now() + 3600000);
  ```
- [ ] Test retrieving tokens:
  ```javascript
  window.getAccessToken()   // Should return 'test-access-token'
  window.getRefreshToken()  // Should return 'test-refresh-token'
  ```
- [ ] Test clearing tokens:
  ```javascript
  window.clearTokens();
  window.getAccessToken()   // Should return null
  ```

### 2. Token Persistence (sessionStorage)
- [ ] Save tokens using `window.saveTokens()`
- [ ] Refresh the page (F5)
- [ ] Check console - should see:
  - `[Step 6] Token validated successfully` OR
  - `[Step 6] Access token expired, attempting refresh...` OR
  - `[Step 6] Token validation failed...`
- [ ] Tokens should persist across page reloads (stored in sessionStorage)
- [ ] Close tab and reopen - tokens should be cleared (sessionStorage clears on tab close)

### 3. Login Flow (POST /api/auth/login)
- [ ] Navigate to authentication step in the app
- [ ] Open browser console
- [ ] Attempt to login (if UI is available) OR test directly:
  ```javascript
  authAPI.login('test@example.com', 'password123')
    .then(response => console.log('Login success:', response))
    .catch(error => console.error('Login error:', error));
  ```
- [ ] Check console - should see:
  - `[Step 6] Logging in: ...`
  - `[Step 6] Login response: ...`
- [ ] If login succeeds, tokens should be saved automatically
- [ ] Verify tokens were saved:
  ```javascript
  window.getAccessToken()  // Should return access token
  window.getRefreshToken() // Should return refresh token
  ```

### 4. Token Validation on App Load
- [ ] Save tokens manually:
  ```javascript
  window.saveTokens('test-access', 'test-refresh', Date.now() + 3600000);
  ```
- [ ] Refresh the page (F5)
- [ ] Check console - should see:
  - `[Step 6] Token validated successfully` OR
  - `[Step 6] Token validation failed...` (if token is invalid)
- [ ] If validation fails, should attempt refresh
- [ ] If refresh fails, tokens should be cleared

### 5. Token Refresh (POST /api/auth/refresh)
- [ ] Save an expired token:
  ```javascript
  window.saveTokens('expired-token', 'valid-refresh-token', Date.now() - 1000);
  ```
- [ ] Refresh the page
- [ ] Check console - should see:
  - `[Step 6] Access token expired, attempting refresh...`
  - `[Step 6] Refreshing token: ...`
  - `[Step 6] Token refreshed successfully` OR
  - `[Step 6] Token refresh failed, clearing session...`
- [ ] If refresh succeeds, new tokens should be saved
- [ ] If refresh fails, tokens should be cleared

### 6. Password Reset (POST /api/auth/reset-password)
- [ ] Test password reset:
  ```javascript
  authAPI.resetPassword('test@example.com')
    .then(response => console.log('Password reset success:', response))
    .catch(error => console.error('Password reset error:', error));
  ```
- [ ] Check console - should see:
  - `[Step 6] Requesting password reset: ...`
  - `[Step 6] Password reset response: ...`
- [ ] Should show confirmation message to user (if UI implemented)

### 7. Customer Creation (POST /api/customers)
- [ ] Ensure a business unit is selected:
  ```javascript
  state.selectedBusinessUnit  // Should show a number
  ```
- [ ] Test customer creation:
  ```javascript
  authAPI.createCustomer({
    email: 'newuser@example.com',
    name: 'Test User',
    // ... other required fields
  })
    .then(response => console.log('Customer created:', response))
    .catch(error => console.error('Customer creation error:', error));
  ```
- [ ] Check console - should see:
  - `[Step 6] Creating customer: ...`
  - `[Step 6] Create customer response: ...`
- [ ] Verify business unit is included in payload (check Network tab)

### 8. Customer Update (PUT /api/customers/:id)
- [ ] Ensure you have a valid access token (login first)
- [ ] Test customer update:
  ```javascript
  authAPI.updateCustomer(123, {
    name: 'Updated Name',
    // ... other fields
  })
    .then(response => console.log('Customer updated:', response))
    .catch(error => console.error('Customer update error:', error));
  ```
- [ ] Check console - should see:
  - `[Step 6] Updating customer: ...`
  - Authorization header should be included automatically
- [ ] Verify business unit is included in payload

### 9. Link Guardian/Child (POST /api/customers/:customerId/otheruser)
- [ ] Ensure you have a valid access token
- [ ] Test linking:
  ```javascript
  authAPI.linkOtherUser(123, 456, 'PAYER')
    .then(response => console.log('Linked successfully:', response))
    .catch(error => console.error('Link error:', error));
  ```
- [ ] Check console - should see:
  - `[Step 6] Linking other user: ...`
  - Authorization header should be included automatically

### 10. HttpClient Authorization Header
- [ ] Save a token:
  ```javascript
  window.saveTokens('test-token', 'refresh-token', Date.now() + 3600000);
  ```
- [ ] Make any API call that uses HttpClient (from shared/lib/http.ts)
- [ ] Check Network tab in browser DevTools
- [ ] Verify `Authorization: Bearer test-token` header is included automatically
- [ ] Authorization header should be added to all requests when token exists

### 11. Error Handling
- [ ] Test login with invalid credentials - should show error, not crash
- [ ] Test token validation with invalid token - should attempt refresh, then clear
- [ ] Test refresh with invalid refresh token - should clear session
- [ ] Test customer creation without business unit - should auto-include if available
- [ ] App should not crash on any auth errors

## Expected Console Output

### Successful Login:
```
[Step 6] Logging in: /api/auth/login
[Step 6] Login response: { accessToken: '...', refreshToken: '...', ... }
```

### Token Validation on Load:
```
[Step 6] Token validated successfully
```

### Token Refresh:
```
[Step 6] Access token expired, attempting refresh...
[Step 6] Refreshing token: /api/auth/refresh
[Step 6] Token refresh response: { accessToken: '...', refreshToken: '...', ... }
[Step 6] Token refreshed successfully
```

### Failed Refresh:
```
[Step 6] Access token expired, attempting refresh...
[Step 6] Refreshing token: /api/auth/refresh
[Step 6] Token refresh error (401): ...
[Step 6] Token refresh failed, clearing session: ...
```

## Network Tab Verification

When testing, check the Network tab in DevTools:

1. **Login Request:**
   - Method: POST
   - URL: `/api/auth/login` (or via proxy)
   - Headers: Should include `Accept-Language: da-DK`
   - Body: `{ email: '...', password: '...' }`
   - Response: Should include `accessToken` and `refreshToken`

2. **Authenticated Requests:**
   - Should include `Authorization: Bearer {token}` header
   - Should include `Accept-Language: da-DK` header

3. **Token Validation:**
   - Method: POST
   - URL: `/api/auth/validate`
   - Headers: Should include `Authorization: Bearer {token}`

4. **Token Refresh:**
   - Method: POST
   - URL: `/api/auth/refresh`
   - Body: `{ refreshToken: '...' }`

## Common Issues to Check

1. **Tokens not persisting** → Check sessionStorage in Application tab
2. **Authorization header not added** → Check if `getAccessToken()` returns token
3. **Token validation fails on load** → Check if token format is correct
4. **Refresh doesn't work** → Check if refresh token is stored correctly
5. **Business unit not included** → Check if `state.selectedBusinessUnit` is set

## What to Report

If something doesn't work, please share:
1. Browser console errors/warnings
2. Network tab - check the API requests and responses
3. What you see vs. what you expect
4. Token values (first/last few characters only for security)

## Quick Test Commands

Paste these in browser console:

```javascript
// Check token functions
console.log('Token functions available:', {
  saveTokens: typeof window.saveTokens,
  getAccessToken: typeof window.getAccessToken,
  clearTokens: typeof window.clearTokens,
});

// Check current tokens
console.log('Current tokens:', {
  accessToken: window.getAccessToken() ? '***' + window.getAccessToken().slice(-4) : null,
  refreshToken: window.getRefreshToken() ? '***' + window.getRefreshToken().slice(-4) : null,
  expired: window.isTokenExpired ? window.isTokenExpired() : 'N/A',
});

// Check AuthAPI
console.log('AuthAPI available:', typeof authAPI !== 'undefined');
console.log('AuthAPI methods:', authAPI ? Object.getOwnPropertyNames(Object.getPrototypeOf(authAPI)) : 'N/A');

// Test token save/retrieve
window.saveTokens('test-access', 'test-refresh', Date.now() + 3600000);
console.log('Saved tokens, retrieved:', {
  access: window.getAccessToken(),
  refresh: window.getRefreshToken(),
});

// Clear and verify
window.clearTokens();
console.log('Cleared tokens, retrieved:', {
  access: window.getAccessToken(),
  refresh: window.getRefreshToken(),
});
```

