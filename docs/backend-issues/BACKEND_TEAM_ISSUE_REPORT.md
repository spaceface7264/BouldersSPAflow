# Backend Team: Membership Creation Issue - Payment Webhook Not Processing

## 🚨 Issue Summary

**Problem**: When customers complete payment for a membership, the membership is **not being created in BRP**, even though:
- ✅ Customer profile is created successfully
- ✅ Order is created with subscription item
- ✅ Payment is completed on payment provider side

**Root Cause**: Payment webhook from payment provider is **not arriving or not being processed** by the backend, preventing payment registration and membership creation.

---

## 📊 Evidence from Production Logs

### Order State After Payment Return

```json
{
  "id": 816677,
  "preliminary": true,  // Initially true
  "leftToPay": {
    "amount": 32850,
    "currency": "DKK"
  },
  "orderStatus": {
    "id": 1,
    "name": "Oprettet"  // Still "Created", not "Betalet" (Paid)
  },
  "subscriptionItems": [{
    "id": 967615,
    "subscription": {
      "id": 62344,
      "name": "Medlemskab",
      "users": [],  // Empty - subscription not linked to customer
      "payer": null  // No payer assigned
    }
  }],
  "customer": null  // Customer not linked to order
}
```

### What Client-Side Code Does

1. **Sets `preliminary: false`** ✅
   - Client calls: `PUT /api/orders/{orderId}` with `{ preliminary: false, businessUnit: "12" }`
   - Response: Order updated successfully, `preliminary: false` ✅

2. **Polls for Payment Registration** ✅
   - Client polls `GET /api/orders/{orderId}` every 2 seconds for 10 seconds
   - Result: `leftToPay` remains `32850` after all 5 polling attempts ❌

### Log Output

```
[Payment Return] ✅ Order preliminary set to false, but leftToPay still > 0
[Payment Return] ⚠️ Payment has not been registered yet - membership will NOT be created until payment is confirmed
[Payment Return] Polling for payment registration...
[Payment Return] Poll attempt 1/5: leftToPay = 32850
[Payment Return] Poll attempt 2/5: leftToPay = 32850
[Payment Return] Poll attempt 3/5: leftToPay = 32850
[Payment Return] Poll attempt 4/5: leftToPay = 32850
[Payment Return] Poll attempt 5/5: leftToPay = 32850
[Payment Return] ⚠️ Payment still not registered after polling
```

---

## 🔄 Expected Flow

### What Should Happen

1. **User completes payment** on payment provider (e.g., Nets, Stripe, etc.)
2. **Payment provider sends webhook** to backend webhook URL
3. **Backend receives webhook** and processes it:
   - Verifies payment was successful
   - Sets `leftToPay = 0` on the order
   - Updates `orderStatus` to "Betalet" (Paid)
   - Links subscription to customer (`subscription.users` and `subscription.payer`)
   - Links customer to order (`order.customer`)
   - **Triggers membership creation in BRP**
4. **User returns to site** → Client polls and sees `leftToPay = 0` ✅
5. **Membership exists in BRP** ✅

### What's Actually Happening

1. ✅ User completes payment on payment provider
2. ✅ User returns to site
3. ✅ Client sets `preliminary: false`
4. ❌ **Payment webhook never arrives or isn't processed**
5. ❌ `leftToPay` stays `32850` (payment not registered)
6. ❌ Order status stays "Oprettet" (not "Betalet")
7. ❌ Subscription not linked to customer
8. ❌ Membership never created in BRP

---

## 🔍 Investigation Checklist

### 1. Webhook Configuration

**Check in Payment Provider Dashboard:**
- [ ] Is webhook URL configured?
- [ ] Is webhook URL correct and accessible?
- [ ] Is webhook enabled for payment completion events?
- [ ] Are webhooks being sent? (check webhook logs in payment provider)

**Expected Webhook Events:**
- Payment completed/succeeded
- Payment failed (for error handling)

### 2. Backend Webhook Endpoint

**Check Backend Logs:**
- [ ] Are webhooks arriving at the backend endpoint?
- [ ] Are webhooks being received but failing to process?
- [ ] Are there any errors in webhook processing logs?

**Webhook Endpoint Should:**
- Accept POST requests from payment provider
- Verify webhook signature/authentication
- Extract order ID from webhook payload
- Update order: `leftToPay = 0`
- Update order status: `orderStatus = "Betalet"` (or equivalent)
- Link subscription to customer
- Trigger membership creation in BRP

### 3. Payment Registration Logic

**Check Backend Code:**
- [ ] Does webhook handler update `leftToPay` to `0`?
- [ ] Does webhook handler update `orderStatus`?
- [ ] Does webhook handler link subscription to customer?
- [ ] Does webhook handler trigger membership creation?

**Expected Code Flow:**
```javascript
// Pseudo-code - adjust for your stack
webhookHandler(paymentWebhook) {
  const orderId = paymentWebhook.orderId;
  const paymentStatus = paymentWebhook.status;
  
  if (paymentStatus === 'completed' || paymentStatus === 'succeeded') {
    // Update order
    await updateOrder(orderId, {
      leftToPay: { amount: 0, currency: 'DKK' },
      orderStatus: { id: 2, name: 'Betalet' }, // or equivalent
      preliminary: false
    });
    
    // Link subscription to customer
    await linkSubscriptionToCustomer(orderId);
    
    // Trigger membership creation in BRP
    await createMembershipInBRP(orderId);
  }
}
```

### 4. Order Status Values

**Verify Order Status IDs:**
- Current: `{ id: 1, name: "Oprettet" }` (Created)
- Expected after payment: `{ id: 2, name: "Betalet" }` (Paid) - **verify this ID**

**Check:**
- [ ] What is the correct order status ID for "Paid"?
- [ ] Is the webhook handler using the correct status ID?

### 5. Membership Creation Trigger

**Check BRP Integration:**
- [ ] Is membership creation triggered when `leftToPay = 0`?
- [ ] Is membership creation triggered when order status changes to "Paid"?
- [ ] Are there any errors in BRP integration logs?
- [ ] Is the subscription properly linked to customer before membership creation?

---

## 🛠️ Testing Steps

### Test 1: Verify Webhook Arrival

1. Complete a test payment
2. Check backend logs for webhook arrival
3. **Expected**: Webhook POST request appears in logs
4. **If not**: Webhook URL is incorrect or webhooks are disabled

### Test 2: Verify Webhook Processing

1. Check webhook handler logs
2. **Expected**: Webhook is processed, order is updated
3. **If not**: Webhook handler has errors or isn't processing correctly

### Test 3: Verify Payment Registration

1. After webhook processing, fetch order: `GET /api/orders/{orderId}`
2. **Expected**: 
   - `leftToPay.amount = 0`
   - `orderStatus.name = "Betalet"` (or equivalent)
   - `preliminary = false`
3. **If not**: Payment registration logic isn't working

### Test 4: Verify Membership Creation

1. Check BRP for customer membership
2. **Expected**: Membership exists in BRP, linked to customer
3. **If not**: Membership creation trigger isn't firing or has errors

---

## 📋 Technical Details

### Order ID Format
- Order IDs from logs: `816675`, `816677`
- Format: Numeric ID

### Payment Link Generation
Client generates payment link with:
```json
{
  "orderId": 816677,
  "paymentMethodId": 1,
  "businessUnit": "12",
  "returnUrl": "https://join.boulders.dk/?payment=return&orderId=816677"
}
```

### Return URL Structure
- Format: `{siteUrl}?payment=return&orderId={orderId}`
- Example: `https://join.boulders.dk/?payment=return&orderId=816677`

**Note**: The return URL is for client-side redirect. The payment provider should send a separate webhook to the backend.

---

## 🎯 Action Items

### Immediate (High Priority)

1. **Check webhook configuration** in payment provider dashboard
2. **Verify webhook URL** is correct and accessible
3. **Check backend logs** for webhook arrival
4. **Test webhook processing** - manually trigger a test webhook if possible

### Short Term

1. **Fix webhook processing** if webhooks are arriving but not being processed
2. **Verify payment registration logic** - ensure `leftToPay = 0` is set
3. **Verify order status update** - ensure status changes to "Paid"
4. **Verify membership creation trigger** - ensure it fires when payment is registered

### Long Term

1. **Add webhook retry mechanism** if webhooks fail
2. **Add webhook logging** for debugging
3. **Add monitoring/alerting** for failed webhooks
4. **Add manual payment registration endpoint** (fallback if webhook fails)

---

## 📞 Contact & Support

**Client-Side Status**: ✅ Complete and working
- Order finalization: ✅ Working
- Payment polling: ✅ Working
- Error handling: ✅ Working

**Blocking Issue**: Backend webhook processing

**Next Steps**: Backend team needs to investigate and fix webhook configuration/processing.

---

## 📝 Additional Notes

### Client-Side Polling
The client-side code polls for payment registration for 10 seconds (5 attempts × 2 seconds). If payment isn't registered within this time, the user still sees the confirmation screen, but membership won't be created until the webhook arrives and is processed.

### Order Finalization
The client-side code attempts to set `preliminary: false` after payment return. This works, but payment registration (`leftToPay = 0`) is still required for membership creation.

### Membership Creation Dependency
Membership creation in BRP depends on:
1. ✅ Order exists with subscription item
2. ✅ Customer exists
3. ❌ Payment registered (`leftToPay = 0`) - **BLOCKING**
4. ❌ Order finalized (`preliminary = false`) - ✅ Client handles this
5. ❌ Subscription linked to customer - **Depends on payment registration**

---

**Priority**: 🔴 **HIGH** - Customers are completing payments but not receiving memberships.

**Impact**: Customers are paying but not getting the product they purchased.

**Urgency**: Fix immediately to prevent customer complaints and refunds.


