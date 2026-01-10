# GTM Web Container Configuration Guide

## Overview

This guide covers configuring your Web container (`GTM-KHB92N9P`) to:
1. Capture ecommerce events from DataLayer
2. Forward events to your Server container (via Stape)
3. Send events to GA4

## Prerequisites

- Web container ID: `GTM-KHB92N9P`
- Server container ID: `GTM-P8DL49HC` (for forwarding)
- Stape setup completed with custom domain

---

## Step 1: GA4 Configuration Tag

### Create GA4 Configuration Tag

1. **Go to Tags → New**
2. **Tag Configuration:**
   - Choose: **Google Analytics: GA4 Configuration**
   - **Measurement ID:** Enter your GA4 Measurement ID (format: `G-XXXXXXXXXX`)
   - **Send to server container:** Enable this checkbox
   - **Server container URL:** Enter your Stape custom domain (e.g., `https://gtm.join.boulders.dk`)
   - **Container ID:** `GTM-P8DL49HC`

3. **Triggering:**
   - Choose: **All Pages**

4. **Name:** `GA4 - Configuration`
5. **Save**

**This tag:**
- Initializes GA4 on all pages
- Sends page views to GA4
- Forwards data to server-side container

---

## Step 2: Ecommerce Event Tags

Create separate tags for each ecommerce event. Each tag will:
- Listen for DataLayer events
- Extract ecommerce data
- Send to GA4 (client-side)
- Forward to server-side container

### 2.1 Select Item Event Tag

1. **Go to Tags → New**
2. **Tag Configuration:**
   - Choose: **Google Analytics: GA4 Event**
   - **Configuration Tag:** Select `GA4 - Configuration` (from Step 1)
   - **Event Name:** `select_item`
   - **Event Parameters:** Add these parameters:
     ```
     event_category: Ecommerce
     event_label: {{Item Name}}
     ```
   - **Ecommerce:** Enable "Use data from the ecommerce event"
   - **Send to server container:** Enable
   - **Server container URL:** Your Stape domain
   - **Container ID:** `GTM-P8DL49HC`

3. **Triggering:**
   - Choose: **Custom Event**
   - **Event name:** `select_item`

4. **Name:** `GA4 - Select Item`
5. **Save**

### 2.2 Add to Cart Event Tag

1. **Go to Tags → New**
2. **Tag Configuration:**
   - Choose: **Google Analytics: GA4 Event**
   - **Configuration Tag:** `GA4 - Configuration`
   - **Event Name:** `add_to_cart`
   - **Ecommerce:** Enable "Use data from the ecommerce event"
   - **Send to server container:** Enable
   - **Server container URL:** Your Stape domain
   - **Container ID:** `GTM-P8DL49HC`

3. **Triggering:**
   - Choose: **Custom Event**
   - **Event name:** `add_to_cart`

4. **Name:** `GA4 - Add to Cart`
5. **Save**

### 2.3 Begin Checkout Event Tag

1. **Go to Tags → New**
2. **Tag Configuration:**
   - Choose: **Google Analytics: GA4 Event**
   - **Configuration Tag:** `GA4 - Configuration`
   - **Event Name:** `begin_checkout`
   - **Ecommerce:** Enable "Use data from the ecommerce event"
   - **Send to server container:** Enable
   - **Server container URL:** Your Stape domain
   - **Container ID:** `GTM-P8DL49HC`

3. **Triggering:**
   - Choose: **Custom Event**
   - **Event name:** `begin_checkout`

4. **Name:** `GA4 - Begin Checkout`
5. **Save**

### 2.4 Purchase Event Tag

1. **Go to Tags → New**
2. **Tag Configuration:**
   - Choose: **Google Analytics: GA4 Event**
   - **Configuration Tag:** `GA4 - Configuration`
   - **Event Name:** `purchase`
   - **Ecommerce:** Enable "Use data from the ecommerce event"
   - **Send to server container:** Enable
   - **Server container URL:** Your Stape domain
   - **Container ID:** `GTM-P8DL49HC`

3. **Triggering:**
   - Choose: **Custom Event**
   - **Event name:** `purchase`

4. **Name:** `GA4 - Purchase`
5. **Save**

---

## Step 3: Server-Side Forwarding (Alternative Method)

If your GA4 tags don't have built-in forwarding, you can use a separate forwarding tag:

### 3.1 Create Server Container Forwarding Tag

1. **Go to Tags → New**
2. **Tag Configuration:**
   - Choose: **Custom HTML**
   - **HTML:**
   ```html
   <script>
     (function() {
       // Get the last DataLayer event
       var lastEvent = window.dataLayer[window.dataLayer.length - 1];
       
       // Only forward ecommerce events
       var ecommerceEvents = ['select_item', 'add_to_cart', 'begin_checkout', 'purchase'];
       if (lastEvent && lastEvent.event && ecommerceEvents.indexOf(lastEvent.event) !== -1) {
         // Forward to server-side container
         fetch('https://YOUR-STAPE-DOMAIN/collect', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json'
           },
           body: JSON.stringify({
             client_name: 'gtm',
             tag_id: 'GTM-P8DL49HC',
             data: lastEvent
           })
         }).catch(function(error) {
           console.warn('[GTM] Server forwarding error:', error);
         });
       }
     })();
   </script>
   ```

3. **Triggering:**
   - Choose: **Custom Event**
   - **Event name:** `select_item|add_to_cart|begin_checkout|purchase` (use regex)

4. **Name:** `Server Container - Forward Events`
5. **Save**

**Note:** This method is less preferred. Use the built-in forwarding in GA4 tags instead.

---

## Step 4: DataLayer Variables (Optional but Recommended)

Create variables to easily access ecommerce data:

### 4.1 Ecommerce Items Variable

1. **Go to Variables → New**
2. **Variable Configuration:**
   - Choose: **Data Layer Variable**
   - **Data Layer Variable Name:** `ecommerce.items`
   - **Data Layer Version:** 2

3. **Name:** `DLV - Ecommerce Items`
4. **Save**

### 4.2 Ecommerce Value Variable

1. **Go to Variables → New**
2. **Variable Configuration:**
   - Choose: **Data Layer Variable**
   - **Data Layer Variable Name:** `ecommerce.value`
   - **Data Layer Version:** 2

3. **Name:** `DLV - Ecommerce Value`
4. **Save**

### 4.3 Transaction ID Variable

1. **Go to Variables → New**
2. **Variable Configuration:**
   - Choose: **Data Layer Variable**
   - **Data Layer Variable Name:** `ecommerce.transaction_id`
   - **Data Layer Version:** 2

3. **Name:** `DLV - Transaction ID`
4. **Save**

---

## Step 5: Testing

### 5.1 GTM Preview Mode

1. Click **Preview** in GTM
2. Enter your website URL: `https://join.boulders.dk`
3. Navigate through the checkout flow
4. Verify events fire:
   - Select a product → `select_item` should fire
   - Add to cart → `add_to_cart` should fire
   - Click checkout → `begin_checkout` should fire
   - Complete purchase → `purchase` should fire

### 5.2 Check DataLayer

In browser console:
```javascript
// View all DataLayer events
console.log(window.dataLayer);

// Filter ecommerce events
window.dataLayer.filter(e => e.event && ['select_item', 'add_to_cart', 'begin_checkout', 'purchase'].includes(e.event))
```

### 5.3 GA4 DebugView

1. Go to GA4 → Admin → DebugView
2. Enable debug mode in your browser
3. Navigate through checkout flow
4. Verify events appear in real-time

---

## Step 6: Server-Side Container Configuration

After Stape is ready, configure forwarding in your Web container:

### Option A: Built-in Forwarding (Recommended)

In each GA4 tag:
- ✅ Enable "Send to server container"
- Enter Stape domain: `https://gtm.join.boulders.dk` (or your Stape domain)
- Enter Container ID: `GTM-P8DL49HC`

### Option B: Server Container Tag

1. **Go to Tags → New**
2. **Tag Configuration:**
   - Choose: **Server Container**
   - **Server Container URL:** Your Stape domain
   - **Container ID:** `GTM-P8DL49HC`

3. **Triggering:** All Pages

4. **Name:** `Server Container - Forward All`
5. **Save**

---

## Troubleshooting

### Events Not Firing

1. **Check DataLayer:**
   ```javascript
   console.log(window.dataLayer);
   ```
   Verify events are being pushed correctly

2. **Check GTM Preview Mode:**
   - Verify tags are firing
   - Check for errors in tag execution

3. **Check Browser Console:**
   - Look for `[GTM]` log messages
   - Check for JavaScript errors

### Events Not Reaching Server

1. **Verify Stape Domain:**
   - Ensure DNS is configured correctly
   - Test domain accessibility

2. **Check Server Container:**
   - Verify Server container is active
   - Check server-side tags are configured

3. **Network Tab:**
   - Check for requests to Stape domain
   - Verify POST requests are successful

### Data Not Appearing in GA4

1. **Check GA4 Configuration:**
   - Verify Measurement ID is correct
   - Check GA4 property is active

2. **Check DebugView:**
   - Enable debug mode
   - Verify events are being received

3. **Check Server-Side:**
   - Verify server-side GA4 tag is configured
   - Check server-side forwarding is working

---

## Quick Reference

### Tag Summary

| Tag Name | Event Name | Trigger |
|----------|-----------|---------|
| GA4 - Configuration | (page_view) | All Pages |
| GA4 - Select Item | select_item | Custom Event: select_item |
| GA4 - Add to Cart | add_to_cart | Custom Event: add_to_cart |
| GA4 - Begin Checkout | begin_checkout | Custom Event: begin_checkout |
| GA4 - Purchase | purchase | Custom Event: purchase |

### DataLayer Event Structure

```javascript
// select_item
{
  event: 'select_item',
  ecommerce: {
    items: [{
      item_id: '123',
      item_name: 'Adult Membership',
      price: 445.00,
      quantity: 1,
      item_category: 'membership'
    }]
  }
}

// add_to_cart
{
  event: 'add_to_cart',
  ecommerce: {
    currency: 'DKK',
    value: 445.00,
    items: [...]
  }
}

// begin_checkout
{
  event: 'begin_checkout',
  ecommerce: {
    currency: 'DKK',
    value: 445.00,
    items: [...]
  }
}

// purchase
{
  event: 'purchase',
  ecommerce: {
    transaction_id: '817247',
    value: 445.00,
    currency: 'DKK',
    tax: 0,
    shipping: 0,
    items: [...]
  }
}
```

---

## Next Steps

After Web container is configured:

1. **Configure Server Container** (`GTM-P8DL49HC`):
   - Set up GA4 server-side tag
   - Configure Google Ads Enhanced Conversions
   - Set up Meta Conversions API
   - Configure TikTok Events API

2. **Implement Deduplication:**
   - Add Event IDs to all events
   - Configure deduplication logic

3. **Test End-to-End:**
   - Test client-side → server-side flow
   - Verify events in GA4
   - Check attribution in Google Ads
