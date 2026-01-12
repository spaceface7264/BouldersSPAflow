# GTM Tracking Debug Guide

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

### 2. Check Browser Console for GTM Logs

Look for `[GTM]` prefixed messages:
- `[GTM] Pushed event: purchase`
- `[GTM] Pushed event: add_to_cart`
- `[GTM] Pushed event: begin_checkout`
- `[GTM] Pushed event: select_item`

**If you don't see these:** Events aren't firing from the code.

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

### 7. Check GA4 DebugView (Real-time)

1. Go to GA4 → **Admin** → **DebugView**
2. Enable debug mode (add `?debug_mode=true` to URL or use GA Debugger extension)
3. Complete a test purchase
4. Watch for events in real-time

**Expected:** You should see `purchase` event appear within seconds.

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
