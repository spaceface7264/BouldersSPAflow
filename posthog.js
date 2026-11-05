import posthog from 'posthog-js';

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST;

export const isPostHogEnabled = Boolean(posthogKey && posthogHost);

if (isPostHogEnabled) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_pageview: 'history_change',
    logs: {
      serviceName: 'boulders-signup-web',
      environment: import.meta.env.MODE,
    },
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
  });
} else if (import.meta.env.DEV) {
  const missingVariable = posthogKey ? 'VITE_POSTHOG_HOST' : 'VITE_POSTHOG_KEY';
  console.warn(
    `[posthog] ${missingVariable} is not set, so analytics stay off until it is configured.`
  );
}

export default posthog;
