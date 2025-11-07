# Step 5 Testing Checklist

## What to Test

### 1. Business Unit Selection → Product Loading
- [ ] Select a business unit (gym location)
- [ ] Check browser console - should see:
  - "Fetching subscriptions from: ..."
  - "Fetching value cards from: ..."
  - "Loaded X subscriptions and Y value cards"
- [ ] Products should load in the background (ready for step 2)

### 2. Step 2 - Access Type Selection
- [ ] Navigate to step 2 (should happen automatically after selecting gym)
- [ ] Check that products are displayed:
  - [ ] Membership category shows API products (not mock data)
  - [ ] Punch card category shows API products
- [ ] Verify prices are displayed correctly (not in cents)
- [ ] Verify product names match API response

### 3. Product Selection
- [ ] Select a membership product
- [ ] Check console - should see:
  - "Selected plan: ... Product ID: ... Type: membership"
  - "Fetching subscription additions from: ..." (may show 404 warning - that's OK)
- [ ] Verify it advances to next step (or shows add-ons modal)

- [ ] Go back and select a punch card
- [ ] Check console - should see:
  - "Selected plan: ... Product ID: ... Type: punch-card"
- [ ] Verify quantity selector appears
- [ ] Verify it doesn't try to fetch add-ons

### 4. State Verification
Open browser console and type:
```javascript
state.selectedBusinessUnit  // Should show numeric ID
state.subscriptions         // Should show array of products
state.valueCards           // Should show array of products
state.selectedProductId    // Should show numeric ID after selection
state.selectedProductType  // Should show 'membership' or 'punch-card'
```

### 5. Error Handling
- [ ] If API fails, check that error message is shown
- [ ] App should not crash if products fail to load
- [ ] Add-ons endpoint 404 should be handled gracefully (empty array)

## Expected Console Output

When everything works, you should see:
```
Fetching subscriptions from: ...
Fetching value cards from: ...
Subscriptions API response: [...]
Value cards API response: [...]
Loaded X subscriptions and Y value cards
```

When selecting a membership:
```
Selected plan: membership-56 Product ID: 56 Type: membership
Fetching subscription additions from: ...
Additions endpoint not found for product 56. Endpoint may not be implemented yet.
Loaded 0 subscription additions for product 56
```

## Common Issues to Check

1. **Prices showing as very large numbers** → Price not being divided by 100 (check if `price.amount` exists)
2. **No products showing** → Check if API response format matches expectations
3. **CORS errors** → Should use Netlify Function proxy in production
4. **Products not loading** → Check if `state.selectedBusinessUnit` is set correctly

## What to Report

If something doesn't work, please share:
1. Browser console errors/warnings
2. Network tab - check the API requests and responses
3. What you see vs. what you expect

