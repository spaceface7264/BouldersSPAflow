/**
 * Analytics Utilities for Server-Side Tracking
 * 
 * Implements Steps 13-17 of the analytics integration:
 * - Captures GA4 client ID after consent
 * - Provides analytics headers for API requests
 * - Respects cookie consent
 */

// GA4 Measurement ID for boulders-api-flow
const GA4_MEASUREMENT_ID = 'G-5LK4VMR8E2';

// In-memory storage for GA4 client ID (not persisted to localStorage)
let gaClientId = null;
let gaClientIdPromise = null;

/**
 * Get the current GA4 client ID
 * @returns {string|null} The GA4 client ID or null if not available
 */
export function getGA4ClientId() {
  return gaClientId;
}

/**
 * Clear the GA4 client ID (when consent is withdrawn)
 */
export function clearGA4ClientId() {
  gaClientId = null;
  gaClientIdPromise = null;
  console.log('[Analytics] GA4 client ID cleared');
}

/**
 * Capture GA4 client ID after consent is granted
 * Uses gtag('get') to retrieve the client ID
 * @returns {Promise<string|null>} The GA4 client ID or null if unavailable
 */
export function captureGA4ClientId() {
  // If we already have it, return it
  if (gaClientId) {
    return Promise.resolve(gaClientId);
  }

  // If we're already trying to capture it, return the existing promise
  if (gaClientIdPromise) {
    return gaClientIdPromise;
  }

  // Check if consent is granted
  const consent = getCookieConsent();
  if (!consent) {
    console.log('[Analytics] No consent - cannot capture GA4 client ID');
    return Promise.resolve(null);
  }

  const hasAnalytics = getCookieCategoryConsent('analytics');
  const hasMarketing = getCookieCategoryConsent('marketing');
  
  if (!hasAnalytics && !hasMarketing) {
    console.log('[Analytics] Analytics/marketing consent not granted - cannot capture GA4 client ID');
    return Promise.resolve(null);
  }

  // Check if gtag is available
  if (typeof window.gtag !== 'function') {
    console.warn('[Analytics] gtag not available - GA4 may not be loaded yet');
    // Try again after a short delay
    gaClientIdPromise = new Promise((resolve) => {
      setTimeout(() => {
        gaClientIdPromise = null;
        resolve(captureGA4ClientId());
      }, 1000);
    });
    return gaClientIdPromise;
  }

  // Capture the client ID
  gaClientIdPromise = new Promise((resolve) => {
    try {
      window.gtag('get', GA4_MEASUREMENT_ID, 'client_id', (clientId) => {
        if (clientId) {
          gaClientId = clientId;
          console.log('[Analytics] GA4 client ID captured:', clientId);
        } else {
          console.warn('[Analytics] GA4 client ID is null or undefined');
        }
        gaClientIdPromise = null;
        resolve(clientId || null);
      });
    } catch (error) {
      console.error('[Analytics] Error capturing GA4 client ID:', error);
      gaClientIdPromise = null;
      resolve(null);
    }
  });

  return gaClientIdPromise;
}

/**
 * Update GA4 consent mode based on cookie consent
 * @param {Object} consentData - The consent data object
 */
export function updateGA4ConsentMode(consentData) {
  const hasAnalytics = consentData?.categories?.analytics || false;
  const hasMarketing = consentData?.categories?.marketing || false;
  const hasConsent = hasAnalytics || hasMarketing;

  const consentUpdate = {
    analytics_storage: hasConsent ? 'granted' : 'denied',
    ad_storage: hasMarketing ? 'granted' : 'denied',
    ad_user_data: hasMarketing ? 'granted' : 'denied',
    ad_personalization: hasMarketing ? 'granted' : 'denied',
  };

  try {
    // Try using gtag if available (preferred method)
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', consentUpdate);
    } else {
      // Fallback to dataLayer if gtag not available yet
      if (window.dataLayer) {
        window.dataLayer.push({
          'consent': 'update',
          ...consentUpdate,
        });
      } else {
        console.warn('[Analytics] Neither gtag nor dataLayer available - cannot update consent mode');
        return;
      }
    }

    console.log('[Analytics] GA4 consent mode updated:', {
      analytics_storage: hasConsent ? 'granted' : 'denied',
      ad_storage: hasMarketing ? 'granted' : 'denied',
    });

    // If consent is granted, capture client ID
    if (hasConsent) {
      // Wait a bit for GA4 to initialize, then capture
      setTimeout(() => {
        captureGA4ClientId();
      }, 500);
    } else {
      // Clear client ID if consent is withdrawn
      clearGA4ClientId();
    }
  } catch (error) {
    console.error('[Analytics] Error updating GA4 consent mode:', error);
  }
}

/**
 * Get analytics headers for API requests
 * Only includes headers if consent is granted
 * @param {string|null} customerId - Optional customer ID (BRP customer ID)
 * @returns {Object} Headers object with x-ga-client-id and optionally x-ga-user-id
 */
export function getAnalyticsHeaders(customerId = null) {
  const headers = {};

  // Check consent
  const consent = getCookieConsent();
  if (!consent) {
    return headers; // No consent, no headers
  }

  const hasAnalytics = getCookieCategoryConsent('analytics');
  const hasMarketing = getCookieCategoryConsent('marketing');
  
  if (!hasAnalytics && !hasMarketing) {
    return headers; // No consent, no headers
  }

  // Add GA4 client ID if available
  const clientId = getGA4ClientId();
  if (clientId) {
    headers['x-ga-client-id'] = clientId;
  }

  // Add customer ID if provided and user is authenticated
  if (customerId) {
    headers['x-ga-user-id'] = String(customerId);
  }

  return headers;
}

/**
 * Helper to get cookie consent (imported from app.js or defined here)
 * This will be set by the main app
 */
let getCookieConsent = null;
let getCookieCategoryConsent = null;

/**
 * Initialize analytics utilities with cookie consent functions
 * @param {Function} getConsentFn - Function to get cookie consent
 * @param {Function} getCategoryConsentFn - Function to get category consent
 */
export function initAnalytics(getConsentFn, getCategoryConsentFn) {
  getCookieConsent = getConsentFn;
  getCookieCategoryConsent = getCategoryConsentFn;
  console.log('[Analytics] Analytics utilities initialized');
}

// Export measurement ID for use elsewhere
export { GA4_MEASUREMENT_ID };
