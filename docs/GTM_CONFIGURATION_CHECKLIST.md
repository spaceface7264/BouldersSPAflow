# GTM Configuration Checklist - Quick Fix

## Problem: GTM loads but no data in GA4

**Root Cause:** GTM container is installed, but GA4 tags are not configured in GTM.

## Step-by-Step Fix

### 1. Verify Events Are Being Pushed (Browser Console)

On your test page, open browser console and check:

```javascript
// Check DataLayer for events
window.dataLayer.filter(e => e.event)

// Should see events like:
// - {event: 'select_item', ecommerce: {...}}
// - {event: 'add_to_cart', ecommerce: {...}}
// - {event: 'begin_checkout', ecommerce: {...}}
// - {event: 'purchase', ecommerce: {...}}
```

**If you see events:** ✅ Events are firing, proceed to Step 2.
**If no events:** ❌ Events aren't firing - check code implementation.

### 2. Configure GA4 in GTM (CRITICAL - This is likely missing)

Go to [Google Tag Manager](https://tagmanager.google.com) → Select container `GTM-KHB92N9P`

#### 2.1 Create GA4 Configuration Tag

1. **Tags → New**
2. **Tag Configuration:**
   - Choose: **Google Analytics: GA4 Configuration**
   - **Measurement ID:** Enter your GA4 Measurement ID
     - Format: `G-XXXXXXXXXX`
     - Find it in: GA4 → Admin → Data Streams → Your Web Stream → Measurement ID
   - **Send to server container:** Enable (if using Stape)
   - **Server container URL:** `https://gtm.join.boulders.dk` (or your Stape domain)
   - **Container ID:** `GTM-P8DL49HC`
3. **Triggering:**
   - Choose: **All Pages**
4. **Name:** `GA4 - Configuration`
5. **Save**

#### 2.2 Create GA4 Purchase Event Tag

1. **Tags → New**
2. **Tag Configuration:**
   - Choose: **Google Analytics: GA4 Event**
   - **Configuration Tag:** Select `GA4 - Configuration` (from Step 2.1)
   - **Event Name:** `purchase`
   - **Ecommerce:** ✅ Enable "Use data from the ecommerce event"
   - **Send to server container:** Enable (if using Stape)
   - **Server container URL:** Your Stape domain
   - **Container ID:** `GTM-P8DL49HC`
3. **Triggering:**
   - Choose: **Custom Event**
   - **Event name:** `purchase`
4. **Name:** `GA4 - Purchase`
5. **Save**

#### 2.3 Create Other Event Tags (Repeat for each)

Create similar tags for:
- **`add_to_cart`** → Trigger: Custom Event `add_to_cart`
- **`begin_checkout`** → Trigger: Custom Event `begin_checkout`
- **`select_item`** → Trigger: Custom Event `select_item`

**For each tag:**
- Use same Configuration Tag (`GA4 - Configuration`)
- Enable "Use data from the ecommerce event"
- Set trigger to Custom Event matching the event name

### 3. Publish GTM Container

**CRITICAL:** Tags won't work until published!

1. Click **Submit** button (top right)
2. Add version name: `Add GA4 ecommerce tracking`
3. Add description: `Configure GA4 tags for purchase, add_to_cart, begin_checkout, select_item`
4. Click **Publish**

### 4. Test with GTM Preview Mode

1. In GTM, click **Preview** button
2. Enter your test URL
3. Complete a test purchase
4. In Preview mode, check:
   - **Tags** tab: Should see `GA4 - Configuration` and `GA4 - Purchase` firing
   - **DataLayer** tab: Should see `purchase` event with ecommerce data
   - **Summary** tab: Should show all events

**Expected:** Tags should fire when events occur.

### 5. Verify in GA4 DebugView (Real-time)

1. Go to GA4 → **Admin** → **DebugView**
2. Add `?debug_mode=true` to your test URL (or use GA Debugger extension)
3. Complete a test purchase
4. Watch DebugView for events appearing in real-time

**Expected:** `purchase` event should appear within seconds.

## Quick Verification Commands

### Check if GA4 Measurement ID is configured:

In GTM Preview mode → Tags tab → Click on `GA4 - Configuration` → Check Measurement ID field.

### Check if tags are published:

GTM → Versions → Latest version should show your GA4 tags.

### Check if events match triggers:

GTM Preview mode → DataLayer tab → See event names → Verify triggers match.

## Common Mistakes

1. ❌ **Tags created but not published** → Must click Submit/Publish
2. ❌ **Wrong Measurement ID** → Check GA4 Admin → Data Streams
3. ❌ **Trigger doesn't match event name** → Must be exact match (case-sensitive)
4. ❌ **Ecommerce data not enabled** → Must check "Use data from the ecommerce event"
5. ❌ **Testing on wrong URL** → Make sure you're testing on the deployed URL

## Expected Result

After configuration:
- ✅ GTM Preview shows tags firing
- ✅ GA4 DebugView shows events in real-time
- ✅ GA4 Reports show data (may take 24-48 hours for historical reports)

## Still Not Working?

1. **Check browser console for errors:**
   ```javascript
   // Check if GTM loaded
   window.dataLayer[0] // Should show {gtm.start: timestamp, event: 'gtm.js'}
   
   // Check if events are pushed
   window.dataLayer.filter(e => e.event === 'purchase')
   ```

2. **Check GTM container is correct:**
   - Verify `GTM-KHB92N9P` matches your GTM container
   - Check container is published

3. **Check GA4 Measurement ID:**
   - Verify it matches your GA4 property
   - Check data stream is active

4. **Check ad blockers:**
   - Temporarily disable to test
   - Some blockers prevent GA4 from loading
