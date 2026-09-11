# Sentry Verification Guide

## Current Setup

Production Sentry is initialized inline in `index.html` from the **CDN bundle**
`bundle.tracing.replay.feedback.min.js` (v10.x), not the old Loader Script and not
`sentry.config.js` (that module is unused by the shipped app).

```html
<script
  src="https://browser.sentry-cdn.com/10.69.0/bundle.tracing.replay.feedback.min.js"
  integrity="sha384-…"
  crossorigin="anonymous"
></script>
```

`window.Sentry` is assigned after `Sentry.init(...)`. Helpers in `app.js` call
`captureException` / `setUser` against that global.

## What is enabled

| Signal | Behavior |
|---|---|
| Errors | Captured; noise filtered via `ignoreErrors` / `beforeSend` in `index.html` |
| Tracing | 10% in production, 100% locally |
| User Feedback | Floating bug button + footer “Report a problem” |
| Session Replay | Buffer mode after Cookiebot **statistics** consent; attaches to feedback (and can flush on error). Not full-session recording. |

## Quick verification

```javascript
// 1) SDK present
console.log('Sentry loaded?', typeof window.Sentry !== 'undefined');

// 2) Built-in test helper
window.testSentry();
// Check Sentry Issues in 5–10s

// 3) Feedback UI
window.openProblemReport();
// Or click the bottom-right bug icon / footer Support → Report a problem

// 4) Replay buffering (dev / after statistics consent)
window.syncSentryReplayWithConsent?.();
console.log('Replay id', window.Sentry?.getReplay?.()?.getReplayId?.());
```

## What to expect

- **Errors:** new Issues with stack + URL + browser info
- **Feedback:** Sentry → **User Feedback** (`issue.category:feedback`), with signup tags and (when consented) a linked Replay
- **Console:** `[Sentry] ✅ Initialized in … mode` in non-production

## Notes

- Do not follow dashboard “install via npm” snippets for this app — the live path is the CDN init in `index.html`.
- `sentry.config.js` is a leftover npm-style helper; changing it does not change production behavior.
- Source maps upload only when `SENTRY_AUTH_TOKEN` is set at build time (see `vite.config.ts`).
