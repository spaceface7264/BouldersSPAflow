# Analysis: Payment window shows full price (not Pay Now) for product 537 – existing members

**Symptom:** For users with an **existing membership**, the price shown in the **payment window** differs from **Pay Now** in our UI: the payment window shows **full monthly price** regardless of day of month, specifically for **product ID 537**.

**Conclusion:** The wrong amount in the payment window is almost certainly coming from **backend behaviour** when the customer is an existing member (and possibly product-specific config for 537). The frontend does not send the amount to the payment API; it only sends `orderId` and related params. The payment window amount is determined by the backend.

---

## 1. Why the payment window shows a different price

- **Payment window amount** is **not** sent by the frontend. We call the payment-link API with `orderId`, `paymentMethodId`, `returnUrl`, etc. The amount the user sees in the payment provider’s window is whatever the backend passes when creating the payment session (typically derived from `order.price.amount` or a backend recalculation).
- So if the payment window shows **full price** while our UI shows **prorated “Pay now”**, the backend is either:
  - returning **full price** in `order.price.amount` from `POST .../orders/{orderId}/items/subscriptions` when the customer is an existing member, or
  - using a **different amount** when generating the payment link for existing members (e.g. recalculating from product/price list with a “full month” rule).

---

## 2. Existing-member-only pattern (from spec)

From `SUBSCRIPTION_STARTDATE_PRICING_SPEC.md`:

- The price error **only happens when the purchaser has an existing membership**. New customers get correct prorated “pay now” and correct payment-window amount.
- So the backend is very likely branching on “customer already has membership” and applying different logic (e.g. “existing member → start date = first of next month” or “no proration for existing members”), which leads to full-month price for the order or for the payment session.

**What we send:**

- When the user is **logged in**, we send **`subscriber: customerId`** in the add-subscription payload (same for new and existing members).
- We **always** send **`startDate: getTodayLocalDateString()`** (YYYY-MM-DD). We do **not** change `startDate` based on existing membership.
- So the trigger for “existing member” behaviour is the presence of `subscriber` and the backend’s interpretation of that (e.g. “this customer already has a membership” → different pricing path).

---

## 3. Why product 537 specifically?

- The spec describes a **product-specific** pattern (e.g. product 134 “Medlemskab” had the same kind of bug; a duplicate product initially worked then broke again), suggesting **product-level or product-type configuration** in the backend (price list, billing rule, “start date” / proration behaviour).
- **Product 537** may have (or share) config that:
  - Forces “first of next month” or “full month only” when the request includes `subscriber`, or
  - Is used in an “existing member” code path that always applies full-month price for that product.

The frontend has **no product-537-specific logic**. We treat all subscription products the same (same payload shape: `startDate`, `subscriber` when logged in). So the difference is on the backend side for this product (or product type).

---

## 4. Why our UI can show “correct” Pay Now while the payment window is wrong

In **`updatePaymentOverview()`** we:

1. Read **`state.fullOrder.price.amount`** (order total from backend).
2. **Verify** it against our **client-side proration** via **`_calculateExpectedPartialMonthPrice(productId, startDate)`** (same rules as spec: day &lt; 16 → rest of month; day ≥ 16 → rest of month + full next month).
3. If the backend price is **wrong** (mismatch beyond rounding), we **override the displayed “Pay now”** with our calculated value so the user sees the **correct prorated amount** in the cart.
4. We **do not** change the order or the payment link. The payment window still uses whatever amount the backend attaches to the payment session.

So:

- **UI “Pay now”** = our calculated prorated amount (when we detect backend is wrong).
- **Payment window** = backend’s amount (full month for existing member + product 537).

That’s why the two can differ.

---

## 5. Checkout verification (when we block redirect)

Before generating the payment link we **verify** subscription pricing (see checkout flow in `app.js`):

- We compare **`state.fullOrder`** (from add-subscription response) to **`_calculateExpectedPartialMonthPrice(productId, startDate)`**.
- If the difference is **&gt; 100 cents** we **block** redirect and show: *“Unable to process payment due to a system issue...”*.

So in theory we can block when the **order** we have is wrong. The payment window can still show full price if:

- The **order** returned from **add-subscription** is already wrong (full price) and for some reason the verification doesn’t fire (e.g. product 537 not in our catalog so `_calculateExpectedPartialMonthPrice` returns `null` and we fall back to backend price), or
- The backend **overwrites** the order total **after** the response (e.g. async job or when building the payment session), so our stored `state.fullOrder.price` is “correct” when we check, but the payment link is generated with a different (full) amount for existing members.

Either way, the **source** of the wrong payment-window amount is backend logic that runs when the customer is an existing member (and possibly for product 537).

---

## 6. What the backend team should check (product 537, existing members)

| Area | What to check |
|------|----------------|
| **Code paths** | Where does add-subscription or order/payment pricing branch on “customer already has membership” or “subscriber present”? Ensure **same** `startDate` and **proration** rules for existing members as for new customers (unless business explicitly requires otherwise). |
| **Product 537** | Product-level (or product-type) config: price list, billing rule, subscription type, “start date” / proration behaviour. Any setting that forces “first of next month” or “full month only” for this product when the request includes `subscriber`. |
| **Payment link API** | When generating the payment link for an order with an existing-member subscription (e.g. product 537), does the backend use **`order.price.amount`** as stored at add-subscription time, or does it **recalculate** (e.g. from product/price list)? If it recalculates, that logic may be applying full-month price for existing members. |
| **Contract** | Align with `SUBSCRIPTION_STARTDATE_PRICING_SPEC.md`: respect sent `startDate`, set `order.price.amount` to prorated “pay now”, and use that same value for the payment window. |

---

## 7. Frontend summary

- We **do not** send the amount to the payment API.
- We send **`startDate`** (today) and **`subscriber`** (when logged in) for all subscription products, including 537.
- We **detect** backend price errors and **override the displayed “Pay now”** so the user sees the correct prorated amount when possible; we **cannot** change the amount in the payment window.
- We **block** checkout when the **order** we have fails our price verification (mismatch &gt; 100 cents); if the backend later overwrites the order or uses a different amount for the payment session, the payment window can still show full price.

**Root cause** of “payment window shows full price for product 537 when user has existing membership” is therefore on the **backend**: different handling of existing members and/or product 537, leading to full-month price in the order or in the payment session. Fixing it requires backend changes as in the spec and the checks above.
