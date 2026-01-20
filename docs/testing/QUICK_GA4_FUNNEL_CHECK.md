# Quick Check: View Funnel in GA4 (5 Minutes)

## Step 1: Enable Debug Mode

1. Add `?debug_mode=true` to your URL
2. Example: `https://join.boulders.dk?debug_mode=true`
3. Reload page

## Step 2: Open GA4 DebugView

1. Go to [Google Analytics](https://analytics.google.com)
2. Select property: **boulders-api-flow**
3. Click **Admin** → **DebugView** (or left sidebar)

## Step 3: Complete Test Purchase

1. **Select product** → Look for `select_item` in DebugView
2. **Add to cart** → Look for `add_to_cart` in DebugView
3. **Click checkout** → Look for `begin_checkout` in DebugView
4. **Complete payment** → Look for `purchase` in DebugView

## ✅ Success!

If you see all 4 events in DebugView → **Funnel is working!**

---

## View in Real-Time Report

1. GA4 → **Reports** → **Real-time**
2. Scroll to **Event count by Event name**
3. Should see: `select_item`, `add_to_cart`, `begin_checkout`, `purchase`

---

## Create Funnel Exploration

1. GA4 → **Explore** → **+ Blank**
2. Choose **Funnel exploration**
3. Add steps:
   - Step 1: `select_item` → "Product Selected"
   - Step 2: `add_to_cart` → "Added to Cart"
   - Step 3: `begin_checkout` → "Checkout Started"
   - Step 4: `purchase` → "Purchase Completed"
4. View conversion rates and drop-offs

---

## View Ecommerce Data

1. GA4 → **Reports** → **Monetization** → **Ecommerce purchases**
2. See revenue, purchases, items

---

## Full Guide

See `VIEWING_FUNNEL_IN_GA4.md` for comprehensive instructions.
