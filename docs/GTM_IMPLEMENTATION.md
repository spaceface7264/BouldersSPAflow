# Google Tag Manager (GTM) Implementation

This document describes the GTM tracking implementation for ecommerce events following GA4's standard schema.

## Overview

GTM tracking has been implemented to track the following ecommerce events:
- `select_item` - When a product is selected
- `add_to_cart` - When items are added to cart
- `begin_checkout` - When checkout process starts
- `purchase` - When order is completed

## Files Modified

### 1. `index.html`
- Added GTM container script in the `<head>` section
- Added GTM noscript fallback in the `<body>` section
- Added script reference to `gtm-utils.js`

**Note:** Replace `GTM-XXXXXXX` with your actual GTM container ID in both the script and noscript tags.

### 2. `gtm-utils.js` (New File)
Utility functions for pushing ecommerce events to DataLayer:
- `trackSelectItem(product, itemListId, itemListName)` - Track product selection
- `trackAddToCart(items, value, currency)` - Track items added to cart
- `trackBeginCheckout(items, value, currency)` - Track checkout initiation
- `trackPurchase(transactionId, items, value, tax, shipping, currency)` - Track completed purchase

All functions follow GA4's standard ecommerce schema.

### 3. `app.js`
Added tracking calls at the following locations:

#### `select_item` Event
- **Location:** `handlePlanSelection()` function (line ~8476)
- **Triggered:** When a user selects a membership or punch card product
- **Data:** Product ID, name, price, type, quantity

#### `add_to_cart` Event
- **Location:** `updateCartSummary()` function (line ~10325)
- **Triggered:** When items are added to the cart (membership, punch card, or addons)
- **Data:** Array of cart items with product details and total cart value
- **Note:** Only tracks when new items are added (not on every cart update)

#### `begin_checkout` Event
- **Location:** `handleCheckout()` function (line ~11543)
- **Triggered:** When user clicks checkout button and validation passes
- **Data:** All cart items and total cart value

#### `purchase` Event
- **Location:** `loadOrderForConfirmation()` function (line ~13573)
- **Triggered:** When order is successfully completed and payment is confirmed
- **Data:** Transaction ID, all purchased items, total value, tax, shipping

## Event Data Structure

All events follow GA4's standard ecommerce schema:

```javascript
{
  event: 'select_item' | 'add_to_cart' | 'begin_checkout' | 'purchase',
  ecommerce: {
    currency: 'DKK',
    value: 445.00, // Total value as number
    items: [
      {
        item_id: '123',
        item_name: 'Adult Membership',
        price: 445.00,
        quantity: 1,
        item_category: 'membership' // or 'punch-card' or 'addon'
      }
    ],
    // purchase event also includes:
    transaction_id: '817247',
    tax: 0,
    shipping: 0
  }
}
```

## Configuration

### GTM Container ID

1. Replace `GTM-XXXXXXX` in `index.html` with your actual GTM container ID
2. Update the noscript iframe src with the same container ID
3. Optionally set `VITE_GTM_CONTAINER_ID` environment variable (requires build-time replacement)

### Environment Variable

Add to your `.env` file:
```
VITE_GTM_CONTAINER_ID=GTM-XXXXXXX
```

**Note:** The current implementation uses a placeholder that needs to be replaced manually. For production, consider implementing a build-time replacement using Vite's HTML plugin.

## Testing

To test GTM tracking:

1. Open browser DevTools → Console
2. Check for `[GTM]` log messages when events are triggered
3. Verify events in GTM Preview mode or GA4 DebugView
4. Check DataLayer in DevTools → Application → Local Storage or use `window.dataLayer` in console

### Expected Console Output

```
[GTM] Pushed event: select_item {ecommerce: {...}}
[GTM] Pushed event: add_to_cart {ecommerce: {...}}
[GTM] Pushed event: begin_checkout {ecommerce: {...}}
[GTM] Pushed event: purchase {ecommerce: {...}}
```

## GA4 Configuration in GTM

In your GTM container, configure:

1. **GA4 Configuration Tag** - Set your Measurement ID
2. **GA4 Event Tags** - Create tags for each event:
   - `select_item`
   - `add_to_cart`
   - `begin_checkout`
   - `purchase`
3. **Triggers** - Use DataLayer events as triggers
4. **Ecommerce Variables** - Map DataLayer variables to GA4 ecommerce parameters

## Troubleshooting

### Events Not Firing
- Check browser console for `[GTM]` log messages
- Verify GTM container ID is correct
- Ensure `gtm-utils.js` is loaded (check Network tab)
- Verify DataLayer is initialized: `console.log(window.dataLayer)`

### Data Not Appearing in GA4
- Check GTM Preview mode to see if events are being captured
- Verify GA4 Configuration tag is firing
- Check GA4 DebugView for real-time event data
- Ensure ecommerce parameters are correctly mapped in GTM

### Price Format Issues
- Prices are automatically converted from cents to DKK (divided by 100)
- Prices are formatted as numbers, not strings
- Currency is hardcoded to 'DKK'

## Future Enhancements

- [ ] Implement build-time GTM ID replacement via Vite plugin
- [ ] Add support for additional ecommerce events (view_item, remove_from_cart)
- [ ] Add user properties tracking (user_id, etc.)
- [ ] Add enhanced ecommerce parameters (coupon, affiliation, etc.)
- [ ] Add error tracking integration
