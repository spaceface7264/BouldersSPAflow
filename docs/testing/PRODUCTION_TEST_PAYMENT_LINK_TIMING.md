# Production Test: Payment Link Generation Timing Fix

## What Changed
- **Payment link is now generated immediately after subscription is added to order**
- Previously: Added all items → Generated payment link
- Now: Add subscription → Generate payment link → Add other items

## Test Checklist

### Test 1: Membership Only Order
- [ ] Select a membership plan
- [ ] Fill out customer form
- [ ] Click checkout
- [ ] **Verify in console**: `[checkout] Membership added to order`
- [ ] **Verify in console**: `[checkout] Generating payment link after subscription added...`
- [ ] **Verify in console**: `[checkout] Payment link generated (Generate Payment Link Card): ...`
- [ ] **Verify**: Payment link is generated BEFORE other items are added
- [ ] **Verify**: Redirect to payment provider works
- [ ] **Complete payment**
- [ ] **Verify**: Return to confirmation page
- [ ] **Verify**: Order is paid (`leftToPay = 0`)
- [ ] **Verify**: Membership is created in BRP

### Test 2: Membership + Add-ons
- [ ] Select a membership plan
- [ ] Select add-ons
- [ ] Fill out customer form
- [ ] Click checkout
- [ ] **Verify in console**: Payment link generated after subscription
- [ ] **Verify in console**: Add-ons added after payment link
- [ ] **Verify**: Payment flow works correctly
- [ ] **Complete payment**
- [ ] **Verify**: All items are in order

### Test 3: Membership + Punch Cards
- [ ] Select a membership plan
- [ ] Select punch cards
- [ ] Fill out customer form
- [ ] Click checkout
- [ ] **Verify in console**: Payment link generated after subscription
- [ ] **Verify in console**: Punch cards added after payment link
- [ ] **Verify**: Payment flow works correctly
- [ ] **Complete payment**
- [ ] **Verify**: All items are in order

### Test 4: Error Handling
- [ ] Test with network error during payment link generation
- [ ] **Verify**: Error message is shown
- [ ] **Verify**: User can retry
- [ ] Test with error adding punch cards (after payment link generated)
- [ ] **Verify**: Error is logged but doesn't block payment
- [ ] **Verify**: Payment link is still available

## Expected Console Logs

### Successful Flow:
```
[checkout] Adding items to order...
[checkout] Membership added to order
[checkout] Generating payment link after subscription added...
[Step 9] Generating payment link: ...
[Step 9] Payment link payload: {...}
[checkout] Payment link generated (Generate Payment Link Card): https://...
[checkout] Payment link response: {...}
[checkout] Value card added: ... (if applicable)
[checkout] Add-on added: ... (if applicable)
[checkout] All items added to order
[checkout] Redirecting to payment provider...
```

## Key Verification Points

1. **Payment link generation timing**: Should happen immediately after subscription is added
2. **Payment link availability**: Should be available even if other items fail to add
3. **Payment flow**: Should work exactly as before, just triggered earlier
4. **Backend webhook**: Should still receive payment webhook and register payment
5. **Membership creation**: Should still work after payment is registered

## What to Watch For

- ⚠️ Payment link generated before subscription is added (WRONG)
- ⚠️ Payment link not generated at all (WRONG)
- ⚠️ Payment link generated after all items (OLD BEHAVIOR - WRONG)
- ✅ Payment link generated immediately after subscription (CORRECT)

## Backend Verification

After payment is completed, check:
- [ ] Order has `leftToPay = 0`
- [ ] Order status is "Betalet" (Paid)
- [ ] Subscription is linked to customer
- [ ] Membership is created in BRP

## Rollback Plan

If issues occur:
1. Revert to previous behavior (generate payment link after all items)
2. Merge previous commit from main branch
3. Redeploy


