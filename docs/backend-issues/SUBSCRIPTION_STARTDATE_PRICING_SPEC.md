# Backend Fix: Subscription startDate and Order Price (Pay Now)

**For:** Backend / API team (BRP / api-join.boulders.dk)  
**Purpose:** Single spec to fix the recurring bug where “Pay now” in the frontend does not match the price in the payment window.

---

## 1. The bug (current behaviour)

When the frontend adds a subscription to an order with **`startDate` = today** (e.g. `"2026-02-04"`):

- For **some products** (e.g. productId 134 “Medlemskab”), the backend:
  - **Ignores or overrides** the sent `startDate`.
  - Sets **`subscriptionItem.initialPaymentPeriod.start`** to a **future date** (e.g. 1st of next month) instead of the sent date.
  - Sets **`order.price.amount`** to the **full monthly price** instead of the prorated “pay now” amount.

- **Result:**  
  - Frontend shows correct “Pay now” (e.g. 419 kr, rest of month).  
  - Payment window uses **`order.price.amount`** → user sees **full month** (e.g. 469 kr).  
  - Mismatch and user confusion; frontend cannot fix the order when it is locked (403).

### Product-specific pattern (investigation hint)

- The issue appears **only for one specific product** (e.g. productId 134 “Medlemskab”), not for all subscription products.
- **Duplicating that product in the backend** initially fixed it: the duplicate showed the correct payment-window price.
- **Recently**, the duplicated product started showing the wrong payment-window price again (same symptom as the original).

This suggests the cause is likely **product-level configuration** (or something shared between original and duplicate), not only generic API code. Things for the backend team to check:

- **Product config in BRP:** Price list, billing rule, subscription type, “start date” / proration behaviour, or any setting that could force “first of next month” or full-month price for that product (or product type).
- **What the duplicate had different:** Compare original vs duplicate at the time the duplicate worked (e.g. new product ID, fresh config, different price list or billing rule).
- **What changed recently:** Deploys, BRP config changes, or global/subscription-type changes that could have affected both the original and the duplicate (e.g. same price list or billing rule updated, or a setting re-applied to all products of that type).

Fixing it properly likely means identifying and correcting the **product (or product-type) configuration** that causes this product to ignore `startDate` or use full-month price, so the behaviour is correct for this product and any duplicates going forward.

### Existing-member-only pattern (critical)

**The price error only happens when the purchaser has an existing membership.** New customers (no existing membership) get the correct prorated “pay now” and correct payment-window amount. Existing members get wrong payment-window price (full month).

This strongly narrows the cause:

- **Backend logic differs by “existing member” vs “new customer”.** When the order’s customer (or `subscriber`) already has an active subscription, the API or BRP may:
  - Use a different code path (e.g. “add subscription for existing member” / “renewal” / “upgrade” instead of “new subscription”).
  - Apply a rule like “existing member → start date = first of next month” (to avoid overlap) or “no proration for existing members”.
  - Set `order.price.amount` to full month for “existing member” flows while correctly prorating for new customers.

**What the backend team should check:**

- **Code paths:** Where does add-subscription or order pricing branch on “customer already has membership”? Ensure the same `startDate` and proration rules apply regardless of existing membership (unless business explicitly requires otherwise).
- **BRP / config:** Any rule or setting that says “if customer has active subscription, use start date = next month” or “full month only for existing members”. If present, either remove it or align it with the required behaviour (prorate from sent `startDate` for everyone).
- **Payment link:** When generating the payment link, does the backend use different logic (e.g. recalculate amount) when the order’s customer has an existing subscription? The amount sent to the payment window must match `order.price.amount` from the add-subscription response for all customers.

**Frontend:** We send `subscriber: customerId` when the user is logged in (same for new and existing members). We do not change `startDate` based on “existing membership”. So the wrong price for existing members is coming from backend behaviour that reacts to “this customer already has a membership.”

### Speculation: what could be causing it, and is frontend doing anything wrong?

**Likely backend-side:**

- **Product/price-list config in BRP** – One product (or its price list / billing rule) is set to “first of next month” or “full month only”, so the API ignores `startDate` or overwrites proration for that product. Duplicate worked because it had a different config; duplicate broke when config was synced or a global change re-applied to that product type.
- **Async price overwrite** – After `POST .../items/subscriptions` the backend might return a correct prorated price, then an async job or later step (e.g. when building payment session) recalculates the order total using a different rule (e.g. full month for this product). The 2s wait before “final” order fetch could then expose that: we fetch “correct” order once, then by the time the payment link is generated the backend has overwritten the order total. So the bug could be “order is correct briefly, then something overwrites it”.
- **Payment link API uses a different source** – Payment link might not use `order.price.amount` as stored at add-subscription time, but e.g. “recalculate from product price list” or “read from subscription item” with product-specific logic that uses full month for this product. So add-subscription response could be correct, but payment window shows a different number.

**Frontend – could we be contributing?**

- **We are not sending the amount to the payment API** – `generatePaymentLink` sends only `orderId`, `paymentMethodId`, `returnUrl`, `receiptEmail`, `businessUnit`. The amount in the payment window comes entirely from the backend. So we are not “sending the wrong price” or overriding it.
- **startDate format and value** – We send `startDate: getTodayLocalDateString()` (YYYY-MM-DD, local date). Pay Now is correctly 419 kr (rest of month before 16th), so our idea of “today” and proration is correct. If we were sending a wrong or missing `startDate`, the backend would get wrong input; worth double-checking in network tab that the request body actually contains `startDate` with today’s date when the issue happens.
- **Order reuse** – We reuse `state.orderId` if it already exists (`ensureOrderCreated`). If the user resumes an old session (same tab/localStorage) or navigates back, we might be reusing an order that was created earlier and already has the wrong price (or is locked). So “payment window wrong” could sometimes be “we’re looking at an old order”. Mitigation: ensure we only reuse an order when it’s the current checkout (e.g. same session, same product); otherwise create a new order.
- **The 2s wait before final order fetch** – We wait 2s then `getOrder` then `generatePaymentLink`. We don’t “cause” the wrong price by waiting; but if the backend overwrites the order total after a delay, this flow would expose it. So the timing is worth mentioning to the backend team (“do you recalculate order price asynchronously after add subscription?”).
- **Display override** – When verification fails we show a *calculated* “Pay now” (e.g. 419 kr) instead of `order.price.amount`. That doesn’t change what the payment window shows; it only makes the mismatch visible. So it’s not a cause, but it’s why the user sees “Pay now 419 kr” vs “payment window full month”.

**Summary:** The wrong amount in the payment window is almost certainly coming from backend (order total or how payment link is built). The only frontend things worth checking are: (1) that we really send `startDate` with today’s date in the add-subscription request when the bug happens, and (2) that we’re not reusing an old order from a previous session when we think we’re in a fresh checkout.

---

## 2. Required behaviour (contract)

**Endpoint:** `POST /api/ver3/orders/{orderId}/items/subscriptions`  
**Request body (relevant):** `subscriptionProduct`, `birthDate`, **`startDate`** (optional, type `Day` = `YYYY-MM-DD`).

When the client sends **`startDate`**:

1. **Respect `startDate`**
   - **`subscriptionItem.initialPaymentPeriod.start`** MUST equal the **provided `startDate`** (same calendar day).  
   - Do not replace it with “1st of next month” or any other default for subscription start.

2. **Set order total to the “pay now” amount**
   - **`order.price.amount`** (and any total shown to the user) MUST be the **prorated “pay now” amount** for that subscription, based on **that same `startDate`**, using the rules below.

3. **Pricing rules (must match frontend / business rule)**
   - Let **day of month** = day part of **`startDate`** (e.g. 4 for `2026-02-04`).
   - **If `startDate` day < 16:**  
     “Pay now” = **rest of current month only** (prorated).  
     - `initialPaymentPeriod.end` = last day of **current** month.
   - **If `startDate` day >= 16:**  
     “Pay now” = **rest of current month (prorated) + full next month**.  
     - `initialPaymentPeriod.end` = last day of **next** month.

So:

- **Single source of truth for “what the user will pay”** = **`order.price.amount`**.
- Payment link / payment window use this same value → no divergence from “Pay now” in the UI.

---

## 3. Response contract (what frontend expects)

After `POST .../orders/{orderId}/items/subscriptions` with e.g. `startDate: "2026-02-04"`:

- **`order.price`** (e.g. `CurrencyOut`) = total order amount. For a single subscription with no add-ons, this MUST be the “pay now” amount computed from `startDate` with the rules above (e.g. in **cents** in `amount` if that’s your schema).
- **`subscriptionItems[0].initialPaymentPeriod`** (e.g. `DayRange`):
  - **`start`** = `"2026-02-04"` (the sent `startDate`).
  - **`end`** = last day of the first payment period (current month if day < 16, next month if day >= 16).

If the backend returns a different `initialPaymentPeriod.start` or a different `order.price` than the prorated amount, the frontend treats it as a bug and may try to fix by delete + re-add; when the order is locked (403), the user is stuck with a wrong price in the payment window.

---

## 4. Example (day < 16)

- **Request:** `startDate: "2026-02-04"`, monthly price 469 kr.
- **Day 4 < 16** → “Pay now” = rest of February only (prorated).
- **Expected:**
  - `initialPaymentPeriod.start` = `"2026-02-04"`.
  - `initialPaymentPeriod.end` = last day of February (e.g. `"2026-02-28"`).
  - `order.price.amount` = prorated amount for 4–28 Feb (e.g. 419 kr in the same unit/cents as your API).

---

## 5. Example (day >= 16)

- **Request:** `startDate: "2026-02-16"`, monthly price 469 kr.
- **Day 16 >= 16** → “Pay now” = rest of February (prorated) + full March.
- **Expected:**
  - `initialPaymentPeriod.start` = `"2026-02-16"`.
  - `initialPaymentPeriod.end` = last day of **March** (e.g. `"2026-03-31"`).
  - `order.price.amount` = (prorated Feb 16–28) + (full March).

---

## 6. How to verify the fix

1. **For a given product (e.g. 134):**
   - Call `POST /api/ver3/orders/{orderId}/items/subscriptions` with **`startDate` = today** (same day, local date).
2. **Check response:**
   - `subscriptionItems[0].initialPaymentPeriod.start` === sent `startDate` (same calendar day).
   - `order.price.amount` equals the prorated “pay now” amount (day < 16: rest of month; day >= 16: rest of month + next month).
3. **Generate payment link** for that order; the amount shown in the payment window MUST equal `order.price.amount` (and thus the “Pay now” shown in the frontend when it uses the order as source of truth).

---

## 7. References

- **OpenAPI:** `docs/brp-api3-openapi.yaml`  
  - `POST /api/ver3/orders/{order}/items/subscriptions` (request: `startDate` as `Day`).  
  - Response: `OrderOut` (`price`), `SubscriptionItemOut` (`initialPaymentPeriod` = `DayRange`).
- **Existing docs in this repo:**
  - `ORDER_LOCKED_PRICING_FIX_FAILS.md` – why frontend fix (delete + re-add) fails when order is locked.
  - `BACKEND_BUG_PRODUCTID_134.md` / `VERIFICATION_COMPLETE_BACKEND_BUG_CONFIRMED.md` – earlier reports of startDate/price mismatch.
- **Frontend:** Uses `getTodayLocalDateString()` for `startDate` (YYYY-MM-DD, local date); expects same date and prorated price in the response.

---

## 8. Summary for backend

| Requirement | Detail |
|------------|--------|
| **Respect `startDate`** | Use the sent `startDate` for `initialPaymentPeriod.start` (same calendar day). Do not replace with 1st of next month. |
| **Prorate “pay now”** | Set `order.price.amount` to the prorated amount: day < 16 → rest of current month; day >= 16 → rest of current month + full next month. |
| **Apply to all products** | Behaviour must be consistent for all subscription products (e.g. 134, 56, 135), not only some. |

Once this is implemented, the frontend can use **`order.price.amount`** as the single source for “Pay now” and the payment window will always match.
