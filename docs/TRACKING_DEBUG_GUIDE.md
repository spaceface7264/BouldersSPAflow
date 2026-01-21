# GTM Tracking Debug Guide

## ⚠️ CRITICAL: Enable Debug Mode First!

**If you're not seeing events in GA4 DebugView, you need to enable debug mode:**

1. Add `?debug_mode=true` to your URL:
   ```
   https://your-site.com?debug_mode=true
   ```

2. Verify it's enabled in browser console:
   ```javascript
   window.GTM.isDebugMode()  // Should return true
   ```

3. Now check GA4 → **Admin** → **DebugView** for real-time events

---

## Quick Debug Checklist

### 1. Verify Events Are Firing in Browser

Open browser console on your test purchase page and check:

```javascript
// Check if DataLayer exists and has events
console.log('DataLayer:', window.dataLayer);

// Check if GTM is loaded
console.log('GTM Container:', window.GTM_CONTAINER_ID);

// Check if GTM utils are loaded
console.log('GTM Utils:', window.GTM);

// Filter for purchase events
window.dataLayer.filter(e => e.event === 'purchase')
```

**Expected:** You should see events with `event: 'purchase'` and `ecommerce` data.

**Note:** The page reloads on payment return, so the DataLayer resets. To confirm `purchase`, use Network → Preserve log and look for `collect` requests with `en=purchase`, or use GTM Preview mode.

### 2. Check Browser Console for GTM Logs

Look for `[GTM]` prefixed messages:
- `[GTM] Pushed event: purchase`
- `[GTM] Pushed event: add_to_cart`
- `[GTM] Pushed event: begin_checkout`
- `[GTM] Pushed event: select_item`

**If you don't see these:** Events aren't firing from the code.

**Tip:** Enable "Preserve log" in Console to keep logs across payment redirects.

### 3. Verify GTM Container is Loaded

In browser console:
```javascript
// Check if GTM script loaded
document.querySelector('script[src*="googletagmanager.com/gtm.js"]')

// Check DataLayer initialization
window.dataLayer[0] // Should show {gtm.start: timestamp, event: 'gtm.js'}
```

### 4. Use GTM Preview Mode

1. Go to [Google Tag Manager](https://tagmanager.google.com)
2. Select container `GTM-KHB92N9P`
3. Click **Preview** button
4. Enter your test URL: `https://9da3de67.bouldersspaflow-preview.pages.dev`
5. Click **Connect**
6. Complete a test purchase
7. In Preview mode, check:
   - **Tags** tab: See which tags fired
   - **DataLayer** tab: See events pushed
   - **Summary** tab: See all events

**Expected:** You should see:
- `GA4 - Configuration` tag firing
- `GA4 - Purchase` tag firing when purchase completes
- DataLayer events visible

### 4a. When Events Should Fire
- `select_item`: when a plan card is selected
- `add_to_cart`: when items are added to cart
- `begin_checkout`: when checkout starts
- `purchase`: after payment is confirmed on the success page

### 5. Verify GA4 Configuration in GTM

**Required Tags in GTM Container:**

1. **GA4 Configuration Tag**
   - Tag Type: `Google Analytics: GA4 Configuration`
   - Measurement ID: Your GA4 Measurement ID (format: `G-XXXXXXXXXX`)
   - Trigger: `All Pages`
   - **Status:** Must be published and firing

2. **GA4 Purchase Event Tag**
   - Tag Type: `Google Analytics: GA4 Event`
   - Configuration Tag: Select your GA4 Configuration tag
   - Event Name: `purchase`
   - Trigger: `Custom Event` → Event name: `purchase`
   - **Ecommerce:** Enable "Use data from the ecommerce event"
   - **Status:** Must be published and firing

3. **Repeat for other events:**
   - `select_item`
   - `add_to_cart`
   - `begin_checkout`

### 6. Verify GA4 Data Stream

1. Go to [Google Analytics](https://analytics.google.com)
2. Select property: `boulders-api-flow`
3. Go to **Admin** → **Data Streams**
4. Check if you have a **Web** stream configured
5. Verify:
   - **Stream URL:** Should match your domain
   - **Measurement ID:** Should match what's in GTM
   - **Status:** Should be "Active"

**If no stream exists:** Create a new Web stream and connect it to your website.

### 7. Enable Debug Mode and Check GA4 DebugView

**IMPORTANT:** To see events in GA4 DebugView, you MUST enable debug mode first!

#### Option 1: URL Parameter (Recommended)

Add `?debug_mode=true` to your URL:

```
https://your-site.com?debug_mode=true
```

**How it works:**
- The code automatically detects the `debug_mode=true` parameter
- All GA4 events will include `debug_mode: true`
- Events appear in GA4 DebugView in real-time

**To verify it's enabled:**
```javascript
// Check in browser console
console.log('Debug mode enabled:', window.GTM.isDebugMode());
```

#### Option 2: Google Analytics Debugger Extension

Install the [Google Analytics Debugger Chrome Extension](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna)

#### Check DebugView

1. Go to GA4 → **Admin** → **DebugView**
2. Open your site with `?debug_mode=true` in the URL
3. Complete a test purchase or trigger events
4. Watch for events appearing in real-time in DebugView

**Expected:** You should see events appear within seconds with full event parameters.

## Common Issues

### Issue: "No stream data detected" in GA4 Events

**Possible Causes:**
1. **GTM tags not configured** → Follow Step 5 above
2. **GTM container not published** → Publish your GTM container
3. **GA4 Measurement ID mismatch** → Verify Measurement ID in GTM matches GA4 property
4. **Data stream not connected** → Follow Step 6 above
5. **Events not firing** → Check browser console (Step 1-2)

### Issue: Events fire but don't appear in GA4

**Possible Causes:**
1. **GTM Preview mode shows tags firing but GA4 not receiving:**
   - Check GA4 Configuration tag has correct Measurement ID
   - Verify "Send to server container" is configured correctly
   - Check GA4 DebugView for errors

2. **Data stream not active:**
   - Verify data stream is connected to correct domain
   - Check stream status in GA4 Admin

### Issue: Purchase event not firing

**Check in browser console:**
```javascript
// Check if conditions are met
console.log('Payment Confirmed:', state.paymentConfirmed);
console.log('Cart Items:', state.cartItems);
console.log('GTM Available:', window.GTM && window.GTM.trackPurchase);
```

**If `state.paymentConfirmed` is false:** Payment confirmation logic might not be working.

**If `state.cartItems` is empty:** Cart might be cleared before purchase event fires.

## Testing Checklist

- [ ] Browser console shows `[GTM] Pushed event: purchase`
- [ ] DataLayer contains purchase event with ecommerce data
- [ ] GTM Preview mode shows `GA4 - Purchase` tag firing
- [ ] GA4 DebugView shows purchase event in real-time
- [ ] GA4 Events page shows data (may take 24-48 hours for historical data)

## Next Steps

1. **Complete test purchase** with browser console open
2. **Check console** for `[GTM]` messages
3. **Use GTM Preview mode** to verify tags are firing
4. **Check GA4 DebugView** for real-time events
5. **If still not working:** Verify GTM container is published and GA4 tags are configured
