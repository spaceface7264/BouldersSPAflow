# Quick GTM Verification - Run in Browser Console

## Step 1: Check if Events Are Being Pushed

On your test page, open browser console and run:

```javascript
// Check all events in DataLayer
console.log('All DataLayer Events:', window.dataLayer.filter(e => e.event));

// Check for specific events
console.log('Purchase events:', window.dataLayer.filter(e => e.event === 'purchase'));
console.log('Add to cart events:', window.dataLayer.filter(e => e.event === 'add_to_cart'));
console.log('Begin checkout events:', window.dataLayer.filter(e => e.event === 'begin_checkout'));
console.log('Select item events:', window.dataLayer.filter(e => e.event === 'select_item'));

// Check GTM container
console.log('GTM Container ID:', window.GTM_CONTAINER_ID);
console.log('GTM Utils loaded:', window.GTM);
```

**Expected:** You should see events with `event` and `ecommerce` properties.

## Step 2: Check if GTM Tags Are Configured

**This is the most likely issue!** GTM container loads, but GA4 tags need to be configured.

### Go to Google Tag Manager:
1. https://tagmanager.google.com
2. Select container: `GTM-KHB92N9P`
3. Check **Tags** section

**Do you see these tags?**
- ❌ `GA4 - Configuration` → **MISSING - Need to create**
- ❌ `GA4 - Purchase` → **MISSING - Need to create**
- ❌ `GA4 - Add to Cart` → **MISSING - Need to create**
- ❌ `GA4 - Begin Checkout` → **MISSING - Need to create**
- ❌ `GA4 - Select Item` → **MISSING - Need to create**

**If tags are missing:** Follow `GTM_CONFIGURATION_CHECKLIST.md` to create them.

**If tags exist:** Check if they're **published** (GTM → Versions → Latest version).

## Step 3: Find Your GA4 Measurement ID

You need this to configure GA4 tags:

1. Go to [Google Analytics](https://analytics.google.com)
2. Select property: `boulders-api-flow`
3. **Admin** (bottom left) → **Data Streams**
4. Click on your Web stream
5. Copy the **Measurement ID** (format: `G-XXXXXXXXXX`)

**This is what you'll enter in GTM GA4 Configuration tag.**

## Step 4: Quick Test After Configuration

After creating GA4 tags in GTM:

1. **Publish GTM container** (Submit button → Publish)
2. **Use GTM Preview mode:**
   - GTM → Preview → Enter your URL
   - Complete a test purchase
   - Check Tags tab → Should see `GA4 - Purchase` firing
3. **Check GA4 DebugView:**
   - GA4 → Admin → DebugView
   - Add `?debug_mode=true` to URL
   - Complete purchase → Should see events in real-time

## Most Likely Issue

**GTM container is installed ✅**
**Events are being pushed ✅**
**But GA4 tags are NOT configured in GTM ❌**

**Solution:** Create GA4 Configuration tag and GA4 Event tags in GTM, then publish.

See `GTM_CONFIGURATION_CHECKLIST.md` for detailed steps.
