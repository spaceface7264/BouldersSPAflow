# Viewing the Checkout Funnel in Google Analytics 4

## Overview

This guide shows you how to view and verify your checkout funnel events in GA4, including both client-side and server-side events.

## Prerequisites

- Access to Google Analytics 4 property: `boulders-api-flow`
- Measurement ID: `G-5LK4VMR8E2`
- GTM Container: `GTM-KHB92N9P` (Web), `GTM-P8DL49HC` (Server)
- Events configured in GTM (select_item, add_to_cart, begin_checkout, purchase)

---

## Part 1: Real-Time Verification (DebugView)

### Step 1: Enable Debug Mode

**Option A: URL Parameter (Recommended)**
1. Add `?debug_mode=true` to your test URL
2. Example: `https://join.boulders.dk?debug_mode=true`

**Option B: GA Debugger Extension**
1. Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) Chrome extension
2. Enable it for your domain
3. Reload the page

### Step 2: Open GA4 DebugView

1. Go to [Google Analytics](https://analytics.google.com)
2. Select property: **boulders-api-flow**
3. Navigate to: **Admin** → **DebugView** (or use left sidebar)
4. You should see real-time events appearing

### Step 3: Complete Test Purchase

1. With debug mode enabled, complete a test purchase:
   - Select a product → Should see `select_item` event
   - Add to cart → Should see `add_to_cart` event
   - Click checkout → Should see `begin_checkout` event
   - Complete payment → Should see `purchase` event

### Step 4: Verify Events in DebugView

In DebugView, you should see:

1. **select_item** event
   - Event parameters: `item_id`, `item_name`, `price`, `quantity`
   - Ecommerce data: `items` array

2. **add_to_cart** event
   - Event parameters: `value`, `currency`, `items`
   - Ecommerce data: `items` array

3. **begin_checkout** event
   - Event parameters: `value`, `currency`, `items`
   - Ecommerce data: `items` array

4. **purchase** event
   - Event parameters: `transaction_id`, `value`, `currency`, `items`
   - Ecommerce data: `items` array

### Step 5: Verify Client ID and User ID

In DebugView, click on any event and check:

- **User ID**: Should show your BRP customer ID (if authenticated)
- **Client ID**: Should show GA4 client ID (e.g., `1234567890.1234567890`)
- **Event source**: Should show "web" for client-side events

**Note**: Server-side events may show different source. Both should have matching client IDs for stitching.

---

## Part 2: Viewing Events in Real-Time Reports

### Step 1: Open Real-Time Report

1. Go to GA4 → **Reports** → **Real-time**
2. Or use left sidebar: **Reports** → **Real-time**

### Step 2: View Events

1. Scroll down to **Event count by Event name**
2. You should see:
   - `select_item`
   - `add_to_cart`
   - `begin_checkout`
   - `purchase`

### Step 3: View Ecommerce Data

1. In Real-time report, scroll to **Ecommerce purchases**
2. Should show:
   - Purchase revenue
   - Purchase count
   - Items purchased

**Note**: Real-time reports show data from the last 30 minutes.

---

## Part 3: Creating a Funnel Exploration

### Step 1: Create Funnel Exploration

1. Go to GA4 → **Explore** (left sidebar)
2. Click **+ Blank** or **Template gallery**
3. Select **Funnel exploration**

### Step 2: Configure Funnel Steps

Add these steps in order:

1. **Step 1: Product Selection**
   - Event name: `select_item`
   - Name: "Product Selected"

2. **Step 2: Add to Cart**
   - Event name: `add_to_cart`
   - Name: "Added to Cart"

3. **Step 3: Begin Checkout**
   - Event name: `begin_checkout`
   - Name: "Checkout Started"

4. **Step 4: Purchase**
   - Event name: `purchase`
   - Name: "Purchase Completed"

### Step 3: Configure Funnel Settings

1. **Date Range**: Select your test period (e.g., Last 7 days)
2. **Dimensions**: 
   - Add `Event name` (already included)
   - Optionally add: `User ID`, `Client ID`, `Device category`
3. **Metrics**:
   - Users (default)
   - Conversions
   - Drop-off rate

### Step 4: View Funnel Results

The funnel will show:
- **Conversion rate** for each step
- **Drop-off rate** between steps
- **User count** at each step

**Example Output**:
```
Step 1: Product Selected      → 100 users (100%)
Step 2: Added to Cart         → 80 users (80%)  [20% drop-off]
Step 3: Checkout Started      → 60 users (60%)  [25% drop-off]
Step 4: Purchase Completed    → 50 users (50%)  [17% drop-off]
```

---

## Part 4: Viewing Ecommerce Reports

### Step 1: Ecommerce Overview

1. Go to GA4 → **Reports** → **Monetization** → **Ecommerce purchases**
2. View:
   - Total revenue
   - Purchases
   - Average purchase value
   - Items purchased

### Step 2: Ecommerce Events

1. Go to GA4 → **Reports** → **Engagement** → **Events**
2. Filter or search for:
   - `select_item`
   - `add_to_cart`
   - `begin_checkout`
   - `purchase`

### Step 3: View Event Details

Click on any event to see:
- **Event count**: How many times it fired
- **Users**: How many unique users
- **Parameters**: Event parameters (item_id, value, currency, etc.)
- **Ecommerce data**: Items, prices, quantities

---

## Part 5: Verifying Server-Side Event Stitching

### Step 1: Check Event Sources

1. Go to GA4 → **Reports** → **Engagement** → **Events**
2. Click on `purchase` event
3. Add dimension: **Event source** (if available)
4. You should see:
   - `web` (client-side events)
   - `server` or `sgtm` (server-side events, if configured)

### Step 2: Verify Client ID Matching

1. In DebugView, note the **Client ID** from a client-side event
2. Check server-side events (if visible)
3. Verify both events have the **same Client ID**

**Note**: Server-side events may not appear in standard GA4 reports if they're only sent to server container. Check your server-side GA4 setup.

### Step 3: Check User ID

1. In DebugView or Events report, filter by **User ID**
2. Verify that:
   - Client-side events have User ID (when authenticated)
   - Server-side events have matching User ID
   - Both are stitched together in GA4

---

## Part 6: Creating Custom Reports

### Custom Report: Checkout Funnel Performance

1. Go to GA4 → **Explore** → **+ Blank**
2. **Technique**: Choose **Funnel exploration** or **Free form**
3. **Dimensions**:
   - Event name
   - Date
   - Device category
   - User ID (if available)
4. **Metrics**:
   - Event count
   - Users
   - Conversions
5. **Filters**:
   - Event name: `select_item`, `add_to_cart`, `begin_checkout`, `purchase`

### Custom Report: Revenue by Step

1. Create **Free form** exploration
2. **Dimensions**: Event name
3. **Metrics**: 
   - Event count
   - Total revenue (from purchase events)
   - Average order value
4. **Visualization**: Bar chart or table

---

## Part 7: Using GA4 Query Builder (Advanced)

### Step 1: Access Query Builder

1. Go to GA4 → **Admin** → **Data API** → **Query Explorer**
2. Or use [GA4 Query Builder](https://ga-dev-tools.google/ga4/query-explorer/)

### Step 2: Build Query

**Example Query**:
```json
{
  "dateRanges": [{"startDate": "7daysAgo", "endDate": "today"}],
  "dimensions": [{"name": "eventName"}],
  "metrics": [
    {"name": "eventCount"},
    {"name": "totalUsers"}
  ],
  "dimensionFilter": {
    "filter": {
      "fieldName": "eventName",
      "inListFilter": {
        "values": ["select_item", "add_to_cart", "begin_checkout", "purchase"]
      }
    }
  }
}
```

### Step 3: Run Query

1. Execute query
2. View results in table format
3. Export if needed

---

## Part 8: Troubleshooting

### Issue: Events Not Appearing in GA4

**Checklist**:
1. ✅ GTM container is published
2. ✅ GA4 tags are configured in GTM
3. ✅ Measurement ID matches (`G-5LK4VMR8E2`)
4. ✅ Events are firing (check browser console)
5. ✅ Debug mode is enabled
6. ✅ Data stream is active in GA4

**Solution**:
- Check GTM Preview mode first
- Verify events in browser console (`window.dataLayer`)
- Check Network tab for GA4 collect requests

### Issue: Funnel Shows Zero Conversions

**Possible Causes**:
1. Not enough data (wait 24-48 hours for historical data)
2. Date range too narrow
3. Events not configured correctly
4. Filters excluding data

**Solution**:
- Use Real-time reports for immediate verification
- Check DebugView for event firing
- Verify event names match exactly

### Issue: Server-Side Events Not Visible

**Possible Causes**:
1. Server-side GA4 not configured
2. Events only sent to server container (not GA4)
3. Server container not forwarding to GA4

**Solution**:
- Check server-side GA4 configuration
- Verify server container is forwarding events
- Check Stape/GTM Server setup

### Issue: Client ID Mismatch

**Possible Causes**:
1. Client ID not captured correctly
2. Headers not sent to backend
3. Backend not using headers correctly

**Solution**:
- Verify `x-ga-client-id` header in Network tab
- Check backend logs for received headers
- Verify backend is using headers in GA4 events

---

## Part 9: Best Practices

### 1. Test in Debug Mode First

Always test with `?debug_mode=true` before relying on standard reports.

### 2. Use Real-Time Reports for Immediate Feedback

Real-time reports show data within seconds, perfect for testing.

### 3. Wait for Historical Data

Standard reports may take 24-48 hours to populate. Use Real-time or DebugView for immediate verification.

### 4. Monitor Funnel Drop-Offs

Track where users drop off in the funnel to identify optimization opportunities.

### 5. Compare Client vs Server Events

Verify that client-side and server-side events are stitching correctly using Client ID.

### 6. Set Up Custom Alerts

Create alerts in GA4 for:
- Purchase events dropping
- Funnel conversion rate changes
- Missing events

---

## Part 10: Quick Reference

### GA4 URLs

- **GA4 Home**: https://analytics.google.com
- **DebugView**: GA4 → Admin → DebugView
- **Real-time**: GA4 → Reports → Real-time
- **Events**: GA4 → Reports → Engagement → Events
- **Ecommerce**: GA4 → Reports → Monetization → Ecommerce purchases
- **Explore**: GA4 → Explore

### Event Names

- `select_item` - Product selected
- `add_to_cart` - Item added to cart
- `begin_checkout` - Checkout started
- `purchase` - Order completed

### Key Metrics

- **Event count**: Number of times event fired
- **Users**: Unique users who triggered event
- **Conversions**: Users who completed funnel step
- **Drop-off rate**: Percentage of users who didn't proceed to next step

---

## Related Documentation

- `docs/testing/TESTING_SERVER_SIDE_ANALYTICS.md` - Testing server-side analytics
- `docs/GTM_IMPLEMENTATION.md` - GTM setup
- `docs/TRACKING_DEBUG_GUIDE.md` - General tracking debugging
- `docs/implementation/SERVER_SIDE_ANALYTICS_IMPLEMENTATION.md` - Implementation details
