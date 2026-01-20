# Sentry Error Monitoring Setup

This document describes how Sentry error monitoring is configured for production error tracking and alerting.

## Overview

Sentry is configured using the **Loader Script** approach to capture:
- Uncaught JavaScript errors (from page load onwards)
- Unhandled promise rejections
- Critical payment and authentication errors
- Performance metrics (configured in Sentry project settings)

## Implementation Approach

We use Sentry's **Loader Script** (CDN-hosted) which:
- Loads immediately when HTML parses (before JavaScript)
- Captures errors that happen before app.js loads
- Auto-configured via Sentry project settings
- Reduces bundle size (no Sentry SDK in bundle)

## Setup Instructions

### 1. Create Sentry Account and Project

1. Go to [sentry.io](https://sentry.io) and create an account
2. Create a new project:
   - Platform: **JavaScript - Browser**
   - Framework: **Nope, Vanilla**
   - Project name: `join-boulders-dk` (or your preferred name)
3. You'll see setup instructions with a **Loader Script**

### 2. Copy Loader Script to HTML

The loader script is already added to `index.html` (line 19-22):

```html
<script
  src="https://js-de.sentry-cdn.com/1cc58b6b7d525b61ce37f528a8ddf2ed.min.js"
  crossorigin="anonymous"
></script>
```

**Note:** This URL is specific to your Sentry project. If you create a new project, update this URL with the new loader script from Sentry's setup instructions.

### 3. Configure Project Settings in Sentry Dashboard

Since we're using the loader script (not environment variables), configuration is done in the Sentry web UI:

1. Go to **Settings > Projects > [your-project] > Client Keys (DSN)**
2. The loader script URL contains your project's DSN
3. Configure settings in **Settings > Projects > [your-project] > Settings**:
   - **Environment**: Set based on domain (production for join.boulders.dk)
   - **Release Tracking**: Optional
   - **Sample Rates**: Configure error and performance sampling

### 4. Verify Installation

After deploying with the loader script:

1. Open your deployed site
2. Open browser console
3. Run: `throw new Error('Test Sentry error')`
4. Check Sentry dashboard - error should appear within seconds

## Configuration in Sentry Dashboard

All Sentry configuration is done through the web UI:

### Error Monitoring Settings

**Settings > Projects > [your-project] > Error Monitoring**

- **Error Sample Rate**: 100% (capture all errors) - recommended
- **Filters**: Configure to ignore browser extensions, network errors, etc.
- **Data Scrubbing**: Enable to remove sensitive data from errors

### Performance Monitoring

**Settings > Projects > [your-project] > Performance**

- **Traces Sample Rate**: 10% recommended (or adjust based on traffic)
- **Enable Performance Monitoring**: Toggle on/off

### Alerts

**Alerts > Create Alert Rule**

Recommended alerts:
1. **High Error Rate**: > 10 errors in 5 minutes
2. **New Error**: First time an error occurs
3. **Critical Errors**: Errors tagged with `flow:checkout` or `flow:authentication`

## Features Implemented

### 1. Sentry Loader Script

**File:** `index.html:19-22`

The loader script automatically:
- Initializes Sentry on page load
- Captures uncaught JavaScript errors
- Captures unhandled promise rejections
- Sends errors to Sentry dashboard
- Applies project configuration from Sentry UI

### 2. Manual Error Tracking

Our app.js captures specific errors that need additional context:

**Payment Errors** (`app.js:12464-12474`)
- Captures payment link generation failures
- Tags: `flow:checkout`, `error_type:payment_link_generation`
- Includes order ID and subscription items for debugging

**Login Errors** (`app.js:643-656`)
- Captures server errors during login (excludes user input errors)
- Tags: `flow:authentication`, `error_type:login_failed`
- Excludes: 400 (bad request), 401 (unauthorized), 429 (rate limits)

### 3. User Context

**File:** `app.js:622-628`

When users log in successfully, we set user context in Sentry:
- User ID (from token)
- Email address

This helps identify which users are experiencing errors.

### 4. Configuration

All Sentry configuration is managed through the Sentry web UI:
- **Error filtering**: Settings > Processing > Inbound Filters
- **Data scrubbing**: Settings > Security & Privacy
- **Sample rates**: Settings > Performance or Error Monitoring
- **Alerts**: Alerts > Create Alert Rule
- **Releases**: Settings > Releases (if using source maps)

## Testing Sentry Integration

### Test 1: Verify Loader Script Loaded

1. Open your deployed site
2. Open browser console
3. Check that `window.Sentry` exists:
   ```javascript
   console.log(window.Sentry); // Should show Sentry SDK object
   ```

### Test 2: Trigger Test Errors

Open browser console and run:

```javascript
// Test uncaught error
throw new Error('Test Sentry error from console');

// Test promise rejection
Promise.reject(new Error('Test promise rejection'));

// Test manual capture
Sentry.captureException(new Error('Manual test error'));
```

### Test 3: Check Sentry Dashboard

1. Go to Sentry.io → Issues
2. You should see the test errors appear within seconds
3. Click on an error to see:
   - Stack trace with line numbers
   - User context (if logged in)
   - Breadcrumbs (user actions before error)
   - Device/browser info
   - Environment (should show your configured environment)

### Test 4: Test Real Application Errors

1. **Payment Flow:**
   - Complete a checkout to trigger any payment errors
   - Check Sentry for errors tagged with `flow:checkout`

2. **Login Flow:**
   - Try logging in with wrong credentials (should NOT appear - 401 excluded)
   - Cause a server error if possible (should appear with `flow:authentication` tag)

3. **User Context:**
   - Log in successfully
   - Trigger an error
   - Error in Sentry should show your user email

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

- `index.html:19-22` - Sentry loader script (CDN-hosted)
- `app.js:38-48` - Sentry helper functions (captureException, setUser)
- `app.js:622-628` - User context tracking on login
- `app.js:643-656` - Login error tracking
- `app.js:12464-12474` - Payment error tracking
- `vite.config.ts:176` - Source map generation (optional)
- `package.json` - Sentry Vite plugin for source maps (optional)

## Manual Error Capture

The Sentry SDK is loaded globally and available via `window.Sentry`:

```javascript
// Capture an error with context
Sentry.captureException(new Error('Something went wrong'), {
  tags: {
    flow: 'checkout',
    error_type: 'payment_failed'
  },
  extra: {
    orderId: '12345',
    amount: 299
  },
  level: 'error' // or 'warning', 'info'
});

// Capture a message (not an error)
Sentry.captureMessage('User completed checkout', {
  level: 'info',
  tags: { flow: 'checkout' }
});

// Set user context (done automatically on login in app.js)
Sentry.setUser({
  id: 'user-123',
  email: 'user@example.com'
});

// Clear user context (on logout)
Sentry.setUser(null);

// Add breadcrumb for debugging
Sentry.addBreadcrumb({
  message: 'User clicked checkout button',
  category: 'user-action',
  data: {
    buttonId: 'checkout',
    cartTotal: 299
  },
  level: 'info'
});
```

**Note:** Our app.js already handles payment errors, login errors, and user context automatically. Manual capture is only needed for additional custom tracking.

## Next Steps

1. ✅ Sentry loader script is already added to `index.html`
2. Deploy to production - Sentry will start capturing errors immediately
3. Test error capture using browser console
4. Configure alerts for critical errors in Sentry dashboard
5. Set up filters for noise (browser extensions, etc.)
6. Monitor Sentry dashboard regularly
7. Adjust sample rates in Sentry settings based on quota usage

## Important Notes

- **Loader Script URL**: The current loader script URL in `index.html` is specific to the `join-boulders` Sentry project. If you create a new Sentry project, update the URL.
- **No Environment Variables Needed**: Configuration is done through Sentry web UI, not environment variables
- **Source Maps**: Optional - requires `SENTRY_AUTH_TOKEN` environment variable in build pipeline
- **Testing**: Always test in browser console after deployment to verify Sentry is capturing errors

## Support

- Sentry Loader Script Docs: https://docs.sentry.io/platforms/javascript/install/loader/
- Sentry Browser SDK: https://docs.sentry.io/platforms/javascript/
- Sentry Configuration: https://docs.sentry.io/platforms/javascript/configuration/
