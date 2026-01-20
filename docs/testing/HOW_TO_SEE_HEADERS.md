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

### Step 2: Actually Add to Cart

**Don't just click the product** - you need to **add it to cart**:

1. Click on a membership product card
2. **Click "Add to Cart" or "Select" button**
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
❌ Clicking product → GET /api/products/... → NO headers
✅ Adding to cart → POST /api/orders → HAS headers
✅ Checkout → POST /api/payment/generate-link → HAS headers
```

## Quick Test

1. **Open Network tab** (F12 → Network)
2. **Filter by "Fetch" or "XHR"**
3. **Accept cookies** (if not already)
4. **Wait 3 seconds**
5. **Add a product to cart** (click "Add to Cart" button)
6. **Look for POST request** (should see `/api/orders` or `/api-proxy?path=/api/orders`)
7. **Click on POST request** → Headers → Request Headers
8. **Find `x-ga-client-id`** header

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
2. **User clicks product** → GET `/api/products/...` (no headers)
3. **User adds to cart** → **POST `/api/orders`** → ✅ **HAS HEADERS**
4. **User checks out** → **POST `/api/payment/generate-link`** → ✅ **HAS HEADERS**

## Summary

**You need to actually add the product to cart, not just click on it!**

The headers appear when you:
- ✅ Add item to cart (POST /api/orders)
- ✅ Proceed to checkout (POST /api/payment/generate-link)
- ✅ Add items to existing order (POST /api/orders/{id}/items/...)

They do NOT appear when you:
- ❌ Click on products (GET requests)
- ❌ View product details (GET requests)
- ❌ Load product lists (GET requests)
