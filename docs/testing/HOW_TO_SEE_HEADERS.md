# How to See Analytics Headers - Step by Step

## The Problem

You're looking at **GET requests** (loading products), but analytics headers only appear on **POST requests** (funnel actions).

## What You're Seeing Now

- ❌ **GET** `/api/products/subscriptions/134/additions` - Loading product details
- ❌ **GET** `/api/products/valuecards` - Loading products
- ❌ Any **GET** request - Just loading data

**These will NOT have `x-ga-client-id` headers!**

## What You Need to Do

### Step 1: Accept Cookies First

1. Accept cookies (Analytics or Marketing)
2. Wait 2-3 seconds for GA4 to initialize
3. Check console for: `[Analytics] GA4 client ID captured`

### Step 2: Click Checkout Button

**Important**: The cart is populated locally when you click a product, but **no POST request happens until checkout**:

1. Click on a membership product card (cart updates locally - no API call)
2. **Click the "Checkout" or "Continue" button** (this triggers the POST request)
3. This triggers **POST** `/api/orders` (creates order)
4. **THIS is where headers appear!**

### Step 3: Check the POST Request

1. In Network tab, look for **POST** request (not GET)
2. Should see: `POST /api/orders` or `POST /api-proxy?path=/api/orders`
3. Click on that POST request
4. Go to **Headers** tab → **Request Headers**
5. Look for `x-ga-client-id`

## Visual Guide

```
❌ Clicking product → Cart updates locally → NO API call → NO headers
✅ Clicking checkout → POST /api/orders → HAS headers (creates order)
✅ Proceeding to payment → POST /api/payment/generate-link → HAS headers
```

**Note**: The cart is populated client-side when you click a product. The actual POST request happens when you click checkout.

## Quick Test

1. **Open Network tab** (F12 → Network)
2. **Filter by "Fetch" or "XHR"**
3. **Accept cookies** (if not already)
4. **Wait 3 seconds**
5. **Click on a product** (cart updates locally - no API call yet)
6. **Click "Checkout" or "Continue" button** (this triggers POST request)
7. **Look for POST request** (should see `/api/orders` or `/api-proxy?path=/api/orders`)
8. **Click on POST request** → Headers → Request Headers
9. **Find `x-ga-client-id`** header

## Still Not Seeing It?

### Check Console First

```javascript
// 1. Check consent
const consent = JSON.parse(localStorage.getItem('boulders_cookie_consent') || 'null');
console.log('Has consent:', consent?.categories?.analytics || consent?.categories?.marketing);

// 2. Check GTM
console.log('GTM loaded:', window.GTM_LOADED);

// 3. Check if client ID was captured
// Look for console message: [Analytics] GA4 client ID captured
```

### Make Sure You're Testing the Right Action

- ✅ **Adding to cart** = POST request = Has headers
- ✅ **Proceeding to checkout** = POST request = Has headers
- ❌ **Clicking product** = GET request = No headers
- ❌ **Viewing product details** = GET request = No headers

## Expected Flow

1. **Page loads** → GET requests (no headers)
2. **User clicks product** → Cart updates locally (no API call, no headers)
3. **User clicks checkout** → **POST `/api/orders`** → ✅ **HAS HEADERS** (creates order)
4. **User proceeds to payment** → **POST `/api/payment/generate-link`** → ✅ **HAS HEADERS**

## Summary

**The cart is populated locally when you click a product, but no POST request happens until checkout!**

The headers appear when you:
- ✅ Click checkout button (POST /api/orders - creates order)
- ✅ Proceed to payment (POST /api/payment/generate-link)
- ✅ Add items to existing order (POST /api/orders/{id}/items/...)

They do NOT appear when you:
- ❌ Click on products (cart updates locally, no API call)
- ❌ View product details (GET requests)
- ❌ Load product lists (GET requests)

**Key Point**: The POST request with analytics headers happens when you click the checkout button, not when you select a product.
