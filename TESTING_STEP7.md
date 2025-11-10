# Step 7 Testing Checklist

## What to Test

### 1. OrderAPI Availability
- [ ] Open browser console (F12 or Cmd+Option+I)
- [ ] Check if OrderAPI is available:
  ```javascript
  typeof orderAPI
  ```
- [ ] If not available, check if the class exists:
  ```javascript
  typeof OrderAPI
  ```

### 2. OrderAPI Methods
- [ ] Check available methods:
  ```javascript
  orderAPI ? Object.getOwnPropertyNames(Object.getPrototypeOf(orderAPI)).filter(name => name !== 'constructor') : 'orderAPI not found'
  ```
- [ ] Should see methods like: `createOrder`, `addSubscriptionItem`, `addValueCardItem`, `addArticleItem`, `getOrder`, `updateOrder`

### 3. State Check (Product Selection from Step 5)
- [ ] Verify product selection state exists:
  ```javascript
  // These should be set after selecting a product in Step 5
  state.selectedProductId    // Should show product ID (number)
  state.selectedProductType  // Should show 'membership' or 'punch-card'
  state.selectedBusinessUnit // Should show business unit ID (number)
  ```
- [ ] If not set, select a gym and then a product to set these values

### 4. Create Order Test (if authenticated)
**Note:** This requires authentication. If you have a valid token:

- [ ] Save a token first (if testing auth):
  ```javascript
  window.saveTokens('test-token', 'refresh-token', Date.now() + 3600000);
  ```

- [ ] Test order creation:
  ```javascript
  orderAPI.createOrder({
    // Add any required order fields
  })
    .then(response => console.log('Order created:', response))
    .catch(error => console.error('Order creation error:', error));
  ```

- [ ] Check console - should see:
  - `[Step 7] Creating order: ...`
  - `[Step 7] Create order response: ...` OR error message

### 5. Add Items Test (requires orderId)
**Note:** This requires a valid order ID from a successful order creation:

- [ ] Test adding subscription item:
  ```javascript
  // Replace 123 with actual orderId
  orderAPI.addSubscriptionItem(123, state.selectedProductId)
    .then(response => console.log('Subscription added:', response))
    .catch(error => console.error('Add subscription error:', error));
  ```

- [ ] Test adding value card item:
  ```javascript
  // Replace 123 with actual orderId, 2 is quantity
  orderAPI.addValueCardItem(123, state.selectedProductId, 2)
    .then(response => console.log('Value card added:', response))
    .catch(error => console.error('Add value card error:', error));
  ```

- [ ] Test adding article item (add-on):
  ```javascript
  // Replace 123 with actual orderId, use add-on product ID
  orderAPI.addArticleItem(123, 456) // 456 is example add-on product ID
    .then(response => console.log('Article added:', response))
    .catch(error => console.error('Add article error:', error));
  ```

### 6. Get Order Test
- [ ] Test getting order:
  ```javascript
  // Replace 123 with actual orderId
  orderAPI.getOrder(123)
    .then(response => console.log('Order details:', response))
    .catch(error => console.error('Get order error:', error));
  ```

### 7. Update Order Test
- [ ] Test updating order:
  ```javascript
  // Replace 123 with actual orderId
  orderAPI.updateOrder(123, {
    // Add fields to update
  })
    .then(response => console.log('Order updated:', response))
    .catch(error => console.error('Update order error:', error));
  ```

### 8. Business Unit Inclusion
- [ ] Verify business unit is included in payloads:
  - Check Network tab when making order API calls
  - Request payload should include `businessUnit` field
  - Value should match `state.selectedBusinessUnit`

### 9. Authorization Header
- [ ] Verify Authorization header is added:
  - Save a token: `window.saveTokens('test-token', 'refresh', Date.now() + 3600000);`
  - Make an order API call
  - Check Network tab → Request Headers
  - Should see `Authorization: Bearer test-token`

## Expected Console Output

### Successful Order Creation:
```
[Step 7] Creating order: /api/orders
[Step 7] Create order response: { id: 123, ... }
```

### Adding Items:
```
[Step 7] Adding subscription item: /api/orders/123/items/subscriptions
[Step 7] Add subscription item response: { ... }
```

### Error Handling:
```
[Step 7] Create order error (401): Unauthorized
[Step 7] Create order error: Error: Create order failed: 401 - ...
```

## Common Issues to Check

1. **orderAPI not defined** → Check if OrderAPI class was instantiated
2. **No product selected** → Select a gym and product first (Step 5)
3. **No business unit** → Select a gym first (Step 3)
4. **401 Unauthorized** → Need valid authentication token
5. **404 Not Found** → Order endpoints may not be implemented yet (expected)

## What to Report

If something doesn't work, please share:
1. Browser console errors/warnings
2. Network tab - check the API requests and responses
3. What you see vs. what you expect
4. Current state values (selectedProductId, selectedBusinessUnit, etc.)

## Quick Test Commands

Paste these in browser console:

```javascript
// Check OrderAPI availability
console.log('OrderAPI available:', typeof orderAPI !== 'undefined');
console.log('OrderAPI methods:', orderAPI ? Object.getOwnPropertyNames(Object.getPrototypeOf(orderAPI)).filter(name => name !== 'constructor') : 'N/A');

// Check state
console.log('State check:', {
  selectedProductId: state?.selectedProductId || 'Not set',
  selectedProductType: state?.selectedProductType || 'Not set',
  selectedBusinessUnit: state?.selectedBusinessUnit || 'Not set',
});

// Test order creation structure (will fail without auth, but shows if method exists)
if (typeof orderAPI !== 'undefined') {
  console.log('Testing order creation method...');
  orderAPI.createOrder({}).catch(e => console.log('Expected error (no auth):', e.message));
}
```

