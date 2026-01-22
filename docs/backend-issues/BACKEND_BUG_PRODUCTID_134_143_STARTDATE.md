# Backend Bug: startDate Parameter Ignored for Products 134 and 143

> **Status:** 🔴 CRITICAL - Blocking Production
> 
> **Date Reported:** January 2026
> 
> **Affected Products:** Product ID 134 ("Medlemskab") and Product ID 143 ("Membership")
> 
> **Severity:** HIGH - Users are being charged incorrect amounts

## 🚨 Problem Summary

The backend **ignores the `startDate` parameter** when adding subscription items for products 134 and 143 **during the checkout flow**, causing:
- ❌ Incorrect pricing (monthly fee instead of partial-month price)
- ❌ Wrong `initialPaymentPeriod.start` date (26+ days in future instead of today)
- ❌ Users charged incorrect amount (469 DKK instead of 620.29 DKK)
- ❌ Frontend cannot fix the issue (order locked with 403 Forbidden)

**Note**: This issue occurs during **checkout** when the order is created. It does NOT occur during payment return flows (e.g., when `error=205` is present), as those flows handle payment failures and don't proceed with checkout.

**Historical Note**: In commit `72c502b` (Jan 20, 2026), this issue was not observed. This suggests either:
1. The backend was working correctly at that time (accepting `startDate` for products 134/143)
2. The frontend detection logic was not yet in place to catch this issue
3. The issue is intermittent or environment-specific

## 📋 Detailed Description

### Expected Behavior
When adding a subscription item with `startDate: "2026-01-XX"` (today's date), the backend should:
1. ✅ Accept the `startDate` parameter
2. ✅ Set `initialPaymentPeriod.start` to the provided date
3. ✅ Calculate partial-month pricing based on the start date
4. ✅ Return correct order price (e.g., 620.29 DKK for partial month)

### Actual Behavior
For products 134 and 143, the backend:
1. ❌ **Ignores the `startDate` parameter**
2. ❌ Sets `initialPaymentPeriod.start` to **26+ days in the future** (next month)
3. ❌ Returns **full monthly price** (469 DKK) instead of partial-month price (620.29 DKK)
4. ❌ Locks the order immediately, preventing frontend from fixing it

### Comparison with Working Products
- ✅ **Product ID 56 (Junior)**: Backend accepts `startDate` → Correct partial-month pricing
- ✅ **Product ID 135 (Student)**: Backend accepts `startDate` → Correct partial-month pricing
- ❌ **Product ID 134 (Medlemskab)**: Backend ignores `startDate` → Incorrect full monthly price
- ❌ **Product ID 143 (Membership)**: Backend ignores `startDate` → Incorrect full monthly price

## 🔍 Evidence

### API Request
```json
POST /api/ver3/orders/{orderId}/items/subscriptions
{
  "subscriptionProduct": 134,
  "startDate": "2026-01-07",  // Today's date
  "birthDate": "...",
  "subscriber": ...
}
```

### API Response (Incorrect)
```json
{
  "subscriptionItems": [{
    "initialPaymentPeriod": {
      "start": "2026-02-01",  // ❌ 26 days in future (should be "2026-01-07")
      "end": "2026-02-28"
    },
    "product": {
      "id": 134,
      "name": "Medlemskab"
    }
  }],
  "price": {
    "amount": 46900  // ❌ Full monthly price (should be ~62029 for partial month)
  }
}
```

### Expected Response
```json
{
  "subscriptionItems": [{
    "initialPaymentPeriod": {
      "start": "2026-01-07",  // ✅ Today's date
      "end": "2026-01-31"      // ✅ End of current month
    }
  }],
  "price": {
    "amount": 62029  // ✅ Partial-month price (rest of month + next month if day >= 16)
  }
}
```

### Console Logs
```
[Step 7] ⚠️ Backend ignored startDate - start date is 26 days in future
[Step 7] ⚠️ Product ID: 134
[Step 7] ⚠️ Attempting to fix with multiple strategies...
[Step 7] Strategy error: Error: Order is locked (403 Forbidden)
[Step 7] ❌ All strategies failed to fix pricing mismatch for productId: 134

[Payment Overview] ⚠️ Backend pricing appears incorrect!
[Payment Overview] ⚠️ Backend shows: 469 DKK
[Payment Overview] ⚠️ Expected (calculated): 620.29 DKK
[Payment Overview] ⚠️ Backend returned monthly fee instead of partial-month price!

[checkout] ❌ CRITICAL: Cannot proceed with checkout - backend price is incorrect!
[checkout] ❌ Backend price: 469 DKK
[checkout] ❌ Expected price: 620.29 DKK
[checkout] ❌ Backend returned monthly fee: true
[checkout] ❌ This is a backend issue - backend ignored startDate parameter
```

## 💰 Financial Impact

**Price Difference:**
- Backend charges: **469 DKK** (full monthly fee)
- Should charge: **620.29 DKK** (partial-month price)
- **Difference: 151.29 DKK per affected customer**

**Impact:**
- Customers are being **undercharged** initially (paying less than they should)
- This creates accounting discrepancies
- May cause issues with membership activation dates

## 🔧 Frontend Workarounds Attempted

The frontend has attempted multiple strategies to fix this issue:

1. ✅ **Detection**: Correctly identifies when backend price is wrong
2. ✅ **Calculation**: Accurately calculates expected partial-month price
3. ✅ **Fix Attempts**: Tries to delete and re-add subscription with correct startDate
4. ❌ **Fix Fails**: All fix attempts fail with **403 Forbidden** (order is locked)
5. ✅ **Protection**: Now blocks checkout when price is incorrect to prevent incorrect charges

### Fix Strategies Tried (All Failed)
1. Delete subscription item and re-add with same payload → 403 Forbidden
2. Delete and re-add with explicit date format → 403 Forbidden
3. Delete and re-add with minimal payload → 403 Forbidden
4. Delete and re-add with longer wait time → 403 Forbidden

**Result**: Order is locked immediately after creation, preventing any modifications.

## 🎯 Required Backend Fix

### Root Cause
The backend has special handling or business logic for products 134 and 143 that causes it to:
1. Ignore the `startDate` parameter
2. Default to next month's start date
3. Calculate full monthly price instead of partial-month price

### Required Changes
1. **Respect `startDate` parameter** for ALL products, including 134 and 143
2. **Set `initialPaymentPeriod.start`** to the provided `startDate` (not ignore it)
3. **Calculate partial-month pricing** correctly when `startDate` is today
4. **Return correct order price** in `order.price.amount`
5. **Do not lock orders immediately** - allow frontend to fix pricing issues if needed

### Test Cases

#### Test Case 1: Product 134 with startDate = today
```json
POST /api/ver3/orders/{orderId}/items/subscriptions
{
  "subscriptionProduct": 134,
  "startDate": "2026-01-07",  // Today
  "birthDate": "...",
  "subscriber": ...
}
```

**Expected:**
- `initialPaymentPeriod.start` = "2026-01-07"
- `order.price.amount` = 62029 (partial-month price in cents)

**Actual:**
- `initialPaymentPeriod.start` = "2026-02-01" ❌
- `order.price.amount` = 46900 (full monthly price) ❌

#### Test Case 2: Product 143 with startDate = today
Same as Test Case 1, but with `subscriptionProduct: 143`

#### Test Case 3: Product 134 with startDate = today (day >= 16)
When today is day 16 or later, price should include:
- Rest of current month (prorated) + Full next month

**Expected:**
- `initialPaymentPeriod.start` = today
- `initialPaymentPeriod.end` = end of next month
- `order.price.amount` = (rest of month + full next month) in cents

## 📊 Affected Products

| Product ID | Product Name | Status | startDate Accepted? |
|------------|--------------|--------|---------------------|
| 56 | Junior | ✅ Working | Yes |
| 134 | Medlemskab | ❌ Broken | No |
| 135 | Student | ✅ Working | Yes |
| 143 | Membership | ❌ Broken | No |

## 🛡️ Frontend Protection

The frontend now:
- ✅ Detects when backend price is incorrect
- ✅ Shows correct calculated price to users
- ✅ Blocks checkout when backend price is wrong
- ✅ Shows clear error message: "Unable to proceed with checkout due to a pricing issue"
- ✅ Prevents users from being charged incorrect amounts

**Note**: This protection prevents incorrect charges but also blocks legitimate checkouts when backend has pricing issues. The backend fix is still required.

## 📝 Additional Notes

1. **Order Locking**: Orders are locked immediately after creation, preventing frontend from fixing pricing issues. Consider allowing a grace period for price corrections.

2. **Consistency**: Products 56 and 135 work correctly, suggesting the issue is product-specific logic rather than a general API problem.

3. **Timing**: The issue occurs immediately when the subscription item is added - the order is locked before frontend can attempt fixes.

4. **User Experience**: Users see correct price in UI but checkout is blocked, which is better than charging them incorrectly but still not ideal.

5. **When Issue Occurs**: This issue manifests during the **checkout flow** when:
   - User selects product 134 or 143
   - Order is created with subscription item
   - Backend ignores `startDate` and returns incorrect price
   - Frontend detects the issue and blocks checkout
   
   The issue does NOT occur during payment return flows (e.g., `error=205`), as those handle payment failures and don't proceed with the checkout pricing verification.

## 🔗 Related Issues

- See `BACKEND_BUG_PRODUCTID_134.md` for original issue report
- See `VERIFICATION_COMPLETE_BACKEND_BUG_CONFIRMED.md` for verification details
- Frontend fix attempts documented in commit history

## ✅ Acceptance Criteria

The bug is fixed when:
1. ✅ Product 134 accepts `startDate` parameter and sets `initialPaymentPeriod.start` correctly
2. ✅ Product 143 accepts `startDate` parameter and sets `initialPaymentPeriod.start` correctly
3. ✅ Partial-month pricing is calculated correctly for both products
4. ✅ Order price matches expected partial-month price
5. ✅ All test cases pass
6. ✅ Frontend can successfully complete checkout without blocking

## 📞 Contact

For questions or clarification, please contact the frontend team or refer to the API documentation:
- API Documentation: https://boulders.brpsystems.com/brponline/external/documentation/api3
- Endpoint: `POST /api/ver3/orders/{orderId}/items/subscriptions`

---

**Priority**: HIGH - This is blocking production checkouts for products 134 and 143
**Estimated Impact**: All customers purchasing products 134 or 143 are affected
**Workaround**: Frontend blocks checkout to prevent incorrect charges (not ideal)
