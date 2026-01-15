# Payment Link Endpoint Issue - Summary & Next Steps

## 🚨 Current Problem

**Payment link generation endpoint is returning 404 errors** despite multiple attempts to fix the path structure.

---

## 📋 What We've Tried

### Attempt 1: Full Path `/api/ver3/services/generatelink/payforcustomeraccount`
- **Result**: `404 - api/ver3/ver3/...` (duplication error)
- **Issue**: Backend seems to add `/api/ver3` automatically, causing duplication

### Attempt 2: Short Path `/services/generatelink/payforcustomeraccount`
- **Result**: `404 - Endpoint not found`
- **Issue**: Backend doesn't recognize the path without `/api/ver3` prefix

### Attempt 3: Different Base URL
- **Tried**: Using `https://boulders.brpsystems.com/apiserver` for ver3 endpoints
- **Result**: Still getting 404 errors
- **Issue**: Path structure still incorrect

---

## 🔍 What We Know

### From API Documentation
- **Endpoint**: `POST /api/ver3/services/generatelink/payforcustomeraccount`
- **API Server**: `https://boulders.brpsystems.com/apiserver`
- **Documentation URL**: https://boulders.brpsystems.com/brponline/external/documentation/api3?key=f43e5df0b0f74d2b82e93a4f4226ff96#post-/api/ver3/services/generatelink/payforcustomeraccount

### From Backend Team
- **Requirement**: "Generate Payment Link Card" request must be made when subscription is added to cart
- **Timing**: Immediately after `addSubscriptionItem()` call

### From Error Messages
- Error shows: `/apiserver/api/ver3/ver3/services/...` (duplication)
- Suggests backend adds `/api/ver3` automatically when it sees `/apiserver`

### Current Implementation
- **Payload**: `{ customer: <customerId>, paymentMethod: <paymentMethodId>, returnUrl: <returnUrl> }`
- **Customer ID**: ✅ Available (61859 in latest test)
- **Payment Method**: ✅ Mapped correctly (card -> 1)
- **Return URL**: ✅ Constructed correctly

---

## ❓ Questions for Backend Team

1. **What is the exact endpoint URL?**
   - Is it `/api/ver3/services/generatelink/payforcustomeraccount`?
   - Or is it a different path?

2. **What base URL should we use?**
   - `https://api-join.boulders.dk`?
   - `https://boulders.brpsystems.com/apiserver`?
   - Something else?

3. **Does the endpoint require `/apiserver` prefix?**
   - The error shows `/apiserver/api/ver3/ver3/...` suggesting backend adds `/api/ver3` automatically
   - Should we send path without `/api/ver3`?

4. **Is the payload structure correct?**
   - Current: `{ customer: <id>, paymentMethod: <id>, returnUrl: <url> }`
   - Is this correct, or do we need different fields?

5. **Should we use `orderId` instead of `customerId`?**
   - Documentation shows `customer` field, but maybe we should use `orderId`?

6. **Is there a different endpoint for order payments?**
   - Maybe there's a separate endpoint like `/api/orders/{orderId}/payment-link`?

---

## 🎯 Recommended Next Steps

### Option 1: Contact Backend Team (RECOMMENDED)
**Ask them:**
1. What is the exact endpoint URL for "Generate Payment Link Card"?
2. What base URL should we use?
3. What is the exact payload structure?
4. Can they provide a working example or Postman collection?

### Option 2: Check Postman Documentation
- Review the Postman collection if available
- Check if there's a different endpoint structure

### Option 3: Test with Direct API Call
- Try calling the endpoint directly (bypassing Cloudflare Pages proxy) to see the exact error
- This will help identify if it's a proxy issue or endpoint issue

### Option 4: Check Backend Logs
- Ask backend team to check their logs when we make the request
- See what URL they're actually receiving
- This will help identify the path duplication issue

---

## 📝 Current Code Status

### What's Working ✅
- Customer creation
- Order creation
- Subscription item addition
- Payment method mapping
- Return URL construction
- Error handling and logging

### What's Not Working ❌
- Payment link generation endpoint (404 errors)
- Payment redirect (blocked by missing payment link)

---

## 🔧 Temporary Workaround

Until we get the correct endpoint information:

1. **Document the issue** for backend team
2. **Continue testing other parts** of the checkout flow
3. **Wait for backend team** to provide correct endpoint details

---

## 📞 Action Items

1. **Contact Backend Team** with the questions above
2. **Share this document** with them
3. **Request**:
   - Exact endpoint URL
   - Base URL to use
   - Payload structure
   - Working example

---

**Last Updated**: 2025-11-11  
**Status**: Waiting for backend team clarification on endpoint structure

