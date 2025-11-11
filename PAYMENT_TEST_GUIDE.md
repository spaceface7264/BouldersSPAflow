# Payment Test & Diagnostic Guide

## 🧪 Testing Payment Flow

### Prerequisites
- Production site: `https://join.boulders.dk`
- Browser console open (F12)
- Network tab open to monitor API calls

---

## 📋 Test Steps

### 1. Start Checkout Flow
1. Go to `https://join.boulders.dk`
2. Select a gym (business unit)
3. Select a membership plan
4. Fill out the customer form
5. Complete checkout

### 2. Monitor Checkout Process
**Watch for these console logs:**
```
[Step 6] Creating customer...
[Step 7] Creating order...
[Step 7] Adding subscription item...
[Step 9] Generating payment link...
```

**Check Network Tab:**
- `POST /api/customers` - Should return 200/201
- `POST /api/orders` - Should return 200/201
- `POST /api/orders/{orderId}/items/subscriptions` - Should return 200/201
- `POST /api/payment/generate-link` - Should return 200 with payment URL

### 3. Complete Payment
1. You'll be redirected to payment provider
2. Complete the payment (use test card if available)
3. You'll be redirected back to confirmation page

### 4. Monitor Payment Return
**Watch for these console logs:**
```
[Payment Return] Detected payment return for order: {orderId}
[Payment Return] Fetching order data for: {orderId}
[Payment Return] ===== ORDER DIAGNOSTICS =====
```

---

## 🔍 Diagnostic Tools

### Available Console Commands

#### 1. Get Order Diagnostics
```javascript
await getOrderDiagnostics(orderId)
```
**Returns:**
- Order status
- Payment status (`leftToPay`)
- Subscription status
- Customer linking
- Timestamps

**Example:**
```javascript
// Get diagnostics for current order
await getOrderDiagnostics()

// Get diagnostics for specific order
await getOrderDiagnostics(816703)
```

#### 2. Export Payment Diagnostics
```javascript
exportPaymentDiagnostics()
```
**Exports:**
- Current state
- SessionStorage data
- Order ID
- Customer ID
- URL
- Timestamp

**Creates:** A JSON file download with all diagnostic data

---

## 📊 What to Check

### ✅ Success Indicators

1. **Order Status**
   - `orderStatus.name` = "Betalet" (not "Oprettet")
   - `preliminary` = `false`
   - `leftToPay.amount` = `0`

2. **Subscription Status**
   - `subscriptionItems[0].subscription.users` = Array with customer ID
   - `subscriptionItems[0].subscription.payer` = Customer object (not null)

3. **Customer Linking**
   - `order.customer` = Customer object (not null)
   - `order.customer.id` matches `state.customerId`

### ❌ Failure Indicators

1. **Payment Not Registered**
   - `leftToPay.amount` > 0 (e.g., 32850)
   - `orderStatus.name` = "Oprettet"
   - `preliminary` = `true` (or `false` but payment not registered)

2. **Subscription Not Linked**
   - `subscription.users` = `[]` (empty array)
   - `subscription.payer` = `null`

3. **Customer Not Linked**
   - `order.customer` = `null`

---

## 🔬 Diagnostic Checklist

### During Checkout
- [ ] Customer created successfully (check `POST /api/customers` response)
- [ ] Order created successfully (check `POST /api/orders` response)
- [ ] Subscription item added (check `POST /api/orders/{orderId}/items/subscriptions` response)
- [ ] Payment link generated (check `POST /api/payment/generate-link` response)
- [ ] Payment link URL is valid and redirects correctly

### After Payment Return
- [ ] Order fetched successfully
- [ ] Order status checked (`orderStatus.name`, `preliminary`, `leftToPay`)
- [ ] Client attempts to set `preliminary: false` (if needed)
- [ ] Polling for payment registration (5 attempts, 2s apart)
- [ ] Check if payment registered (`leftToPay = 0`)

### If Payment Not Registered
- [ ] Check backend logs for webhook arrival
- [ ] Check payment provider dashboard for webhook status
- [ ] Verify webhook URL configuration
- [ ] Check backend webhook processing logs

---

## 📝 Diagnostic Log Analysis

### Expected Log Flow

```
[Payment Return] [2025-11-10T14:02:00.000Z] Fetching order data for: 816703
[Payment Return] Restored customer from sessionStorage: {...}
[Payment Return] Restored order data from sessionStorage: {...}
[Payment Return] Order fetched: {...}
[Payment Return] ===== ORDER DIAGNOSTICS =====
[Payment Return] Diagnostic timestamp: 2025-11-10T14:02:00.500Z
[Payment Return] Time since payment return: 0.50s
[Payment Return] Order status name: Oprettet
[Payment Return] Order is preliminary: true
[Payment Return] Left to pay: 32850
[Payment Return] ⚠️ Order is preliminary - attempting to finalize...
[Payment Return] Updating order with: {"preliminary": false, "businessUnit": "6"}
[Payment Return] Order update response: {...}
[Payment Return] Refreshed order preliminary: false
[Payment Return] Refreshed order leftToPay: {amount: 32850, currency: "DKK"}
[Payment Return] ✅ Order preliminary set to false, but leftToPay still > 0
[Payment Return] Polling for payment registration...
[Payment Return] [2025-11-10T14:02:02.500Z] Poll attempt 1/5 (2.5s): leftToPay = 32850
[Payment Return] Poll 1 order status: Oprettet | preliminary: false
[Payment Return] [2025-11-10T14:02:04.500Z] Poll attempt 2/5 (4.5s): leftToPay = 32850
...
[Payment Return] ⚠️ Payment still not registered after polling
```

### What This Tells Us

1. **Client-side is working:**
   - ✅ Detects payment return
   - ✅ Fetches order
   - ✅ Sets `preliminary: false`
   - ✅ Polls for payment registration

2. **Backend issue:**
   - ❌ Payment webhook not arriving/processing
   - ❌ `leftToPay` never reaches 0
   - ❌ Order status never updates to "Betalet"

---

## 🚨 Common Issues

### Issue 1: Payment Not Registered
**Symptoms:**
- `leftToPay > 0` after payment
- Order status stays "Oprettet"
- Polling shows no change

**Diagnosis:**
- Check backend logs for webhook arrival
- Check payment provider webhook status
- Verify webhook URL configuration

**Action:**
- Backend team must investigate webhook processing

### Issue 2: Order Not Finalized
**Symptoms:**
- `preliminary: true` after payment return
- Client attempts to set `preliminary: false` but fails

**Diagnosis:**
- Check if API allows client to finalize orders
- Check if backend requires different endpoint/fields
- Check authorization/permissions

**Action:**
- Backend team must verify order finalization logic

### Issue 3: Subscription Not Linked
**Symptoms:**
- `subscription.users = []`
- `subscription.payer = null`
- Customer has no memberships

**Diagnosis:**
- Usually caused by payment not being registered
- Membership creation depends on payment registration

**Action:**
- Fix payment registration first (Issue 1)

---

## 📤 Exporting Diagnostic Data

### For Backend Team
1. Complete a test payment
2. Wait for polling to complete
3. Run: `exportPaymentDiagnostics()`
4. Run: `await getOrderDiagnostics()`
5. Share both outputs with backend team

### Diagnostic Data Includes:
- Order ID
- Customer ID
- Order status
- Payment status
- Subscription status
- Timestamps
- Full order object
- SessionStorage data

---

## 🎯 Success Criteria

A successful payment test should show:

1. ✅ Payment completed on payment provider
2. ✅ User redirected back to confirmation page
3. ✅ Order status = "Betalet"
4. ✅ `leftToPay = 0`
5. ✅ `preliminary = false`
6. ✅ Subscription linked to customer
7. ✅ Customer linked to order
8. ✅ Membership created in BRP (verify in backend/CRM)

---

## 📞 Next Steps

If payment is not registering:

1. **Collect Diagnostics:**
   - Run `exportPaymentDiagnostics()`
   - Run `await getOrderDiagnostics()`
   - Copy all console logs

2. **Share with Backend Team:**
   - Order ID
   - Diagnostic data
   - Console logs
   - Timestamp of payment

3. **Backend Team Should Check:**
   - Webhook configuration
   - Webhook arrival logs
   - Webhook processing logs
   - Payment registration logic

---

**Last Updated:** 2025-11-10

