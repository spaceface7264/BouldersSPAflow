# Question for Backend Team: Payment Link Endpoint

## 🎯 Quick Question

**What is the exact endpoint URL and base URL for "Generate Payment Link Card"?**

We're getting 404 errors when trying to call the payment link generation endpoint.

---

## 📋 What We're Trying

**Endpoint from Documentation:**
- `POST /api/ver3/services/generatelink/payforcustomeraccount`
- Documentation: https://boulders.brpsystems.com/brponline/external/documentation/api3?key=f43e5df0b0f74d2b82e93a4f4226ff96#post-/api/ver3/services/generatelink/payforcustomeraccount

**Current Payload:**
```json
{
  "customer": 61859,
  "paymentMethod": 1,
  "returnUrl": "https://join.boulders.dk/?payment=return&orderId=817218"
}
```

---

## ❌ Errors We're Getting

### Error 1: Path Duplication
```
404 - "No static resource api/ver3/ver3/services/generatelink/payforcustomeraccount"
Instance: "/apiserver/api/ver3/ver3/services/generatelink/payforcustomeraccount"
```
**Suggests**: Backend adds `/api/ver3` automatically when it sees `/apiserver`

### Error 2: Endpoint Not Found
```
404 - "Endpoint not found"
```
**When trying**: `/services/generatelink/payforcustomeraccount` (without `/api/ver3`)

---

## ❓ Questions

1. **What is the exact endpoint URL?**
   - Full URL including base URL
   - Should we use `https://api-join.boulders.dk` or `https://boulders.brpsystems.com/apiserver`?

2. **What path should we send?**
   - `/api/ver3/services/generatelink/payforcustomeraccount`?
   - `/services/generatelink/payforcustomeraccount`?
   - Something else?

3. **Is the payload structure correct?**
   - `{ customer: <id>, paymentMethod: <id>, returnUrl: <url> }`
   - Or do we need different/additional fields?

4. **Should we use `orderId` instead of `customerId`?**
   - Documentation shows `customer` field, but maybe we should use `orderId`?

5. **Can you provide a working example?**
   - Postman collection?
   - cURL command?
   - Example request/response?

---

## 📊 Current Flow

1. ✅ Create customer → Customer ID: 61859
2. ✅ Create order → Order ID: 817218
3. ✅ Add subscription item → Success
4. ❌ Generate payment link → **404 Error**

---

## 🔍 What We've Tried

- Full path: `/api/ver3/services/generatelink/payforcustomeraccount` → Duplication error
- Short path: `/services/generatelink/payforcustomeraccount` → 404 Not Found
- Different base URLs → Still 404

---

**Please provide the correct endpoint details so we can fix this!**

**Contact**: [Your contact info]  
**Date**: 2025-11-11

