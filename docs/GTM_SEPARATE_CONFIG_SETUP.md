# GTM Setup: Separate GA4 Configuration for boulders-api-flow

## Problem
- Existing "Boulders DK" Google Tag uses Measurement ID `G-7YMD7FSKMZ` (for Google Ads/marketing)
- We need to track to `boulders-api-flow` with Measurement ID `G-5LK4VMR8E2`
- **Must not modify** existing "Boulders DK" tag (used by marketing agency)

## Solution: Create Separate GA4 Configuration Tag

### Step 1: Create New GA4 Configuration Tag

1. **GTM → Tags → New**
2. **Tag Configuration:**
   - Choose: **Google Analytics: GA4 Configuration**
   - **Measurement ID:** `G-5LK4VMR8E2` (boulders-api-flow)
   - **Send to server container:** Enable (if using Stape)
   - **Server container URL:** `https://gtm.join.boulders.dk` (or your Stape domain)
   - **Container ID:** `GTM-P8DL49HC`
3. **Triggering:**
   - Choose: **All Pages**
4. **Name:** `GA4 - Config - boulders-api-flow`
5. **Save**

**Important:** This is a separate tag from "Boulders DK" - it won't interfere with existing tracking.

### Step 2: Update Event Tags to Use New Configuration

Update each of your new event tags to reference the new configuration tag:

#### For `purchase - Event`:
1. Open the tag
2. **Configuration Tag:** Change from "Boulders DK" to `GA4 - Config - boulders-api-flow`
3. **Event Name:** `purchase`
4. **Ecommerce:** ✅ Enable "Use data from the ecommerce event"
5. **Save**

#### For `add_to_cart - Event`:
1. Open the tag
2. **Configuration Tag:** Change to `GA4 - Config - boulders-api-flow`
3. **Event Name:** `add_to_cart`
4. **Ecommerce:** ✅ Enable "Use data from the ecommerce event"
5. **Save**

#### For `begin_checkout - Event`:
1. Open the tag
2. **Configuration Tag:** Change to `GA4 - Config - boulders-api-flow`
3. **Event Name:** `begin_checkout`
4. **Ecommerce:** ✅ Enable "Use data from the ecommerce event"
5. **Save**

#### For `select_item - Event`:
1. Open the tag
2. **Configuration Tag:** Change to `GA4 - Config - boulders-api-flow`
3. **Event Name:** `select_item`
4. **Ecommerce:** ✅ Enable "Use data from the ecommerce event"
5. **Save**

### Step 3: Verify Old Tags Are Unchanged

**DO NOT MODIFY:**
- ❌ "Boulders DK" Google Tag (G-7YMD7FSKMZ) - Used for Google Ads
- ❌ Any `--GA4 - Event -` tags (old tags, may be used by marketing)
- ❌ Any `--GAds -` tags (Google Ads conversion tracking)

**ONLY MODIFY:**
- ✅ New `GA4 - Config - boulders-api-flow` tag (create new)
- ✅ New event tags: `purchase - Event`, `add_to_cart - Event`, `begin_checkout - Event`, `select_item - Event` (update Configuration Tag reference)

### Step 4: Publish

1. **Submit** → **Publish**
2. Version name: `Add separate GA4 config for boulders-api-flow`
3. Description: `Create separate GA4 Configuration tag for boulders-api-flow (G-5LK4VMR8E2) without modifying existing Boulders DK tag`

## Result

After this setup:
- ✅ **Existing tracking unchanged:** "Boulders DK" tag continues tracking to G-7YMD7FSKMZ (Google Ads, marketing)
- ✅ **New tracking active:** Events go to `boulders-api-flow` (G-5LK4VMR8E2)
- ✅ **No conflicts:** Both tracking systems work independently
- ✅ **Marketing agency happy:** Their setup untouched

## Testing

After publishing:
1. Use GTM Preview mode
2. Complete a test purchase
3. Check Tags tab → Should see:
   - `GA4 - Config - boulders-api-flow` firing
   - `purchase - Event` firing (using new config)
   - Old "Boulders DK" tag still firing (unchanged)
4. Check GA4 DebugView for `boulders-api-flow` → Should see events

## Summary

- **Create:** New `GA4 - Config - boulders-api-flow` tag (G-5LK4VMR8E2)
- **Update:** Event tags to reference new config tag
- **Don't touch:** Existing "Boulders DK" tag or marketing tags
- **Publish:** Both systems will track independently
