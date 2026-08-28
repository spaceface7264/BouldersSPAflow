# Sentry Error Monitoring Setup

How Sentry is configured for production error tracking, User Feedback (“Report a problem”),
and consent-gated Session Replay on `join.boulders.dk`.

Day-to-day smoke checks: [SENTRY_VERIFY.md](./SENTRY_VERIFY.md).

## Overview

Production Sentry is initialized from a **CDN bundle** in `index.html` (not the Loader Script,
and not `sentry.config.js`). The live bundle is `bundle.tracing.replay.feedback.min.js` and covers:

- Uncaught JavaScript errors and unhandled promise rejections (from page load onwards)
- Performance traces (sampled)
- **User Feedback** via a floating bug button + footer “Report a problem” link
- **Session Replay** in buffer mode after Cookiebot statistics consent (attached to feedback;
  not full-session recording of every visitor)

## Implementation

```html
<script
  src="https://browser.sentry-cdn.com/10.69.0/bundle.tracing.replay.feedback.min.js"
  integrity="sha384-…"
  crossorigin="anonymous"
></script>
```

Inline `Sentry.init({…})` in `index.html` sets DSN, environment, integrations
(`browserTracingIntegration`, `replayIntegration`, `feedbackIntegration`), `ignoreErrors`, and
`beforeSend`. `window.Sentry` is assigned for `app.js` helpers (`captureException`, `setUser`).

**`sentry.config.js` is unused by the shipped app.** Changing it does not change production.

### Environment

- `production` when hostname is `join.boulders.dk`
- `development` everywhere else
- Traces: 10% production, 100% local
- Errors: 100% sample; expected noise (rate limits, auth failures, extensions) filtered in code

### Report a problem (User Feedback)

| Piece | Detail |
|---|---|
| UI | `#reportProblemButton` (bottom-right bug icon) + footer Support → Report a problem |
| Open | `window.openProblemReport()` — single form (no stacking); cleaned up on close/submit |
| Triage | Sentry → **User Feedback** (`issue.category:feedback`) |
| Tags | Feedback-only via `getProblemReportTags()` in `app.js` (not global `setTag`) |
| Success UX | Floating button briefly shows thank-you copy, then reverts |

Optional: create a Sentry alert on new `issue.category:feedback` (Slack/email).

### Session Replay

- Sample rates stay `0` for automatic full-session capture
- Buffering: `Sentry.getReplay().startBuffering()` after Cookiebot **statistics** consent
  (`syncSentryReplayWithConsent`); always allowed in non-production for local testing
- Privacy: `maskAllText`, `maskAllInputs`, `blockAllMedia`, `networkCaptureBodies: false`
- CSP in `_headers`: `worker-src 'self' blob:` and `child-src 'self' blob:` (older Safari)

## Setup / rotate DSN

1. Create a Browser JavaScript project in Sentry (e.g. `join-boulders-dk`)
2. Put the DSN in `Sentry.init({ dsn: … })` in `index.html`
3. When bumping the CDN bundle, update **both** the `src` URL and the `integrity` hash together
4. Optional source maps: set `SENTRY_AUTH_TOKEN` (and optionally `SENTRY_ORG` /
   `SENTRY_PROJECT` / `VITE_SENTRY_RELEASE`) at build time — see `vite.config.ts`

## Dashboard configuration worth keeping

**Alerts > Create Alert Rule** (recommended):

1. High error rate (> 10 errors in 5 minutes)
2. New / first-seen errors
3. Checkout / auth tagged errors (`flow:checkout`, `flow:authentication`)
4. New User Feedback (`issue.category:feedback`)

Also useful: inbound filters, data scrubbing, release tracking if source maps are uploaded.

## Features in app code

### Manual / contextual capture

`app.js` wraps `window.Sentry` and captures high-value failures with tags (e.g. checkout /
authentication). Expected 400/401/429 outcomes are excluded so they do not spam Issues.

### User context

On successful login, `setUser({ id, email })` is called so Issues and Feedback can show who was
affected. Cleared on logout.

## Testing

Prefer [SENTRY_VERIFY.md](./SENTRY_VERIFY.md). Short version:

```javascript
window.testSentry();           // error + message → Issues
window.openProblemReport();    // feedback form → User Feedback
window.syncSentryReplayWithConsent?.();
window.Sentry?.getReplay?.()?.getReplayId?.();
```

## Files that matter

| File | Role |
|---|---|
| `index.html` | CDN script + `Sentry.init`, feedback helpers, Replay consent sync |
| `app.js` | `captureException` / `setUser`, i18n + `getProblemReportTags` |
| `styles.css` | Floating report button + success state |
| `_headers` | CSP including Replay `worker-src` / `child-src` |
| `vite.config.ts` | Optional source-map upload plugin |
| `sentry.config.js` | Unused leftover — ignore for production |

## Notes

- Do not follow Sentry dashboard “install via npm / Loader Script” snippets for this app unless
  you intentionally migrate the init path.
- Source maps upload only when `SENTRY_AUTH_TOKEN` is present at build time.
- Always smoke-test after deploy: `testSentry()` + one feedback submission.

## References

- [User Feedback](https://docs.sentry.io/platforms/javascript/user-feedback/)
- [Session Replay](https://docs.sentry.io/platforms/javascript/session-replay/)
- [CDN install](https://docs.sentry.io/platforms/javascript/install/cdn/)
