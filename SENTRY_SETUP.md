# Sentry Error Monitoring Setup

This document describes how Sentry error monitoring is configured for production error tracking and alerting.

## Overview

Sentry is configured to capture:
- Uncaught JavaScript errors
- Unhandled promise rejections
- Critical payment and authentication errors
- Performance metrics (10% sample rate)

## Setup Instructions

### 1. Create Sentry Account and Project

1. Go to [sentry.io](https://sentry.io) and create an account
2. Create a new project:
   - Platform: **JavaScript - Browser**
   - Project name: `join-boulders-dk` (or your preferred name)
3. Copy your **DSN** from the project settings

### 2. Configure Environment Variables

#### For Cloudflare Pages (Production)

Go to your Cloudflare Pages project settings:

**Settings > Environment Variables**

Add the following variables:

**Production Environment:**
```
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id
VITE_SENTRY_ENVIRONMENT=production
```

**Preview Environment (Optional):**
```
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id
VITE_SENTRY_ENVIRONMENT=preview
```

#### For Source Map Upload (Optional but Recommended)

To enable better error debugging with source maps, add:

```
SENTRY_AUTH_TOKEN=your-sentry-auth-token
SENTRY_ORG=your-sentry-org-name
SENTRY_PROJECT=join-boulders-dk
VITE_SENTRY_RELEASE=1.0.0
```

**To get your Sentry auth token:**
1. Go to Sentry.io → Settings → Account → Auth Tokens
2. Click "Create New Token"
3. Name: "Cloudflare Pages Deploy"
4. Scopes: `project:read`, `project:releases`, `org:read`
5. Copy the token

#### For Local Development

Create a `.env` file in the project root:

```bash
# Sentry DSN (required to enable Sentry)
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id

# Environment (defaults to "development" if not production)
VITE_SENTRY_ENVIRONMENT=development

# Source map upload (only needed for production builds)
# SENTRY_AUTH_TOKEN=your-auth-token
# SENTRY_ORG=your-org
# SENTRY_PROJECT=join-boulders-dk
```

**Note:** Sentry is disabled by default in development. To enable it, set:
```bash
VITE_SENTRY_ENVIRONMENT=production
```

## Features Implemented

### 1. Global Error Handlers

**File:** `app.js:39-61`

Automatically captures:
- Uncaught JavaScript errors
- Unhandled promise rejections

### 2. Critical Error Tracking

**Payment Errors** (`app.js:12459-12469`)
- Captures payment link generation failures
- Tags: `flow:checkout`, `error_type:payment_link_generation`
- Includes order ID and subscription items

**Login Errors** (`app.js:650-659`)
- Captures server errors during login (excludes user input errors)
- Tags: `flow:authentication`, `error_type:login_failed`
- Excludes: 400, 401 (user errors), 429 (rate limits)

### 3. User Context Tracking

**File:** `app.js:635-639`

When users log in successfully, Sentry tracks:
- User ID
- Email address

This helps correlate errors to specific users.

### 4. Source Maps

**File:** `vite.config.ts:86-106, 176`

- Source maps are generated during production builds
- Uploaded to Sentry automatically if `SENTRY_AUTH_TOKEN` is set
- Deleted after upload to reduce bundle size
- Enables viewing original source code in error reports

### 5. Data Privacy

**File:** `sentry.config.js:85-100`

Automatically filters sensitive data:
- Authorization headers
- Cookie headers
- Sensitive breadcrumb data

### 6. Error Filtering

**File:** `sentry.config.js:68-83`

Ignores non-critical errors:
- Browser extension errors
- Network errors (expected)
- User cancellations

## Testing Sentry Integration

### Test 1: Manual Error Capture

Open browser console on your site and run:

```javascript
// Test uncaught error
throw new Error('Test Sentry error');

// Test promise rejection
Promise.reject(new Error('Test promise rejection'));

// Test manual capture
window.Sentry.captureException(new Error('Manual test'));
```

### Test 2: Check Sentry Dashboard

1. Go to Sentry.io → Issues
2. You should see the test errors appear within seconds
3. Click on an error to see:
   - Stack trace
   - User context (if logged in)
   - Breadcrumbs (user actions before error)
   - Device/browser info

### Test 3: Trigger Real Errors

Try these scenarios to test automatic error capture:

1. **Payment Error Test:**
   - Complete a checkout flow
   - Check Sentry for any payment errors

2. **Login Error Test:**
   - Try logging in with invalid credentials
   - Should NOT appear in Sentry (400/401 excluded)
   - Try causing a server error (if possible)
   - Should appear in Sentry

## Monitoring and Alerts

### Setting Up Alerts

1. Go to **Sentry.io → Alerts**
2. Click **Create Alert Rule**
3. Recommended alerts:
   - **High Error Rate:** Alert when >10 errors in 5 minutes
   - **Payment Failures:** Alert on any `flow:checkout` errors
   - **Auth Issues:** Alert on any `flow:authentication` errors

### Alert Destinations

Configure where alerts go:
- Email
- Slack
- PagerDuty
- Discord
- Webhooks

## Performance Monitoring

Current configuration:
- **Error Sample Rate:** 100% (all errors captured)
- **Performance Sample Rate:** 10% (10% of transactions tracked)

To adjust, edit `sentry.config.js:46-49`

## Quotas and Limits

Sentry free tier includes:
- 5,000 errors/month
- 10,000 performance transactions/month

If you exceed limits:
- Errors will be dropped
- Consider upgrading or reducing sample rates

## Troubleshooting

### Sentry not capturing errors

1. **Check DSN is set:**
   ```bash
   echo $VITE_SENTRY_DSN
   ```

2. **Check browser console:**
   - Should see: `[Sentry] Initialized in production mode (enabled: true)`
   - If disabled: `[Sentry] DSN not configured`

3. **Verify environment:**
   - Sentry only enables in production by default
   - Set `VITE_SENTRY_ENVIRONMENT=production` to force enable

### Source maps not working

1. **Check auth token is set:**
   ```bash
   echo $SENTRY_AUTH_TOKEN
   ```

2. **Check build logs:**
   - Should see: `[Vite] Sentry plugin enabled - source maps will be uploaded`

3. **Verify release version:**
   - Errors in Sentry should show the same release version
   - Set `VITE_SENTRY_RELEASE` to track releases

### Errors not filtered properly

Edit filter rules in `sentry.config.js:68-83`:

```javascript
ignoreErrors: [
  'Your error pattern here',
  /regex pattern/,
],
```

## Files Modified

- `sentry.config.js` - Sentry configuration and initialization
- `app.js:34-61` - Sentry initialization and global handlers
- `app.js:635-639` - User context tracking
- `app.js:650-659` - Login error tracking
- `app.js:12459-12469` - Payment error tracking
- `vite.config.ts` - Source map generation and upload
- `package.json` - Sentry dependencies

## Manual Functions

The following Sentry functions are available globally via `window.Sentry`:

```javascript
// Capture an exception
window.Sentry.captureException(error, {
  tags: { custom: 'tag' },
  extra: { data: 'value' },
});

// Capture a message
window.Sentry.captureMessage('Something happened', 'info', {
  tags: { custom: 'tag' },
});

// Set user context
window.Sentry.setUser({
  id: '12345',
  email: 'user@example.com',
});

// Add breadcrumb for debugging
window.Sentry.addBreadcrumb('User clicked button', {
  buttonId: 'checkout',
}, 'user-action');
```

## Next Steps

1. Set up Sentry account and get DSN
2. Configure environment variables in Cloudflare Pages
3. Deploy and test error capture
4. Configure alerts for critical errors
5. Monitor Sentry dashboard regularly
6. Adjust sample rates based on quota usage

## Support

- Sentry Documentation: https://docs.sentry.io/platforms/javascript/
- Cloudflare Pages Env Vars: https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables
