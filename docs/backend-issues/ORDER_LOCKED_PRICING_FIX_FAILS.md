# Order Locked (403) – Why Price Fix Fails

## For payment / pricing expert and PI

### User-visible symptoms (localhost and production)

- **Pay now date range** shows until end of current month (or wrong range) after a few seconds.
- **Price in payment window** does not match the actual “pay now” amount (e.g. shows full month instead of partial month).
- See also: `BACKEND_BUG_PRODUCTID_134.md`, `VERIFICATION_COMPLETE_BACKEND_BUG_CONFIRMED.md`.

### What you see in console

- `DELETE /api/ver3/orders/{orderId}/items/subscriptions/{subscriptionItemId}` → **403 Forbidden**
- `[Step 7] Strategy error: Error: Order is locked (403 Forbidden)` (in `_tryStrategyDeleteAndReadd`)
- `[Step 7] ❌ All strategies failed to fix pricing mismatch for productId: 537`
- `[Step 7] ❌ Order may have pricing discrepancy - verification will continue`

### Why price is “failing”

1. **Backend pricing bug**  
   The backend sometimes ignores `startDate` when adding a subscription to an order and uses a wrong start date, so the order gets a **wrong (partial‑month) price**.

2. **Our fix**  
   We try to correct it by **deleting** the subscription item and **re‑adding** it with the correct payload (several strategies in `_fixBackendPricingBug` → `_tryStrategyDeleteAndReadd`). That requires:
   - `DELETE /api/ver3/orders/{orderId}/items/subscriptions/{subscriptionItemId}`  
   and then POST to add the subscription again.

3. **Why the fix fails**  
   For this order the backend returns **403 Forbidden** with “Order is locked”. When the order is locked, we are **not allowed to delete or change** the subscription item. So:
   - Every strategy (delete + re‑add) hits 403 on the DELETE.
   - All strategies fail → “All strategies failed to fix pricing mismatch”.
   - We continue with the existing (possibly wrong) order price, hence “Order may have pricing discrepancy”.

### When does the order get locked?

The backend locks an order when it is in a state that no longer allows item changes, for example:

- After a payment link has been generated or the user has been sent to the payment provider, or
- After some other backend rule that marks the order as non‑editable.

So this typically happens when:

- The user **resumes** an old checkout (e.g. same order was already used or payment was started), or
- The order was locked **earlier** than we expect (e.g. right after adding the subscription once).

### Summary for payment / pricing and PI

| Item | Explanation |
|------|-------------|
| **Why price fails** | Backend can ignore `startDate` → wrong price. Our fix is “delete + re‑add” subscription item. |
| **Why fix fails** | Order is **locked** (403). Locked orders cannot be modified, so DELETE subscription item is rejected. |
| **Result** | Pricing fix cannot run; user may see wrong price if they continue. |
| **Recommendation** | User should **start a new checkout** (new order). We show a message when we detect order locked during pricing fix. |

### Technical details

- **Flow**: `addSubscriptionItem` → detects wrong start date / price → `_fixBackendPricingBug` → `_tryStrategyDeleteAndReadd` (DELETE then POST).
- **403 handling**: In `_tryStrategyDeleteAndReadd`, a 403 on DELETE is turned into an error with `isOrderLocked: true`. That error is **rethrown** from the outer catch so `_fixBackendPricingBug` can catch it and return `null` immediately (no further strategies). Previously the outer catch swallowed the error and returned `null`, so the caller thought the strategy “failed for other reasons” and ran strategies 2–4, causing multiple 403 DELETEs.
- **User message**: When the pricing fix fails because the order is locked, the app shows a toast telling the user to start a new checkout.
- **Localhost**: Same behaviour; backend may lock the order soon after the subscription item is added, so the fix (delete + re-add) often cannot run.
