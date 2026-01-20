/**
 * Sentry Configuration for Error Monitoring
 *
 * This module initializes Sentry for production error tracking and monitoring.
 *
 * Setup Instructions:
 * 1. Create a Sentry account at https://sentry.io
 * 2. Create a new project for "JavaScript - Browser"
 * 3. Copy your DSN from the project settings
 * 4. Set the VITE_SENTRY_DSN environment variable in Cloudflare Pages:
 *    - Go to Settings > Environment Variables
 *    - Add: VITE_SENTRY_DSN = your-dsn-here
 * 5. (Optional) Set VITE_SENTRY_ENVIRONMENT to "production" or "staging"
 *
 * For local development:
 * - Create a .env file with: VITE_SENTRY_DSN=your-dsn-here
 * - Sentry will be disabled if DSN is not set
 */

import * as Sentry from '@sentry/browser';

/**
 * Initialize Sentry error monitoring
 * @param {Object} options - Configuration options
 * @param {string} options.dsn - Sentry DSN (Data Source Name)
 * @param {string} options.environment - Environment name (production, staging, development)
 * @param {number} options.sampleRate - Error sample rate (0.0 to 1.0)
 * @param {number} options.tracesSampleRate - Performance monitoring sample rate (0.0 to 1.0)
 */
export function initSentry(options = {}) {
  // Get DSN from environment variable or options
  const dsn = options.dsn || import.meta.env.VITE_SENTRY_DSN;

  // Don't initialize if no DSN is provided
  if (!dsn) {
    console.warn('[Sentry] DSN not configured. Error monitoring is disabled.');
    console.warn('[Sentry] Set VITE_SENTRY_DSN environment variable to enable.');
    return;
  }

  // Determine environment
  const environment = options.environment
    || import.meta.env.VITE_SENTRY_ENVIRONMENT
    || (window.location.hostname === 'join.boulders.dk' ? 'production' : 'development');

  // Enable based on options, or default to production only
  const enabled = options.enabled !== undefined
    ? options.enabled
    : (environment === 'production');

  Sentry.init({
    dsn,
    environment,
    enabled,

    // Sample rate for error events (1.0 = 100% of errors)
    sampleRate: options.sampleRate || 1.0,

    // Sample rate for performance monitoring (0.1 = 10% of transactions)
    // Lower rate to reduce quota usage
    tracesSampleRate: options.tracesSampleRate || 0.1,

    // Integrations
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration({
        // Trace user interactions
        traceFetch: true,
        traceXHR: true,
      }),

      // Breadcrumbs for debugging context
      Sentry.breadcrumbsIntegration({
        console: true,
        dom: true,
        fetch: true,
        history: true,
        xhr: true,
      }),
    ],

    // Filter out common non-critical errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension://',
      'moz-extension://',

      // Network errors that are expected
      'NetworkError',
      'Failed to fetch',

      // User cancellations
      'AbortError',
      'User cancelled',
    ],

    // Filter sensitive data from being sent to Sentry
    beforeSend(event, hint) {
      // Remove sensitive data from request headers
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.Cookie;
      }

      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data?.Authorization) {
            delete breadcrumb.data.Authorization;
          }
          return breadcrumb;
        });
      }

      return event;
    },

    // Release version for tracking
    release: import.meta.env.VITE_SENTRY_RELEASE || 'unknown',
  });

  console.log(`[Sentry] Initialized in ${environment} mode (enabled: ${enabled})`);
}

/**
 * Capture an exception manually
 * @param {Error} error - The error to capture
 * @param {Object} context - Additional context
 */
export function captureException(error, context = {}) {
  Sentry.captureException(error, {
    tags: context.tags,
    extra: context.extra,
    level: context.level || 'error',
  });
}

/**
 * Capture a message manually
 * @param {string} message - The message to capture
 * @param {string} level - Severity level (info, warning, error)
 * @param {Object} context - Additional context
 */
export function captureMessage(message, level = 'info', context = {}) {
  Sentry.captureMessage(message, {
    level,
    tags: context.tags,
    extra: context.extra,
  });
}

/**
 * Set user context for error tracking
 * @param {Object} user - User information
 * @param {string} user.id - User ID
 * @param {string} user.email - User email
 */
export function setUser(user) {
  Sentry.setUser(user ? {
    id: user.id,
    email: user.email,
  } : null);
}

/**
 * Add breadcrumb for debugging context
 * @param {string} message - Breadcrumb message
 * @param {Object} data - Additional data
 * @param {string} category - Breadcrumb category
 */
export function addBreadcrumb(message, data = {}, category = 'custom') {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

// Make Sentry available globally for debugging and compatibility
if (typeof window !== 'undefined') {
  window.Sentry = Sentry;
  // Also expose helper functions for convenience
  window.Sentry.captureException = captureException;
  window.Sentry.captureMessage = captureMessage;
  window.Sentry.setUser = setUser;
  window.Sentry.addBreadcrumb = addBreadcrumb;
}
