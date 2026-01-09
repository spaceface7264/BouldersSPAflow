# Punch Card (Klippekort) Setup Analysis

Based on the successful membership implementation, here's what needs to be set up/verified for Punch Cards.

## ✅ Already Implemented

### 1. API Integration
- ✅ **Fetch Value Cards**: `BusinessUnitsAPI.getValueCards()` - `GET /api/products/valuecards`
- ✅ **Add to Order**: `OrderAPI.addValueCardItem(orderId, productId, quantity)` - `POST /api/orders/{orderId}/items/valuecards`
- ✅ **Product Loading**: Value cards are loaded in `loadProductsFromAPI()` and stored in `state.valueCards`

### 2. UI & Selection
- ✅ **Product Display**: Value cards are rendered in the "punchcard" category
- ✅ **Quantity Selection**: Users can increment/decrement quantity (1-5)
- ✅ **State Management**: 
  - `state.valueCardQuantities` (Map) stores quantities per punch card
  - `state.selectedProductType` tracks 'punch-card' vs 'membership'
  - `state.selectedProductId` stores the API product ID

### 3. Cart & Checkout
- ✅ **Cart Summary**: `updateCartSummary()` handles punch cards and calculates totals
- ✅ **Checkout Flow**: `handleCheckout()` adds value cards to order via `addValueCardItem()`

## ⚠️ Issues to Fix

### 1. **Product ID Format Mismatch** (CRITICAL)
**Problem**: 
- UI uses format `'punch-${productId}'` (e.g., `'punch-56'`)
- `state.valueCardQuantities` uses this format as keys
- But `addValueCardItem()` expects numeric product ID

**Current Code** (line ~3810):
```javascript
await orderAPI.addValueCardItem(state.orderId, planId, quantity);
// planId is 'punch-56', but API expects 56
```

**Fix Needed**:
```javascript
// Extract numeric ID from 'punch-56' format
const numericProductId = typeof planId === 'string' && planId.includes('punch-')
  ? parseInt(planId.replace('punch-', ''), 10)
  : planId;

await orderAPI.addValueCardItem(state.orderId, numericProductId, quantity);
```

### 2. **Checkout Validation** (CRITICAL)
**Problem**: 
- `handleCheckout()` only checks `if (!state.membershipPlanId)` 
- Doesn't allow checkout if only punch cards are selected (no membership)

**Current Code** (line ~3647):
```javascript
if (!state.membershipPlanId) {
  showToast('Select a membership to continue.', 'error');
  return;
}
```

**Fix Needed**:
```javascript
// Allow checkout if either membership OR punch cards are selected
const hasMembership = !!state.membershipPlanId;
const hasPunchCards = state.valueCardQuantities && 
  Array.from(state.valueCardQuantities.values()).some(qty => qty > 0);

if (!hasMembership && !hasPunchCards) {
  showToast('Select a membership or punch card to continue.', 'error');
  return;
}
```

### 3. **Confirmation View for Punch Cards**
**Problem**: 
- `buildOrderSummary()` assumes membership exists
- Shows "Membership Details" even for punch card-only orders
- Doesn't show punch card-specific information

**Current Code** (line ~3948):
```javascript
const membership = findMembershipPlan(state.membershipPlanId ?? '');
// Always looks for membership, even if only punch cards selected
```

**Fix Needed**:
- Check if order is punch card-only
- Show "Punch Card Details" instead of "Membership Details"
- Display punch card quantities and types
- Hide membership-specific fields (membership number, type, monthly price)

### 4. **SessionStorage for Payment Return**
**Problem**: 
- `sessionStorage` stores `membershipPlanId` but not punch card data
- On payment return, punch card quantities are lost

**Current Code** (line ~3772):
```javascript
sessionStorage.setItem('boulders_checkout_order', JSON.stringify({
  orderId: state.orderId,
  membershipPlanId: state.membershipPlanId, // Only membership
  cartItems: state.cartItems || [],
  totals: state.totals,
  selectedBusinessUnit: state.selectedBusinessUnit,
}));
```

**Fix Needed**:
```javascript
// Convert Map to Array for JSON serialization
const valueCardQuantitiesArray = Array.from(state.valueCardQuantities.entries());

sessionStorage.setItem('boulders_checkout_order', JSON.stringify({
  orderId: state.orderId,
  membershipPlanId: state.membershipPlanId,
  valueCardQuantities: valueCardQuantitiesArray, // Store punch cards
  selectedProductType: state.selectedProductType, // 'membership' or 'punch-card'
  cartItems: state.cartItems || [],
  totals: state.totals,
  selectedBusinessUnit: state.selectedBusinessUnit,
}));
```

And restore it:
```javascript
if (storedOrder.valueCardQuantities) {
  // Convert Array back to Map
  state.valueCardQuantities = new Map(storedOrder.valueCardQuantities);
}
if (storedOrder.selectedProductType) {
  state.selectedProductType = storedOrder.selectedProductType;
}
```

### 5. **Order Summary Display**
**Problem**: 
- Confirmation view always shows "Membership Details" card
- For punch card-only orders, should show "Punch Card Details" or hide membership section

**Fix Needed**:
- Conditionally render membership vs punch card details
- Show punch card quantities and types in confirmation

## 📋 Implementation Checklist

### Phase 1: Critical Fixes (Required for Punch Cards to Work)
- [ ] Fix product ID format in `addValueCardItem()` call
- [ ] Update checkout validation to allow punch card-only orders
- [ ] Store punch card data in sessionStorage
- [ ] Restore punch card data on payment return

### Phase 2: UX Improvements (Recommended)
- [ ] Update confirmation view to show punch card details
- [ ] Hide membership-specific fields for punch card orders
- [ ] Show punch card quantities and types in order summary
- [ ] Test end-to-end punch card flow

### Phase 3: Edge Cases (Nice to Have)
- [ ] Handle mixed orders (membership + punch cards)
- [ ] Validate quantity limits (max 5 per type)
- [ ] Error handling for punch card-specific errors

## 🔍 Testing Checklist

Once fixes are applied, test:

1. **Selection Flow**:
   - [ ] Select a punch card
   - [ ] Adjust quantity (1-5)
   - [ ] Verify cart shows correct items and totals

2. **Checkout Flow**:
   - [ ] Complete checkout with punch cards only (no membership)
   - [ ] Verify order is created
   - [ ] Verify punch cards are added to order with correct product IDs
   - [ ] Verify payment link is generated

3. **Payment Return**:
   - [ ] Complete payment
   - [ ] Verify return to confirmation page
   - [ ] Verify punch card data is restored from sessionStorage
   - [ ] Verify confirmation shows punch card details (not membership)

4. **Mixed Orders** (if supported):
   - [ ] Select both membership and punch cards
   - [ ] Verify both are added to order
   - [ ] Verify totals are correct

## 📚 API Reference

From the implementation guide:
- **Fetch Punch Cards**: `GET /api/products/valuecards`
- **Add to Order**: `POST /api/orders/{orderId}/items/valuecards`
  - Payload: `{ productId: number, quantity: number, businessUnit: string }`
- **Always include**: Active business unit in payloads

## 🎯 Key Differences from Membership

1. **No Customer Account Required**: Punch cards might not require customer creation (verify with API)
2. **Quantity Support**: Punch cards support quantity (1-5), memberships are single
3. **No Recurring Billing**: Punch cards are one-time purchases
4. **Different Confirmation**: Should show punch card details, not membership details


