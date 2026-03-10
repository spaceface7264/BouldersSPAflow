# Sentry Verification Guide

## Current Setup

Your project is using **Sentry Loader Script** (not SDK import), which is already configured in `index.html`:

```html
<script
  src="https://js-de.sentry-cdn.com/1cc58b6b7d525b61ce37f528a8ddf2ed.min.js"
  crossorigin="anonymous"
></script>
```

This loader script automatically initializes Sentry and makes it available as `window.Sentry`.

## Difference: Loader Script vs SDK Import

### Loader Script (Current Setup) ✅
- **Pros:** Loads early, captures errors from page load, smaller bundle
- **Cons:** Configuration done in Sentry dashboard, not in code
- **Status:** Already configured and working

### SDK Import (What Sentry Dashboard Shows)
- **Pros:** More control, configuration in code
- **Cons:** Larger bundle, needs to be imported
- **Status:** Not needed - loader script is sufficient

## Verification Test

Since you're using the loader script, you can verify it's working with this test:

### Quick Test (Copy into browser console):

```javascript
// Test 1: Check if Sentry is loaded
console.log('Sentry loaded?', typeof window.Sentry !== 'undefined');

// Test 2: Run the verification snippet from Sentry dashboard
myUndefinedFunction();
```

This will throw an error that Sentry should capture automatically.

### Full Test Suite

Run the comprehensive test from `TEST_SENTRY.js`:

1. Open your preview site
2. Open browser console
3. Copy and paste the entire contents of `TEST_SENTRY.js`
4. Wait 5-10 seconds
5. Check Sentry dashboard for errors

## What to Expect

After running the test:
1. **In Console:** You'll see an error: `ReferenceError: myUndefinedFunction is not defined`
2. **In Sentry Dashboard:** Within 5-10 seconds, you should see:
   - A new error/issue
   - Stack trace showing where the error occurred
   - Browser/device information
   - URL where error occurred

## If Sentry Dashboard Shows SDK Import Instructions

The Sentry dashboard shows SDK import instructions by default, but since you're using the loader script:

1. **You can ignore the SDK import code** - it's not needed
2. **The loader script is already configured** - it uses the same DSN
3. **Just run the verification test** - `myUndefinedFunction()` will work

## Configuration

Since you're using the loader script, all configuration is done in the Sentry dashboard:
- Go to **Settings > Projects > join-bouldersdk**
- Configure error sample rates, performance monitoring, etc.
- The loader script automatically applies these settings

## Next Steps

1. ✅ Loader script is already in `index.html`
2. ✅ Run verification test: `myUndefinedFunction()` in console
3. ✅ Check Sentry dashboard for the error
4. ✅ Verify error appears with stack trace and context

No code changes needed - the loader script approach is already set up and working!
