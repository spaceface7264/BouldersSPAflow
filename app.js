import {
  formatCurrencyHalfKrone,
  formatPriceHalfKrone,
  roundToHalfKrone,
} from './utils/format.js';
import { formatDistance } from './utils/geo.js';
import { getFlagEmoji } from './utils/locale.js';
import {
  clearLoginSessionCookie,
  hydrateFromCookie,
  readLoginSessionCookie,
  writeLoginSessionCookie,
} from './utils/tokenStorage.js';
import {
  formatCardNumber,
  formatExpiryDate,
  stripNonDigits,
} from './utils/input.js';
import { stripEmailPlusTag } from './utils/string.js';
import { formatDateDMY } from './utils/date.js';
import { showToast } from './utils/toast.js';
import { getErrorMessage } from './utils/errors.js';
import { isValidCardNumber, isValidExpiryDate } from './utils/validation.js';
import { highlightFieldError } from './utils/dom.js';
import { getApiConfig } from './utils/apiConfig.js';
import {
  calculateGymDistances,
  checkGeolocationPermission,
  getUserLocation,
  isGeolocationAvailable,
} from './utils/geolocation.js';
import { buildApiUrl, requestJson } from './utils/apiRequest.js';

const VALUE_CARD_PUNCH_MULTIPLIER = 10;

const debugEnabled = window.DEBUG_LOGS === true;
const originalConsoleLog = console.log.bind(console);
const originalConsoleWarn = console.warn.bind(console);
if (!debugEnabled) {
  console.log = () => {};
  console.warn = () => {};
}
const devLog = (...args) => {
  if (debugEnabled) originalConsoleLog(...args);
};
const devWarn = (...args) => {
  if (debugEnabled) originalConsoleWarn(...args);
};
const geoLogger = { log: devLog, warn: devWarn };

const REQUIRED_FIELDS = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'streetAddress',
  'postalCode',
  'email',
  'countryCode',
  'password',
  'primaryGym',
];

const PARENT_REQUIRED_FIELDS = [
  'parentFullName',
  'parentDateOfBirth',
  'parentStreetAddress',
  'parentPostalCode',
  'parentEmail',
  'parentCountryCode',
  'parentPassword',
  'parentPrimaryGym',
];

const CARD_FIELDS = ['cardNumber', 'expiryDate', 'cvv', 'cardholderName'];


// API Integration Functions
class BusinessUnitsAPI {
  constructor(baseUrl = null) {
    const config = getApiConfig({ baseUrlOverride: baseUrl });
    this.baseUrl = config.baseUrl;
    this.useProxy = config.useProxy;
  }

  // Get all business units from API
  // Step 3: Fetch from /api/reference/business-units endpoint
  // Note: This endpoint uses "No Auth" according to Postman docs
  async getBusinessUnits() {
    try {
      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: '/api/reference/business-units',
      });
      devLog('Fetching business units from:', url);
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(), // Step 2: Language default
        'Content-Type': 'application/json',
        // No Authorization header needed - endpoint uses "No Auth"
      };

      const data = await requestJson({ url, headers });
      devLog('Business units API response:', data);
      devLog('Response type:', Array.isArray(data) ? 'Array' : typeof data);
      devLog('Number of items:', Array.isArray(data) ? data.length : 'N/A');

      return data;
    } catch (error) {
      console.error('Error fetching business units:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        status: error.status,
        payload: error.payload,
      });
      // Don't use fallback mock data - throw error so caller can handle it
      throw error;
    }
  }

  // Create a new business unit
  async createBusinessUnit(businessUnitData) {
    try {
      const response = await fetch(`${this.baseUrl}/api/ver3/businessunits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(businessUnitData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error creating business unit:', error);
      throw error;
    }
  }

  // Update an existing business unit
  async updateBusinessUnit(id, businessUnitData) {
    try {
      const response = await fetch(`${this.baseUrl}/api/ver3/businessunits/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(businessUnitData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating business unit:', error);
      throw error;
    }
  }

  // Step 5: Get subscriptions (memberships) for a business unit
  // According to OpenAPI spec (line ~8287):
  // - subscriber parameter: "This is to determine whether the product is bookable for the subscription user"
  // - allowedToOrder field: "To determine whether the subscription product is bookable for the subscription user or not"
  // Note: When no subscriber is provided (anonymous users), allowedToOrder should reflect whether
  // the product can be booked via internet (based on backend checkbox settings)
  async getSubscriptions(businessUnitId) {
    try {
      // Build URL with business unit as query parameter
      // Note: We don't send subscriber/customer parameters for anonymous users
      // Backend should set allowedToOrder based on "kan bookes via internet" checkbox
      const cacheBuster = `&_t=${Date.now()}`;
      const queryParam = businessUnitId ? `?businessUnit=${businessUnitId}${cacheBuster}` : `?_t=${Date.now()}`;
      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: `/api/products/subscriptions${queryParam}`,
      });
      devLog('Fetching subscriptions from:', url);
      
      const acceptLanguage = getAcceptLanguageHeader();
      const headers = {
        'Accept-Language': acceptLanguage,
        'Content-Type': 'application/json',
      };
      
      devLog('[API] Fetching subscriptions with Accept-Language:', acceptLanguage);

      const data = await requestJson({ url, headers });
      devLog('[API] Subscriptions response sample:', data[0] ? { id: data[0].id, name: data[0].name, description: data[0].description?.substring(0, 50), imageBannerText: data[0].imageBanner?.text?.substring(0, 50) } : 'empty');
      return data;
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }
  }

  // Step 5: Get value cards (punch cards)
  async getValueCards() {
    try {
      const cacheBuster = `?_t=${Date.now()}`;
      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: `/api/products/valuecards${cacheBuster}`,
      });
      devLog('Fetching value cards from:', url);
      
      const acceptLanguage = getAcceptLanguageHeader();
      const headers = {
        'Accept-Language': acceptLanguage,
        'Content-Type': 'application/json',
      };
      
      devLog('[API] Fetching value cards with Accept-Language:', acceptLanguage);

      const data = await requestJson({ url, headers });
      devLog('[API] Value cards response sample:', data[0] ? { 
        id: data[0].id, 
        name: data[0].name, 
        description: data[0].description?.substring(0, 50) 
      } : 'empty');
      return data;
    } catch (error) {
      console.error('Error fetching value cards:', error);
      throw error;
    }
  }

  // Step 5: Get subscription additions (add-ons) for a specific membership product
  // Note: The /additions endpoint may not exist yet - this is a placeholder for when it's available
  async getSubscriptionAdditions(productId) {
    try {
      // Try the additions endpoint first (as per guide)
      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: `/api/products/subscriptions/${productId}/additions`,
      });
      devLog('Fetching subscription additions from:', url);
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
      };

      let data;
      try {
        data = await requestJson({ url, headers });
      } catch (error) {
        // If 404, the endpoint doesn't exist yet - return empty array for now
        if (error.status === 404) {
          devWarn(`Additions endpoint not found for product ${productId}. Endpoint may not be implemented yet.`);
          return [];
        }
        throw error;
      }
      devLog('Subscription additions API response:', data);
      
      // Handle different response formats
      return Array.isArray(data) ? data : (data.data || data.items || []);
    } catch (error) {
      console.error('Error fetching subscription additions:', error);
      // Return empty array if endpoint doesn't exist - don't break the flow
      devWarn('Returning empty array for add-ons - endpoint may not be available yet');
      return [];
    }
  }

  // Step 8: Get additional catalog items - GET /api/products
  // To offer more products, fetch catalogs with GET /api/products
  async getProducts(businessUnitId = null) {
    try {
      const queryParam = businessUnitId ? `?businessUnit=${businessUnitId}` : '';
      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: `/api/products${queryParam}`,
      });
      
      devLog('[Step 8] Fetching additional catalog products from:', url);
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
      };

      let data;
      try {
        data = await requestJson({ url, headers });
      } catch (error) {
        // If 404, the endpoint doesn't exist yet - return empty array
        if (error.status === 404) {
          devLog('[Step 8] Products endpoint not found (404) - may not be implemented yet');
          return [];
        }
        throw error;
      }

      devLog('[Step 8] Products API response:', data);
      
      // Handle different response formats
      return Array.isArray(data) ? data : (data.data || data.items || []);
    } catch (error) {
      console.error('[Step 8] Error fetching products:', error);
      // Return empty array if endpoint doesn't exist - don't break the flow
      return [];
    }
  }
}

// Step 4: Reference Data Loader API
// Fetches reference/lookup data after business unit selection
// Caches responses in client state and refreshes when business unit changes
class ReferenceDataAPI {
  constructor(baseUrl = null) {
    const config = getApiConfig({ baseUrlOverride: baseUrl });
    this.baseUrl = config.baseUrl;
    this.useProxy = config.useProxy;
    this.isDevelopment = config.isDevelopment;
  }

  // Fetch reference data (extensible for different types of reference data)
  // This is a flexible method that can be extended as needed
  async getReferenceData(type, businessUnitId = null) {
    try {
      // Build endpoint path based on type
      // Examples: 'countries', 'regions', 'currencies', 'payment-methods', etc.
      let endpoint = `/api/reference/${type}`;
      
      // Add business unit query param if provided and needed
      const queryParam = businessUnitId ? `?businessUnit=${businessUnitId}` : '';
      
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=${endpoint}${queryParam}`;
      } else {
        url = `${this.baseUrl}${endpoint}${queryParam}`;
      }
      
      console.log(`[Step 4] Fetching reference data (${type}) from:`, url);
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        // If 404, the endpoint doesn't exist - return null (not an error, just not available)
        if (response.status === 404) {
          console.log(`[Step 4] Reference data endpoint ${type} not found (404) - may not be implemented yet`);
          return null;
        }
        
        const errorText = await response.text();
        console.error(`[Step 4] API Error (${response.status}):`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`[Step 4] Reference data (${type}) API response:`, data);
      return data;
    } catch (error) {
      console.error(`[Step 4] Error fetching reference data (${type}):`, error);
      // Don't throw - reference data is optional, return null instead
      return null;
    }
  }

  // Fetch all reference data types that might be needed
  // This can be extended as new reference data types are identified
  async getAllReferenceData(businessUnitId = null) {
    const referenceData = {};
    
    // List of reference data types to fetch
    // Add more types here as they become available/needed
    const referenceTypes = [
      // 'countries',      // If available
      // 'regions',         // If available
      // 'currencies',      // If available
      // 'payment-methods', // If available
      // Add more as needed
    ];
    
    // Fetch all reference data types in parallel
    const promises = referenceTypes.map(async (type) => {
      const data = await this.getReferenceData(type, businessUnitId);
      if (data !== null) {
        referenceData[type] = data;
      }
    });
    
    await Promise.all(promises);
    
    console.log('[Step 4] All reference data loaded:', referenceData);
    return referenceData;
  }

  // Lookup city by postal code
  // Endpoint: GET /api/addresses/{postalCode}
  async lookupCityByPostalCode(postalCode) {
    if (!postalCode || postalCode.trim().length === 0) {
      return null;
    }

    try {
      // Clean postal code (remove spaces, ensure it's a valid format)
      const cleanPostalCode = postalCode.trim().replace(/\s+/g, '');
      
      // Danish postal codes are 4 digits
      if (!/^\d{4}$/.test(cleanPostalCode)) {
        console.log('[PostalCode] Invalid postal code format:', cleanPostalCode);
        return null;
      }

      const endpoint = `/api/addresses/${cleanPostalCode}`;
      
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=${endpoint}`;
      } else {
        // In development, use full API URL if baseUrl is empty
        const apiBase = this.baseUrl || 'https://api-join.boulders.dk';
        url = `${apiBase}${endpoint}`;
      }
      
      console.log('[PostalCode] Looking up city for postal code:', cleanPostalCode, 'from:', url);
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        // If 404, endpoint doesn't exist yet - try local lookup as fallback
        if (response.status === 404) {
          console.log('[PostalCode] Address lookup endpoint not available (404) - trying local lookup...');
          
          // Try local lookup if available
          if (typeof lookupCityByPostalCode === 'function') {
            const localCity = lookupCityByPostalCode(cleanPostalCode);
            if (localCity) {
              console.log('[PostalCode] Found city in local lookup:', localCity);
              return localCity;
            }
          }
          
          // If local lookup also fails, return unavailable flag
          return { unavailable: true };
        }
        
        const errorText = await response.text();
        console.error(`[PostalCode] API Error (${response.status}):`, errorText);
        return null; // Don't throw - just return null if lookup fails
      }
      
      const data = await response.json();
      console.log('[PostalCode] Address lookup response:', data);
      
      // Extract city name from response
      // API might return: { city: "Copenhagen" } or { address: { city: "Copenhagen" } }
      const city = data?.city || data?.address?.city || data?.name || null;
      
      if (city) {
        console.log('[PostalCode] Found city:', city, 'for postal code:', cleanPostalCode);
        return city;
      }
      
      return null;
    } catch (error) {
      console.error('[PostalCode] Error looking up city by postal code:', error);
      // Network errors or CORS issues - try local lookup as fallback
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS') || errorMessage.includes('NetworkError')) {
        console.log('[PostalCode] Network/CORS error - trying local lookup...');
        
        // Try local lookup if available
        if (typeof lookupCityByPostalCode === 'function') {
          const cleanPostalCode = postalCode.trim().replace(/\s+/g, '');
          const localCity = lookupCityByPostalCode(cleanPostalCode);
          if (localCity) {
            console.log('[PostalCode] Found city in local lookup:', localCity);
            return localCity;
          }
        }
        
        return { unavailable: true };
      }
      return null; // Don't throw - just return null if lookup fails
    }
  }
}

// Step 6: Authentication API
// Handles login, token management, customer creation, and password reset
class AuthAPI {
  constructor(baseUrl = null) {
    const config = getApiConfig({ baseUrlOverride: baseUrl });
    this.baseUrl = config.baseUrl;
    this.useProxy = config.useProxy;
    this.isDevelopment = config.isDevelopment;
  }

  // Step 6: Login - Submit login credentials and store tokens
  async login(email, password, options = {}) {
    try {
      const { saveTokens = true } = options;
      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: '/api/auth/login',
      });
      
      devLog('[Step 6] Logging in:', url);
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
      };
      
      // API expects username field (which is the email)
      let data;
      try {
        data = await requestJson({
          url,
          method: 'POST',
          headers,
          body: { username: email, password },
        });
      } catch (error) {
        const errorPayload = error?.payload;
        const payloadText = typeof errorPayload === 'string' ? errorPayload : JSON.stringify(errorPayload);
        console.error(`[Step 6] Login error (${error.status || 'unknown'}):`, payloadText || error);

        // Handle rate limit errors with better messaging
        if (error.status === 429) {
          let retryAfterSeconds = 60; // Default 1 minute (60 seconds)
          if (errorPayload && typeof errorPayload === 'object' && errorPayload.retryAfter) {
            retryAfterSeconds = parseInt(errorPayload.retryAfter, 10);
          } else if (payloadText) {
            const retryMatch = payloadText.match(/retryAfter["\s:]*(\d+)/i);
            if (retryMatch) {
              retryAfterSeconds = parseInt(retryMatch[1], 10);
            }
          }
          if (typeof window !== 'undefined') {
            window.loginCooldownUntil = Date.now() + (retryAfterSeconds * 1000);
          }
          const retryMinutes = Math.floor(retryAfterSeconds / 60);
          const retrySeconds = retryAfterSeconds % 60;
          const retryMessage = retryMinutes > 0
            ? `${retryMinutes} minute${retryMinutes !== 1 ? 's' : ''}${retrySeconds > 0 ? ` and ${retrySeconds} second${retrySeconds !== 1 ? 's' : ''}` : ''}`
            : `${retryAfterSeconds} second${retryAfterSeconds !== 1 ? 's' : ''}`;
          throw new Error(`Rate limit exceeded. Please wait ${retryMessage} before trying again. (${error.status} - ${payloadText})`);
        }

        // Handle 401 errors - preserve error structure for getErrorMessage
        if (error.status === 401 && errorPayload && typeof errorPayload === 'object') {
          if (errorPayload.error?.code === 'INVALID_CREDENTIALS' || errorPayload.error?.message) {
            throw new Error(`Login failed: ${error.status} - ${payloadText}`);
          }
        }

        throw new Error(`Login failed: ${error.status || 'unknown'} - ${payloadText || error.message}`);
      }

      devLog('[Step 6] Login response:', data);
      
      const tokenPayload = data?.data ?? data;
      const accessToken = tokenPayload.accessToken || tokenPayload.access_token;
      const refreshToken = tokenPayload.refreshToken || tokenPayload.refresh_token;
      let expiresAt = tokenPayload.expiresAt || tokenPayload.expires_at;
      const expiresIn = tokenPayload.expiresIn || tokenPayload.expires_in;
      if (!expiresAt && expiresIn) {
        const expiresInMs = Number(expiresIn) * 1000;
        expiresAt = Date.now() + (Number.isFinite(expiresInMs) ? expiresInMs : 0);
      }
      
      if (accessToken && refreshToken) {
        if (typeof window.saveTokens === 'function') {
          if (saveTokens) {
            const metadata = {
              username: tokenPayload.username || tokenPayload.userName,
              email: tokenPayload.email || email,
              roles: tokenPayload.roles || [],
              tokenType: tokenPayload.tokenType || tokenPayload.token_type,
              expiresIn: tokenPayload.expiresIn || tokenPayload.expires_in,
            };
            window.saveTokens(accessToken, refreshToken, expiresAt, metadata);
            console.log('[Step 6] ✅ Tokens saved successfully');
          }
        } else {
          console.warn('[Step 6] saveTokens function not available - tokens not saved');
        }
      } else {
        console.warn('[Step 6] ⚠️ No tokens found in login response');
        console.warn('[Step 6] Response structure:', Object.keys(data));
        if (data.data) {
          console.warn('[Step 6] Data object structure:', Object.keys(data.data));
        }
      }
      
      return data;
    } catch (error) {
      console.error('[Step 6] Login error:', error);
      throw error;
    }
  }

  // Step 6: Validate token - Keep tokens fresh when app reloads
  async validateToken() {
    try {
      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: '/api/auth/validate',
      });
      
      devLog('[Step 6] Validating token:', url);
      
      // Note: Authorization header will be added automatically by HttpClient
      // But since we're using fetch directly, we need to add it manually
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };
      
      const data = await requestJson({
        url,
        method: 'POST',
        headers,
        body: { accessToken },
      });
      devLog('[Step 6] Token validation response:', data);
      return data;
    } catch (error) {
      console.error('[Step 6] Token validation error:', error);
      throw error;
    }
  }

  // Step 6: Refresh token - Refresh expired tokens
  async refreshToken() {
    try {
      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: '/api/auth/refresh',
      });
      
      devLog('[Step 6] Refreshing token:', url);
      
      const refreshToken = typeof window.getRefreshToken === 'function' 
        ? window.getRefreshToken() 
        : null;
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
      };
      
      let data;
      try {
        data = await requestJson({
          url,
          method: 'POST',
          headers,
          body: { refreshToken },
        });
      } catch (error) {
        const payloadText = typeof error.payload === 'string' ? error.payload : JSON.stringify(error.payload);
        console.error(`[Step 6] Token refresh error (${error.status || 'unknown'}):`, payloadText || error);
        const isRateLimit = error.status === 429;
        // If refresh fails for other reasons, clear tokens and return to auth step
        if (!isRateLimit && typeof window.clearTokens === 'function') {
          window.clearTokens();
        }
        throw new Error(`Token refresh failed: ${error.status || 'unknown'} - ${payloadText || error.message}`);
      }
      
      devLog('[Step 6] Token refresh response:', data);
      
      const tokenPayload = data?.data ?? data;
      const newAccessToken = tokenPayload.accessToken || tokenPayload.access_token;
      const newRefreshToken = tokenPayload.refreshToken || tokenPayload.refresh_token || refreshToken;
      let newExpiresAt = tokenPayload.expiresAt || tokenPayload.expires_at;
      const expiresIn = tokenPayload.expiresIn || tokenPayload.expires_in;
      if (!newExpiresAt && expiresIn) {
        const expiresInMs = Number(expiresIn) * 1000;
        newExpiresAt = Date.now() + (Number.isFinite(expiresInMs) ? expiresInMs : 0);
      }
      
      // Store new tokens with metadata
      if (newAccessToken && newRefreshToken && typeof window.saveTokens === 'function') {
        const metadata = {
          username: tokenPayload.username || data.username,
          email: tokenPayload.email || data.email || state.authenticatedEmail,
          roles: tokenPayload.roles || data.roles,
          tokenType: tokenPayload.tokenType || tokenPayload.token_type || data.tokenType || data.token_type,
          expiresIn: expiresIn,
        };
        window.saveTokens(newAccessToken, newRefreshToken, newExpiresAt, metadata);
        
        // Update header auth indicator after token refresh
        refreshHeaderAuthIndicator();
        
        // Dispatch event to notify React components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-state-changed'));
        }
      }
      
      return tokenPayload;
    } catch (error) {
      console.error('[Step 6] Token refresh error:', error);
      throw error;
    }
  }

  // Step 6: Password reset - Offer forgotten-password flow
  // Endpoint: POST /api/ver3/auth/resetpassword
  // Base URL: https://boulders.brpsystems.com/apiserver (handled by proxy for ver3 endpoints)
  // appId is optional - if not provided, BRP will use default setting for reset link
  async resetPassword(email, appId = null) {
    try {
      const url = this.useProxy
        ? buildApiUrl({
            baseUrl: this.baseUrl,
            useProxy: this.useProxy,
            path: '/api/ver3/auth/resetpassword',
          })
        : 'https://boulders.brpsystems.com/apiserver/api/ver3/auth/resetpassword';
      
      devLog('[Step 6] Requesting password reset:', url);
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
      };
      
      // Build payload - appId is optional
      // If appId is provided, convert to number; otherwise omit it
      const payload = { email };
      if (appId !== null && appId !== undefined) {
        const numericAppId = typeof appId === 'string' ? parseInt(appId, 10) : appId;
        if (!isNaN(numericAppId)) {
          payload.appId = numericAppId;
        }
      }
      
      devLog('[Step 6] Password reset payload:', payload);

      let data;
      try {
        data = await requestJson({
          url,
          method: 'POST',
          headers,
          body: payload,
          expectJson: false,
        });
      } catch (error) {
        const payloadText = typeof error.payload === 'string' ? error.payload : JSON.stringify(error.payload);
        console.error(`[Step 6] Password reset error (${error.status || 'unknown'}):`, payloadText || error);
        throw new Error(`Password reset failed: ${error.status || 'unknown'} - ${payloadText || error.message}`);
      }

      devLog('[Step 6] Password reset response:', data);
      return { success: true, data };
    } catch (error) {
      console.error('[Step 6] Password reset error:', error);
      throw error;
    }
  }

  // Step 6: Create customer - For new users
  async createCustomer(customerData) {
    try {
      // Always include the active business unit
      if (!customerData.businessUnit && state.selectedBusinessUnit) {
        customerData.businessUnit = state.selectedBusinessUnit;
      }
      
      // The API expects the customer data nested under a "customer" key
      // Based on error field paths like "customer.email", "customer.firstName"
      const requestPayload = {
        customer: customerData
      };
      
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/customers`;
      } else {
        url = `${this.baseUrl}/api/customers`;
      }
      
      console.log('[Step 6] Creating customer:', url);
      console.log('[Step 6] Customer data being sent:', JSON.stringify(requestPayload, null, 2));
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 6] Create customer error (${response.status}):`, errorText);
        
        // Check for duplicate email error
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          // If not JSON, use the text as-is
          errorData = { message: errorText };
        }
        
        // Log the full error for debugging
        console.error('[Step 6] Full error data:', JSON.stringify(errorData, null, 2));
        console.error('[Step 6] Error code:', errorData?.errorCode);
        console.error('[Step 6] Field errors:', errorData?.fieldErrors);
        
        // Check if this is a duplicate email error
        const errorMessage = errorData?.message || errorText || '';
        const errorLower = errorMessage.toLowerCase();
        const errorCode = errorData?.errorCode || '';
        const errorCodeLower = errorCode.toLowerCase();

        // Handle validation errors for email (e.g., incomplete/invalid email)
        const validationDetails = errorData?.error?.details;
        const emailValidationDetail = Array.isArray(validationDetails)
          ? validationDetails.find(detail => {
              const field = (detail?.field || '').toLowerCase();
              return field.includes('email') || field === 'customer.email';
            })
          : null;
        if (emailValidationDetail) {
          const validationError = new Error('Please enter a valid email address.');
          validationError.status = response.status;
          validationError.isInvalidEmail = true;
          validationError.validationDetail = emailValidationDetail;
          throw validationError;
        }
        
        // Check for EMAIL_ALREADY_EXISTS error code (from API docs)
        const hasEmailExistsErrorCode = 
          errorCodeLower === 'email_already_exists' ||
          errorCodeLower === 'email_already_exists_name' ||
          errorCode === 'EMAIL_ALREADY_EXISTS' ||
          errorCode === 'EMAIL_ALREADY_EXISTS_NAME';
        
        // Check fieldErrors array for email-related errors
        const hasEmailFieldError = errorData?.fieldErrors && Array.isArray(errorData.fieldErrors) &&
          errorData.fieldErrors.some(err => {
            const field = err?.field || '';
            const fieldLower = field.toLowerCase();
            const errCode = err?.errorCode || '';
            const errCodeLower = errCode.toLowerCase();
            return (
              fieldLower.includes('email') ||
              fieldLower === 'customer.email' ||
              errCodeLower === 'email_already_exists' ||
              errCode === 'EMAIL_ALREADY_EXISTS'
            );
          });
        
        // Check for email-related error messages
        const hasEmailErrorMessage = 
          errorLower.includes('email') && (
            errorLower.includes('already exists') ||
            errorLower.includes('already registered') ||
            errorLower.includes('duplicate') ||
            errorLower.includes('taken') ||
            errorLower.includes('in use') ||
            errorLower.includes('is already') ||
            errorLower.includes('already in use')
          );
        
        // Check errors array (alternative format)
        const hasEmailInErrorsArray = errorData?.errors && Array.isArray(errorData.errors) && 
          errorData.errors.some(err => {
            const errMsg = (err?.message || err?.msg || '').toLowerCase();
            const errField = (err?.field || err?.path || '').toLowerCase();
            return (
              errField.includes('email') ||
              errField === 'customer.email' ||
              errMsg.includes('email') && (
                errMsg.includes('already exists') ||
                errMsg.includes('duplicate') ||
                errMsg.includes('taken')
              )
            );
          });
        
        const isDuplicateEmail = 
          hasEmailExistsErrorCode ||
          hasEmailFieldError ||
          hasEmailErrorMessage ||
          hasEmailInErrorsArray ||
          (response.status === 409 && errorLower.includes('email')) || // Conflict with email mention
          (response.status === 400 && hasEmailErrorMessage); // Bad Request with email error
        
        console.log('[Step 6] Duplicate email check:', {
          isDuplicateEmail,
          hasEmailExistsErrorCode,
          hasEmailFieldError,
          hasEmailErrorMessage,
          hasEmailInErrorsArray,
          status: response.status,
          errorCode,
          errorMessage: errorMessage.substring(0, 200)
        });
        
        if (isDuplicateEmail) {
          const duplicateError = new Error(`An account with this email address already exists. Please log in instead.`);
          duplicateError.status = response.status;
          duplicateError.isDuplicateEmail = true;
          duplicateError.originalError = errorData;
          throw duplicateError;
        }
        
        throw new Error(`Create customer failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Step 6] Create customer response:', data);
      return data;
    } catch (error) {
      console.error('[Step 6] Create customer error:', error);
      throw error;
    }
  }

  // Step 6: Get customer profile
  async getCustomer(customerId) {
    try {
      let url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: `/api/customers/${customerId}`,
      });
      
      devLog('[Step 6] Fetching customer profile:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };

      try {
        const data = await requestJson({ url, headers });
        devLog('[Step 6] Get customer response:', data);

        const hasProfileDetails = Boolean(
          data?.firstName ||
          data?.lastName ||
          data?.shippingAddress ||
          data?.address ||
          data?.mobilePhone ||
          data?.phone ||
          data?.phoneNumber
        );

        if (!hasProfileDetails) {
          const fallbackUrl = this.useProxy
            ? buildApiUrl({
                baseUrl: this.baseUrl,
                useProxy: this.useProxy,
                path: `/api/ver3/customers/${customerId}`,
              })
            : `https://boulders.brpsystems.com/apiserver/api/ver3/customers/${customerId}`;
          devWarn('[Step 6] Customer profile missing details. Retrying with ver3:', fallbackUrl);
          const fallbackData = await requestJson({ url: fallbackUrl, headers });
          devLog('[Step 6] Get customer response (ver3):', fallbackData);
          return fallbackData;
        }

        return data;
      } catch (error) {
        if (error.status === 404 && this.useProxy) {
          // Fallback to ver3 endpoint if legacy customer profile requires it
          const fallbackUrl = buildApiUrl({
            baseUrl: this.baseUrl,
            useProxy: this.useProxy,
            path: `/api/ver3/customers/${customerId}`,
          });
          devWarn('[Step 6] Customer profile not found on /api/customers. Retrying:', fallbackUrl);
          const data = await requestJson({ url: fallbackUrl, headers });
          devLog('[Step 6] Get customer response (ver3):', data);
          return data;
        }
        throw error;
      }
    } catch (error) {
      console.error('[Step 6] Get customer error:', error);
      throw error;
    }
  }

  // Step 6: Update customer
  async updateCustomer(customerId, customerData) {
    try {
      // Always include the active business unit
      if (!customerData.businessUnit && state.selectedBusinessUnit) {
        customerData.businessUnit = state.selectedBusinessUnit;
      }
      
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/customers/${customerId}`;
      } else {
        url = `${this.baseUrl}/api/customers/${customerId}`;
      }
      
      console.log('[Step 6] Updating customer:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(customerData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 6] Update customer error (${response.status}):`, errorText);
        throw new Error(`Update customer failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Step 6] Update customer response:', data);
      return data;
    } catch (error) {
      console.error('[Step 6] Update customer error:', error);
      throw error;
    }
  }

  // Step 6: Link guardian/child relationship
  async linkOtherUser(customerId, otherUserId, role = 'PAYER') {
    try {
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/customers/${customerId}/otheruser`;
      } else {
        url = `${this.baseUrl}/api/customers/${customerId}/otheruser`;
      }
      
      console.log('[Step 6] Linking other user:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ otherUserId, role }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 6] Link other user error (${response.status}):`, errorText);
        throw new Error(`Link other user failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Step 6] Link other user response:', data);
      return data;
    } catch (error) {
      console.error('[Step 6] Link other user error:', error);
      throw error;
    }
  }
}

// Step 6: Token Management Functions
// Expose token utilities globally for AuthAPI to use
// These implement saveTokens, getAccessToken, clearTokens as per guide requirements
(function() {
  const TOKEN_STORAGE_KEY = 'boulders_auth_tokens';
  const LOGIN_SESSION_COOKIE = 'boulders_login_session';
  let tokenStore = null; // Memory-first storage

  const getCookieData = () => readLoginSessionCookie(LOGIN_SESSION_COOKIE);
  const persistCookie = (tokenData) => writeLoginSessionCookie(LOGIN_SESSION_COOKIE, tokenData);
  const clearCookie = () => clearLoginSessionCookie(LOGIN_SESSION_COOKIE);
  const loadCookieTokens = () => {
    const cookieData = getCookieData();
    if (cookieData) {
      tokenStore = cookieData;
    }
    return cookieData;
  };

  // Load tokens from sessionStorage on init
  try {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      tokenStore = JSON.parse(stored);
    }
  } catch (error) {
    console.warn('[Step 6] Could not load tokens from sessionStorage:', error);
  }

  if (!tokenStore) {
    const cookieData = hydrateFromCookie(LOGIN_SESSION_COOKIE);
    if (cookieData) {
      tokenStore = cookieData;
    }
  }

  // Step 6: saveTokens - Persist tokens in session store and cookie
  window.saveTokens = function(accessToken, refreshToken, expiresAt, metadata = {}) {
    const tokenData = { accessToken, refreshToken, expiresAt, metadata };
    tokenStore = tokenData;
    
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenData));
    } catch (error) {
      console.warn('[Step 6] Could not save tokens to sessionStorage:', error);
    }

    persistCookie(tokenData);
    
    // Update header auth indicator when tokens are saved
    // Use setTimeout to ensure DOM is ready (in case this is called during page load)
    setTimeout(() => {
      refreshHeaderAuthIndicator();
    }, 0);
    
    // Dispatch event to notify React components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-state-changed'));
    }
  };

  // Step 6: getAccessToken - Get access token from session store/cookie
  window.getAccessToken = function() {
    if (tokenStore?.accessToken) {
      return tokenStore.accessToken;
    }
    
    try {
      const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        tokenStore = JSON.parse(stored);
        if (tokenStore?.accessToken) {
          return tokenStore.accessToken;
        }
      }
    } catch (error) {
      console.warn('[Step 6] Could not read tokens from sessionStorage:', error);
    }

    const cookieTokens = loadCookieTokens();
    return cookieTokens?.accessToken || null;
  };

  // getRefreshToken - Get refresh token from session store/cookie
  window.getRefreshToken = function() {
    if (tokenStore?.refreshToken) {
      return tokenStore.refreshToken;
    }
    
    try {
      const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        tokenStore = JSON.parse(stored);
        if (tokenStore?.refreshToken) {
          return tokenStore.refreshToken;
        }
      }
    } catch (error) {
      console.warn('[Step 6] Could not read tokens from sessionStorage:', error);
    }
    
    const cookieTokens = loadCookieTokens();
    return cookieTokens?.refreshToken || null;
  };

  window.getTokenMetadata = function() {
    if (tokenStore?.metadata) {
      return tokenStore.metadata;
    }

    try {
      const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        tokenStore = JSON.parse(stored);
        if (tokenStore?.metadata) {
          return tokenStore.metadata;
        }
      }
    } catch (error) {
      console.warn('[Step 6] Could not read token metadata from sessionStorage:', error);
    }

    const cookieTokens = loadCookieTokens();
    return cookieTokens?.metadata || null;
  };

  // Step 6: clearTokens - Clear session and return to auth step
  window.clearTokens = function() {
    tokenStore = null;
    
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.warn('[Step 6] Could not clear tokens from sessionStorage:', error);
    }

    clearCookie();
    
    // Update header auth indicator when tokens are cleared
    refreshHeaderAuthIndicator();
    
    // Dispatch event to notify React components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-state-changed'));
    }
  };

  // Check if token is expired
  window.isTokenExpired = function() {
    const activeStore = tokenStore ?? getCookieData();
    if (!activeStore?.expiresAt) {
      return false;
    }
    const buffer = 5 * 60 * 1000; // 5 minute buffer
    return Date.now() >= (activeStore.expiresAt - buffer);
  };
})();

// Step 7: Order and Items API
// Handles order creation, adding items (subscriptions, value cards, articles), and order management
class OrderAPI {
  constructor(baseUrl = null) {
    const config = getApiConfig({ baseUrlOverride: baseUrl });
    this.baseUrl = config.baseUrl;
    this.useProxy = config.useProxy;
    this.isDevelopment = config.isDevelopment;
  }

  // Step 7: Create order - POST /api/orders
  async createOrder(orderData) {
    try {
      // Always include the active business unit
      if (!orderData.businessUnit && state.selectedBusinessUnit) {
        orderData.businessUnit = state.selectedBusinessUnit;
      }

      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: '/api/orders',
      });
      
      console.log('[Step 7] Creating order:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      let data;
      try {
        data = await requestJson({ url, method: 'POST', headers, body: orderData });
      } catch (error) {
        const payloadText = typeof error.payload === 'string'
          ? error.payload
          : JSON.stringify(error.payload);
        console.error(`[Step 7] Create order error (${error.status || 'unknown'}):`, payloadText || error);
        throw new Error(`Create order failed: ${error.status || 'unknown'} - ${payloadText || error.message}`);
      }
      console.log('[Step 7] Create order response:', data);

      const createdOrderId = data?.id ?? data?.orderId ?? data?.data?.id ?? data?.data?.orderId;
      if (createdOrderId) {
        console.log('[Step 7] Created order ID:', createdOrderId);
      } else {
        console.warn('[Step 7] Create order response did not include an order ID field');
      }
      return data;
    } catch (error) {
      console.error('[Step 7] Create order error:', error);
      throw error;
    }
  }

  // Step 7: Add subscription item (membership) - POST /api/ver3/orders/{orderId}/items/subscriptions
  // API Documentation: https://boulders.brpsystems.com/brponline/external/documentation/api3
  async addSubscriptionItem(orderId, productId) {
    try {
      const url = this.useProxy
        ? buildApiUrl({
            baseUrl: this.baseUrl,
            useProxy: this.useProxy,
            path: `/api/ver3/orders/${orderId}/items/subscriptions`,
          })
        : `https://boulders.brpsystems.com/apiserver/api/ver3/orders/${orderId}/items/subscriptions`;
      
      console.log('[Step 7] Adding subscription item:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      // API expects subscriptionProduct field, not productId
      // Extract numeric ID if productId is in format "membership-134" -> 134
      let subscriptionProductId = productId;
      if (typeof productId === 'string' && productId.includes('-')) {
        // Extract numeric part from "membership-134" -> 134
        const numericPart = productId.split('-').pop();
        subscriptionProductId = parseInt(numericPart, 10);
        if (isNaN(subscriptionProductId)) {
          throw new Error(`Invalid product ID format: ${productId}. Expected format: "membership-{number}" or numeric ID.`);
        }
      } else if (typeof productId === 'string') {
        // Try to parse if it's a string number
        subscriptionProductId = parseInt(productId, 10);
        if (isNaN(subscriptionProductId)) {
          subscriptionProductId = productId; // Fallback to original if not numeric
        }
      }
      
      if (!subscriptionProductId) {
        throw new Error(`Missing or invalid subscription product ID: ${productId}`);
      }
      
      const subscriberId = state.customerId ? Number(state.customerId) : null;
      const birthDate = getSubscriberBirthDate();
      
      // Set start date to today so membership starts immediately
      // Format: YYYY-MM-DD (ISO date format)
      const todayDate = new Date();
      const startDate = todayDate.toISOString().split('T')[0]; // e.g., "2026-01-05"
      
      // CRITICAL BACKEND BUG: Backend ignores startDate parameter for productId 134 ("Medlemskab")
      // but accepts it for productId 56 ("Junior") and productId 135 ("Student").
      // This causes backend to set initialPaymentPeriod.start to future date (next month)
      // for productId 134, preventing partial-month pricing calculation.
      // This is a backend issue that needs to be fixed on backend side.
      // Workaround: Frontend calculates partial-month pricing client-side for display,
      // but payment window will still show full monthly price because backend uses its own calculation.
      
      // Build payload according to OpenAPI spec:
      // Required: subscriptionProduct, birthDate
      // Optional: startDate, subscriber, externalMessage, additionTo, recruitedBy, paymentOption
      // Note: businessUnit is not in spec - may be inferred from order context
      const payload = {
        subscriptionProduct: subscriptionProductId,
        startDate: startDate, // Set membership to start today (ISO format: YYYY-MM-DD)
        ...(subscriberId ? { subscriber: subscriberId } : {}),
        ...(birthDate ? { birthDate } : {}),
        // businessUnit is not in OpenAPI spec - backend may infer from order
        // ...(state.selectedBusinessUnit ? { businessUnit: state.selectedBusinessUnit } : {}),
      };
      
      // Log warning if this is productId 134 (known backend bug)
      if (subscriptionProductId === 134) {
        console.warn('[Step 7] ⚠️ BACKEND BUG: Adding subscription for productId 134 ("Medlemskab")');
        console.warn('[Step 7] ⚠️ Backend will ignore startDate parameter and set start date to future');
        console.warn('[Step 7] ⚠️ This prevents partial-month pricing calculation on backend');
        console.warn('[Step 7] ⚠️ Frontend will calculate partial-month pricing client-side for display');
        console.warn('[Step 7] ⚠️ But payment window will show full monthly price (backend bug)');
        console.warn('[Step 7] ⚠️ This is a backend issue - backend should accept startDate for all products');
      }
      
      console.log('[Step 7] Adding subscription item - productId:', productId);
      console.log('[Step 7] Extracted subscriptionProductId:', subscriptionProductId);
      console.log('[Step 7] Subscription item payload:', JSON.stringify(payload, null, 2));
      
      // CRITICAL: Log payload details for debugging why backend ignores startDate for productId 134
      console.log('[Step 7] 🔍 Payload analysis:', {
        subscriptionProductId,
        productId,
        startDate,
        hasSubscriber: !!subscriberId,
        subscriberId,
        hasBirthDate: !!birthDate,
        birthDate,
        businessUnit: state.selectedBusinessUnit,
        payloadKeys: Object.keys(payload),
        payloadStartDate: payload.startDate,
        payloadStart: payload.start
      });
      
      
      let data;
      try {
        data = await requestJson({ url, method: 'POST', headers, body: payload });
      } catch (error) {
        const errorPayload = error?.payload;
        let errorData = errorPayload;
        if (typeof errorPayload === 'string') {
          try {
            errorData = JSON.parse(errorPayload);
          } catch (e) {
            errorData = null;
          }
        }
        const errorCode = errorData?.errorCode || errorData?.code;
        if (errorCode === 'PRODUCT_NOT_ALLOWED') {
          const blockedProductId = errorData?.id || subscriptionProductId;
          console.warn(`[Step 7] ⚠️ Product ${blockedProductId} is not allowed for this customer (campaign eligibility restriction)`);
          
          // Create a custom error that can be identified in catch blocks
          const restrictionError = new Error('PRODUCT_NOT_ALLOWED: This offer is not available for your account due to campaign restrictions.');
          restrictionError.isProductNotAllowed = true;
          restrictionError.productId = blockedProductId;
          restrictionError.originalError = errorPayload;
          throw restrictionError;
        }

        const payloadText = typeof errorPayload === 'string'
          ? errorPayload
          : JSON.stringify(errorPayload);
        console.error(`[Step 7] Add subscription item error (${error.status || 'unknown'}):`, payloadText || error);
        throw new Error(`Add subscription item failed: ${error.status || 'unknown'} - ${payloadText || error.message}`);
      }
      console.log('[Step 7] Add subscription item response:', data);
      
      // CRITICAL: Check if backend accepted startDate
      const subscriptionItem = data?.subscriptionItems?.[0];
      const responseStartDate = subscriptionItem?.initialPaymentPeriod?.start;
      const responseOrderPrice = data?.price?.amount;
      
      // Check if backend start date is more than 1 day in the future (backend ignored our startDate)
      const backendStartDateObj = responseStartDate ? new Date(responseStartDate) : null;
      const checkToday = new Date();
      checkToday.setHours(0, 0, 0, 0);
      const daysUntilStart = backendStartDateObj ? Math.ceil((backendStartDateObj - checkToday) / (1000 * 60 * 60 * 24)) : 0;
      const startDateIgnored = daysUntilStart > 1;
      
      console.log('[Step 7] 🔍 Response analysis:', {
        productId,
        subscriptionProductId,
        sentStartDate: startDate,
        responseStartDate,
        daysUntilStart,
        startDateIgnored,
        orderPrice: responseOrderPrice,
        orderPriceDKK: responseOrderPrice ? responseOrderPrice / 100 : null,
        hasInitialPaymentPeriod: !!subscriptionItem?.initialPaymentPeriod,
        initialPaymentPeriod: subscriptionItem?.initialPaymentPeriod
      });
      
      // CRITICAL: If backend ignored startDate, attempt to fix with multiple strategies
      // Only attempt when price mismatch is significant (avoid churn on rounding diffs)
      if (startDateIgnored && subscriptionItem?.id) {
        const expectedPrice = this._calculateExpectedPartialMonthPrice(subscriptionProductId, startDate);
        const orderPriceInCents = typeof responseOrderPrice === 'object'
          ? responseOrderPrice.amount
          : responseOrderPrice;
        const priceDifference = expectedPrice && Number.isFinite(orderPriceInCents)
          ? Math.abs(orderPriceInCents - expectedPrice.amountInCents)
          : null;

        if (priceDifference !== null && priceDifference <= 100) {
          console.warn('[Step 7] ⚠️ Backend ignored startDate but price difference is within rounding tolerance:', priceDifference, 'cents');
          return data;
        }

        console.warn('[Step 7] ⚠️ Backend ignored startDate - start date is', daysUntilStart, 'days in future');
        console.warn('[Step 7] ⚠️ Product ID:', subscriptionProductId);
        console.warn('[Step 7] ⚠️ Attempting to fix with multiple strategies...');

        // Try multiple strategies to fix backend pricing
        const fixedData = await this._fixBackendPricingBug(
          orderId,
          url,
          headers,
          subscriptionItem.id,
          payload,
          subscriptionProductId,
          expectedPrice,
          accessToken,
          checkToday
        );
        
        if (fixedData) {
          return fixedData;
        }
        
        // If all strategies failed, log detailed error
        console.error('[Step 7] ❌ All strategies failed to fix backend pricing bug for productId:', subscriptionProductId);
        console.error('[Step 7] ❌ Payment window will show incorrect price');
        console.error('[Step 7] ❌ Cart summary will calculate and show correct price');
      }
      
      return data;
    } catch (error) {
      console.error('[Step 7] Add subscription item error:', error);
      throw error;
    }
  }

  /**
   * Calculates the expected partial-month price for a subscription starting today.
   * Used to verify backend pricing is correct.
   * 
   * @param {number} productId - The subscription product ID
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @returns {Object|null} Expected price info { amountInCents, amountInDKK, daysRemaining, daysInMonth } or null
   */
  _calculateExpectedPartialMonthPrice(productId, startDate) {
    // Check all subscription types: campaign, membership, and 15 Day Pass
    const allSubscriptions = [
      ...(state.campaignSubscriptions || []),
      ...(state.subscriptions || []),
      ...(state.dayPassSubscriptions || [])
    ];
    const membership = allSubscriptions.find(p => 
      p.id === productId || 
      p.id === Number(productId) ||
      String(p.id) === String(productId)
    );
    
    if (!membership?.priceWithInterval?.price?.amount) {
      console.warn('[Step 7] Cannot calculate expected price - product not found:', productId);
      return null;
    }
    
    const monthlyPriceInCents = membership.priceWithInterval.price.amount;
    const startDateObj = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate days remaining in current month
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInCurrentMonth = lastDayOfMonth.getDate();
    const dayOfMonth = today.getDate();
    const daysRemainingInMonth = daysInCurrentMonth - dayOfMonth + 1;
    
    // Calculate prorated price
    const proratedPriceInCents = Math.round((monthlyPriceInCents * daysRemainingInMonth) / daysInCurrentMonth);
    
    return {
      amountInCents: proratedPriceInCents,
      amountInDKK: proratedPriceInCents / 100,
      daysRemaining: daysRemainingInMonth,
      daysInMonth: daysInCurrentMonth,
      monthlyPriceInCents,
      monthlyPriceInDKK: monthlyPriceInCents / 100
    };
  }

  /**
   * Attempts multiple strategies to fix backend pricing bug when startDate is ignored.
   * 
   * @param {string|number} orderId - Order ID
   * @param {string} url - API endpoint URL
   * @param {Object} headers - Request headers
   * @param {number} subscriptionItemId - Subscription item ID to delete
   * @param {Object} basePayload - Base payload object
   * @param {number} productId - Subscription product ID
   * @param {Object|null} expectedPrice - Expected price info
   * @param {string|null} accessToken - Access token
   * @param {Date} today - Today's date (normalized)
   * @returns {Promise<Object|null>} Fixed order data or null if all strategies failed
   */
  async _fixBackendPricingBug(orderId, url, headers, subscriptionItemId, basePayload, productId, expectedPrice, accessToken, today) {
    // Strategy 1: Delete and re-add with same payload (sometimes backend needs fresh start)
    console.log('[Step 7] Strategy 1: Delete and re-add with same payload');
    const strategy1Result = await this._tryStrategyDeleteAndReadd(
      orderId, url, headers, subscriptionItemId, basePayload, productId, expectedPrice, accessToken, today
    );
    if (strategy1Result) return strategy1Result;
    
    // Strategy 2: Try with explicit date format
    console.log('[Step 7] Strategy 2: Try with explicit date format');
    const todayExplicit = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (todayExplicit !== basePayload.startDate) {
      const payloadVariant = { ...basePayload, startDate: todayExplicit };
      const strategy2Result = await this._tryStrategyDeleteAndReadd(
        orderId, url, headers, subscriptionItemId, payloadVariant, productId, expectedPrice, accessToken, today
      );
      if (strategy2Result) return strategy2Result;
    }
    
    // Strategy 3: Try minimal payload (only required fields)
    console.log('[Step 7] Strategy 3: Try minimal payload');
    const minimalPayload = {
      subscriptionProduct: basePayload.subscriptionProduct,
      startDate: basePayload.startDate,
      ...(basePayload.birthDate ? { birthDate: basePayload.birthDate } : {}),
    };
    const strategy3Result = await this._tryStrategyDeleteAndReadd(
      orderId, url, headers, subscriptionItemId, minimalPayload, productId, expectedPrice, accessToken, today
    );
    if (strategy3Result) return strategy3Result;
    
    // Strategy 4: Try with longer wait time (backend might need more time to process)
    console.log('[Step 7] Strategy 4: Try with longer wait time');
    const strategy4Result = await this._tryStrategyDeleteAndReadd(
      orderId, url, headers, subscriptionItemId, basePayload, productId, expectedPrice, accessToken, today, 2000
    );
    if (strategy4Result) return strategy4Result;
    
    return null; // All strategies failed
  }

  /**
   * Tries a strategy: delete subscription item and re-add with given payload.
   * 
   * @param {string|number} orderId - Order ID
   * @param {string} url - API endpoint URL
   * @param {Object} headers - Request headers
   * @param {number} subscriptionItemId - Subscription item ID to delete
   * @param {Object} payload - Payload to use when re-adding
   * @param {number} productId - Subscription product ID
   * @param {Object|null} expectedPrice - Expected price info
   * @param {string|null} accessToken - Access token
   * @param {Date} today - Today's date (normalized)
   * @param {number} waitTime - Wait time in ms before re-adding (default 1000)
   * @returns {Promise<Object|null>} Fixed order data or null if strategy failed
   */
  async _tryStrategyDeleteAndReadd(orderId, url, headers, subscriptionItemId, payload, productId, expectedPrice, accessToken, today, waitTime = 1000) {
    try {
      // Delete subscription item
      const deleteUrl = this.useProxy
        ? buildApiUrl({
            baseUrl: this.baseUrl,
            useProxy: this.useProxy,
            path: `/api/ver3/orders/${orderId}/items/subscriptions/${subscriptionItemId}`,
          })
        : `https://boulders.brpsystems.com/apiserver/api/ver3/orders/${orderId}/items/subscriptions/${subscriptionItemId}`;

      try {
        await requestJson({
          url: deleteUrl,
          method: 'DELETE',
          headers: {
            ...headers,
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          expectJson: false,
        });
      } catch (error) {
        if (error.status === 403) {
          console.log('[Step 7] Cannot delete subscription item (403 Forbidden) - order may be in a state that prevents modification');
          return null; // Skip this strategy - we don't have permission
        }
        const payloadText = typeof error.payload === 'string'
          ? error.payload
          : JSON.stringify(error.payload);
        console.warn('[Step 7] Failed to delete subscription item:', error.status || 'unknown', payloadText || error);
        return null; // Can't delete, skip this strategy
      }
      
      // Wait for backend to process deletion
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Re-add subscription
      let retryData;
      try {
        retryData = await requestJson({ url, method: 'POST', headers, body: payload });
      } catch (error) {
        return null; // Re-add failed, skip this strategy
      }
      
      // Verify pricing is correct
      const verification = this._verifySubscriptionPricing(retryData, productId, expectedPrice, today);
      
      if (verification.isCorrect) {
        console.log('[Step 7] ✅ Strategy succeeded - pricing is correct');
        return retryData;
      }
      
      return null; // Pricing still incorrect
    } catch (error) {
      console.error('[Step 7] Strategy error:', error);
      return null;
    }
  }

  /**
   * Verifies that subscription pricing is correct.
   * 
   * @param {Object} orderData - Order data from API response
   * @param {number} productId - Subscription product ID
   * @param {Object|null} expectedPrice - Expected price info
   * @param {Date} today - Today's date (normalized to midnight)
   * @returns {Object} Verification result { isCorrect, startDateCorrect, priceCorrect, details }
   */
  _verifySubscriptionPricing(orderData, productId, expectedPrice, today) {
    const subscriptionItem = orderData?.subscriptionItems?.[0];
    const initialPaymentPeriod = subscriptionItem?.initialPaymentPeriod;
    const orderPriceAmount = orderData?.price?.amount || 0;
    const orderPriceInCents = typeof orderPriceAmount === 'object' ? orderPriceAmount.amount : orderPriceAmount;
    
    // Check if start date is correct (should be today or tomorrow at most)
    let daysUntilStart = 0;
    if (initialPaymentPeriod?.start) {
      const backendStartDate = new Date(initialPaymentPeriod.start);
      daysUntilStart = Math.ceil((backendStartDate - today) / (1000 * 60 * 60 * 24));
    }
    
    const startDateCorrect = daysUntilStart <= 1;
    
    // Check if price is correct
    let priceCorrect = false;
    const priceDifference = expectedPrice
      ? Math.abs(orderPriceInCents - expectedPrice.amountInCents)
      : null;
    if (expectedPrice) {
      // Allow up to 1 DKK difference to account for backend rounding
      priceCorrect = priceDifference <= 100;
    }
    
    const isCorrect = startDateCorrect && priceCorrect;
    
    return {
      isCorrect,
      startDateCorrect,
      priceCorrect,
      daysUntilStart,
      priceDifference,
      orderPriceInCents,
      orderPriceDKK: orderPriceInCents / 100,
      expectedPriceInCents: expectedPrice?.amountInCents || null,
      expectedPriceDKK: expectedPrice?.amountInDKK || null,
      details: {
        initialPaymentPeriod,
        recurringPrice: subscriptionItem?.payRecurring?.price?.amount || 0,
        productId
      }
    };
  }

  // Step 7: Add value card item (punch card) - POST /api/ver3/orders/{orderId}/items/valuecards
  // API Documentation: https://boulders.brpsystems.com/brponline/external/documentation/api3
  async addValueCardItem(orderId, productId, quantity = 1) {
    try {
      const url = this.useProxy
        ? buildApiUrl({
            baseUrl: this.baseUrl,
            useProxy: this.useProxy,
            path: `/api/ver3/orders/${orderId}/items/valuecards`,
          })
        : `https://boulders.brpsystems.com/apiserver/api/ver3/orders/${orderId}/items/valuecards`;
      
      console.log('[Step 7] Adding value card item:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      // API Documentation requires 'valueCardProduct' field (integer, required)
      // Optional fields: receiverDetails, senderDetails, amount, externalMessage, additionTo
      // Note: quantity is handled by repeating the request or backend logic, not in payload
      const payload = {
        valueCardProduct: productId, // Required: Value card product ID (integer)
        // quantity is not in API spec - backend may handle it differently
        // businessUnit is not in API spec - may be inferred from order context
      };
      
      console.log('[Step 7] Value card payload:', JSON.stringify(payload, null, 2));
      
      let data;
      try {
        data = await requestJson({ url, method: 'POST', headers, body: payload });
      } catch (error) {
        const payloadText = typeof error.payload === 'string'
          ? error.payload
          : JSON.stringify(error.payload);
        console.error(`[Step 7] Add value card item error (${error.status || 'unknown'}):`, payloadText || error);
        throw new Error(`Add value card item failed: ${error.status || 'unknown'} - ${payloadText || error.message}`);
      }
      console.log('[Step 7] Add value card item response:', data);
      return data;
    } catch (error) {
      console.error('[Step 7] Add value card item error:', error);
      throw error;
    }
  }

  // Step 7: Add article item (add-ons/extras) - POST /api/orders/{orderId}/items/articles
  async addArticleItem(orderId, productId) {
    try {
      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: `/api/orders/${orderId}/items/articles`,
      });
      
      console.log('[Step 7] Adding article item:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      const payload = {
        productId,
        businessUnit: state.selectedBusinessUnit, // Always include active business unit
      };
      
      let data;
      try {
        data = await requestJson({ url, method: 'POST', headers, body: payload });
      } catch (error) {
        const payloadText = typeof error.payload === 'string'
          ? error.payload
          : JSON.stringify(error.payload);
        console.error(`[Step 7] Add article item error (${error.status || 'unknown'}):`, payloadText || error);
        throw new Error(`Add article item failed: ${error.status || 'unknown'} - ${payloadText || error.message}`);
      }
      console.log('[Step 7] Add article item response:', data);
      return data;
    } catch (error) {
      console.error('[Step 7] Add article item error:', error);
      throw error;
    }
  }

  // Step 7: Get order - GET /api/orders/{orderId}
  async getOrder(orderId) {
    try {
      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: `/api/orders/${orderId}`,
      });
      
      console.log('[Step 7] Getting order:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      let data;
      try {
        data = await requestJson({ url, headers });
      } catch (error) {
        const payloadText = typeof error.payload === 'string'
          ? error.payload
          : JSON.stringify(error.payload);
        console.error(`[Step 7] Get order error (${error.status || 'unknown'}):`, payloadText || error);
        const wrapped = new Error(`Get order failed: ${error.status || 'unknown'} - ${payloadText || error.message}`);
        wrapped.status = error.status;
        throw wrapped;
      }
      console.log('[Step 7] Get order response:', data);
      return data;
    } catch (error) {
      console.error('[Step 7] Get order error:', error);
      throw error;
    }
  }

  // Step 7: Update order - PUT /api/orders/{orderId}
  async updateOrder(orderId, orderData) {
    try {
      // Always include the active business unit
      if (!orderData.businessUnit && state.selectedBusinessUnit) {
        orderData.businessUnit = state.selectedBusinessUnit;
      }

      const url = buildApiUrl({
        baseUrl: this.baseUrl,
        useProxy: this.useProxy,
        path: `/api/orders/${orderId}`,
      });
      
      console.log('[Step 7] Updating order:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      let data;
      try {
        data = await requestJson({ url, method: 'PUT', headers, body: orderData });
      } catch (error) {
        const payloadText = typeof error.payload === 'string'
          ? error.payload
          : JSON.stringify(error.payload);
        console.error(`[Step 7] Update order error (${error.status || 'unknown'}):`, payloadText || error);
        throw new Error(`Update order failed: ${error.status || 'unknown'} - ${payloadText || error.message}`);
      }
      console.log('[Step 7] Update order response:', data);
      return data;
    } catch (error) {
      console.error('[Step 7] Update order error:', error);
      throw error;
    }
  }

  // Apply coupon to order - POST /api/ver3/orders/{order}/coupons
  // Note: API returns 405 for PUT, using POST instead
  // Documentation: https://boulders.brpsystems.com/brponline/external/documentation/api3
  async applyDiscountCode(orderId, discountCode) {
    try {
      // ver3 endpoints use different base URL (boulders.brpsystems.com/apiserver)
      const url = this.useProxy
        ? buildApiUrl({
            baseUrl: this.baseUrl,
            useProxy: this.useProxy,
            path: `/api/ver3/orders/${orderId}/coupons`,
          })
        : `https://boulders.brpsystems.com/apiserver/api/ver3/orders/${orderId}/coupons`;
      
      console.log('[Discount] Applying coupon:', discountCode, 'to order:', orderId);
      console.log('[Discount] Endpoint:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      // API expects couponName field (not code)
      const payload = {
        couponName: discountCode,
      };
      
      console.log('[Discount] Request payload:', JSON.stringify(payload, null, 2));
      
      let data;
      try {
        data = await requestJson({ url, method: 'POST', headers, body: payload });
      } catch (error) {
        if (error.status === 405 || error.status === 404) {
          console.log('[Discount] POST returned', error.status, '- trying alternative endpoint...');
          const altUrl = this.useProxy
            ? buildApiUrl({
                baseUrl: this.baseUrl,
                useProxy: this.useProxy,
                path: `/api/orders/${orderId}/coupon`,
              })
            : `${this.baseUrl}/api/orders/${orderId}/coupon`;
          console.log('[Discount] Trying alternative endpoint:', altUrl);
          try {
            data = await requestJson({ url: altUrl, method: 'POST', headers, body: payload });
          } catch (altError) {
            const payloadText = typeof altError.payload === 'string'
              ? altError.payload
              : JSON.stringify(altError.payload);
            console.error(`[Discount] Apply coupon error (${altError.status || 'unknown'}):`, payloadText || altError);
            throw new Error(`Apply coupon failed: ${altError.status || 'unknown'} - ${payloadText || altError.message}`);
          }
        } else {
          const payloadText = typeof error.payload === 'string'
            ? error.payload
            : JSON.stringify(error.payload);
          console.error(`[Discount] Apply coupon error (${error.status || 'unknown'}):`, payloadText || error);
          throw new Error(`Apply coupon failed: ${error.status || 'unknown'} - ${payloadText || error.message}`);
        }
      }
      console.log('[Discount] Apply coupon response:', data);
      
      // Extract couponDiscount from response
      // Response is an Order object with couponDiscount field
      const couponDiscount = data?.couponDiscount || data?.price?.couponDiscount || null;
      let discountAmount = 0;
      
      console.log('[Discount] Full API response structure:', {
        hasCouponDiscount: !!data?.couponDiscount,
        hasPriceCouponDiscount: !!data?.price?.couponDiscount,
        couponDiscountType: typeof couponDiscount,
        couponDiscountValue: couponDiscount,
        priceObject: data?.price ? Object.keys(data.price) : null,
        orderTotal: data?.price?.total,
        orderLeftToPay: data?.price?.leftToPay,
      });
      
      if (couponDiscount) {
        console.log('[Discount] Raw coupon discount:', couponDiscount);
        
        if (typeof couponDiscount === 'object') {
          // Try different possible fields - avoid 'total' as it might be order total, not discount
          discountAmount = couponDiscount.amount || couponDiscount.value || couponDiscount.discount || 0;
          
          // If amount is in cents (common in APIs), convert to DKK
          if (discountAmount > 10000) {
            console.log('[Discount] Large amount detected, might be in cents:', discountAmount);
            discountAmount = discountAmount / 100;
            console.log('[Discount] Converted from cents:', discountAmount);
          }
          // Round to half krone
          discountAmount = roundToHalfKrone(discountAmount);
        } else if (typeof couponDiscount === 'number') {
          discountAmount = couponDiscount;
          
          // If amount is in cents, convert to DKK
          if (discountAmount > 10000) {
            console.log('[Discount] Large number detected, might be in cents:', discountAmount);
            discountAmount = discountAmount / 100;
            console.log('[Discount] Converted from cents:', discountAmount);
          }
          // Round to half krone
          discountAmount = roundToHalfKrone(discountAmount);
        }
      }
      
      // Fallback: Calculate discount from price difference if couponDiscount extraction failed
      if (!discountAmount || discountAmount === 0) {
        console.log('[Discount] Attempting to calculate discount from price difference...');
        const orderPrice = data?.price;
        if (orderPrice) {
          // Get subtotal from current state
          const subtotal = state.totals.subtotal || state.totals.cartTotal || 0;
          const newTotal = orderPrice.total || orderPrice.leftToPay || 0;
          
          // Convert to DKK if in cents
          const newTotalDKK = newTotal > 10000 ? newTotal / 100 : newTotal;
          
          if (newTotalDKK < subtotal && subtotal > 0) {
            discountAmount = roundToHalfKrone(subtotal - newTotalDKK);
            console.log('[Discount] Calculated from price difference:', discountAmount, '(subtotal:', subtotal, 'new total:', newTotalDKK, ')');
          }
        }
      }
      
      console.log('[Discount] Final extracted discountAmount:', discountAmount);
      
      return {
        ...data,
        discountAmount: discountAmount,
      };
    } catch (error) {
      console.error('[Discount] Apply coupon error:', error);
      throw error;
    }
  }
}

// Step 9: Payment API
// Handles payment link generation for checkout
class PaymentAPI {
  constructor(baseUrl = null) {
    const config = getApiConfig({ baseUrlOverride: baseUrl });
    this.baseUrl = config.baseUrl;
    this.useProxy = config.useProxy;
    this.isDevelopment = config.isDevelopment;
    
    // Correct endpoint: /api/payment/generate-link
    // Base URL: https://api-join.boulders.dk
    // Documentation: https://documenter.getpostman.com/view/6552350/2sB3Wtsz3V#75d4fd2c-d336-43a3-a48f-5808f04290ad
    this.paymentEndpoint = '/api/payment/generate-link';
  }

  // Step 9: Generate payment link - POST /api/payment/generate-link
  // Endpoint: https://api-join.boulders.dk/api/payment/generate-link
  // Documentation: https://documenter.getpostman.com/view/6552350/2sB3Wtsz3V#75d4fd2c-d336-43a3-a48f-5808f04290ad
  // Create checkout URLs after an order is ready
  // Pass the order ID, payment method, selected business unit, return URL, and optional receipt email
  async generatePaymentLink({ orderId, paymentMethod, businessUnit, returnUrl = null, receiptEmail = null }) {
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      // Build return URL if not provided
      if (!returnUrl && orderId) {
        const path = window.location.pathname || '/';
        const baseUrl = getReturnUrlBase();
        returnUrl = `${baseUrl}${path}?payment=return&orderId=${orderId}`;
      }
      
      if (!returnUrl) {
        throw new Error('Return URL is required for payment link generation');
      }
      
      if (!orderId) {
        throw new Error('Order ID is required for payment link generation');
      }
      
      const url = this.useProxy
        ? buildApiUrl({
            baseUrl: this.baseUrl,
            useProxy: this.useProxy,
            path: this.paymentEndpoint,
          })
        : `https://api-join.boulders.dk${this.paymentEndpoint}`;
      
      console.log('[Step 9] ===== GENERATE PAYMENT LINK CARD REQUEST =====');
      console.log('[Step 9] Endpoint:', url);
      console.log('[Step 9] Method: POST');
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      console.log('[Step 9] Access token available:', !!accessToken);
      console.log('[Step 9] Access token value:', accessToken ? `${accessToken.substring(0, 20)}...` : 'null');
      
      if (!accessToken) {
        console.error('[Step 9] ⚠️ No access token available! Payment link endpoint requires authentication.');
        console.error('[Step 9] Make sure user is logged in or token is stored in session.');
      }
      
      const headers = {
        'Accept-Language': getAcceptLanguageHeader(),
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      console.log('[Step 9] Headers:', headers);
      console.log('[Step 9] Has Authorization header:', !!headers.Authorization);
      
      // Step 9: Payload structure according to Postman documentation
      // Endpoint: POST /api/payment/generate-link
      // Payload: { orderId, paymentMethodId, businessUnit, returnUrl, receiptEmail (optional) }
      // API expects paymentMethodId (numeric ID), not paymentMethod (string)
      // Map payment method string to numeric ID
      let paymentMethodId = paymentMethod;
      if (typeof paymentMethod === 'string') {
        const paymentMethodMap = {
          'card': 32,
          'creditcard': 32,
          'credit_card': 32,
          'debit': 2,
          'mobilepay': 3,
          'mobile_pay': 3,
        };
        paymentMethodId = paymentMethodMap[paymentMethod.toLowerCase()] || 32;
        console.log('[Step 9] Mapped payment method:', paymentMethod, '->', paymentMethodId);
      }
      
      const businessUnitId = typeof businessUnit === 'string' ? parseInt(businessUnit, 10) || businessUnit : businessUnit;

      const resolvedReceiptEmailRaw = receiptEmail
        || state?.authenticatedEmail
        || state?.forms?.customer?.email
        || getTokenMetadata()?.email
        || null;
      const resolvedReceiptEmail = resolvedReceiptEmailRaw
        ? stripEmailPlusTag(resolvedReceiptEmailRaw)
        : null;

      const payload = {
        orderId, // Required: ID of the order
        paymentMethodId, // Required: Payment method ID (numeric)
        returnUrl, // Required: Absolute URL to return to after payment
        ...(resolvedReceiptEmail ? { receiptEmail: resolvedReceiptEmail } : {}),
        ...(businessUnitId ? { businessUnit: businessUnitId } : {}),
      };
      
      console.log('[Step 9] Payment method (raw):', paymentMethod);
      console.log('[Step 9] Payment method ID (mapped):', paymentMethodId);
      
      console.log('[Step 9] Request payload:', JSON.stringify(payload, null, 2));
      console.log('[Step 9] Sending Generate Payment Link Card request...');
      
      let data;
      try {
        data = await requestJson({ url, method: 'POST', headers, body: payload });
      } catch (error) {
        const payloadText = typeof error.payload === 'string'
          ? error.payload
          : JSON.stringify(error.payload);
        console.error(`[Step 9] ❌ Generate Payment Link Card failed (${error.status || 'unknown'}):`, payloadText || error);
        
        if (error.status === 403) {
          console.error('[Step 9] ⚠️ 403 Forbidden - Possible reasons:');
          console.error('[Step 9] ⚠️ 1. Order may have incorrect pricing (backend bug - startDate ignored)');
          console.error('[Step 9] ⚠️ 2. Order may be in a state that prevents payment link generation');
          console.error('[Step 9] ⚠️ 3. Payment method may not be valid for this order');
          console.error('[Step 9] ⚠️ 4. Business unit may not match order');
          console.error('[Step 9] ⚠️ Order details:', {
            orderId,
            orderPrice: state.fullOrder?.price?.amount,
            orderPriceDKK: state.fullOrder?.price?.amount ? (typeof state.fullOrder.price.amount === 'object' ? state.fullOrder.price.amount.amount / 100 : state.fullOrder.price.amount / 100) : null,
            hasSubscriptionItems: !!state.fullOrder?.subscriptionItems?.length,
            subscriptionItem: state.fullOrder?.subscriptionItems?.[0],
            paymentMethodId,
            businessUnit: businessUnitId
          });
          
          const subscriptionItem = state.fullOrder?.subscriptionItems?.[0];
          if (subscriptionItem) {
            const productId = subscriptionItem?.product?.id;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startDateStr = today.toISOString().split('T')[0];
            const expectedPrice = orderAPI._calculateExpectedPartialMonthPrice(productId, startDateStr);
            const verification = orderAPI._verifySubscriptionPricing(state.fullOrder, productId, expectedPrice, today);
            
            if (!verification.isCorrect && (!verification.priceDifference || verification.priceDifference > 100)) {
              console.error('[Step 9] ❌ CONFIRMED: Order has incorrect pricing due to backend bug!');
              console.error('[Step 9] ❌ Backend shows:', verification.orderPriceDKK, 'DKK');
              console.error('[Step 9] ❌ Should be:', verification.expectedPriceDKK || 'N/A', 'DKK');
              console.error('[Step 9] ❌ This is why payment link generation is failing with 403');
              console.error('[Step 9] ❌ Backend needs to fix startDate handling for productId:', productId);
            }
          }
        }
        
        throw new Error(`Generate Payment Link Card failed: ${error.status || 'unknown'} - ${payloadText || error.message}`);
      }
      console.log('[Step 9] ✅ Generate Payment Link Card response:', JSON.stringify(data, null, 2));
      
      // API Response structure from backend example: { "url": "..." }
      // Response is direct, not nested in data object
      const paymentLink = data.url || 
                         data.data?.url || 
                         data.data?.paymentLink || 
                         data.data?.link ||
                         data.paymentLink || 
                         data.link;
      
      if (!paymentLink) {
        console.error('[Step 9] ❌ No payment link in response!');
        console.error('[Step 9] Response structure:', Object.keys(data));
        if (data.data) {
          console.error('[Step 9] Data object keys:', Object.keys(data.data));
        }
        
        throw new Error('Payment link not found in API response');
      }
      
      // Store in state for UI to use
      if (state) {
        state.paymentLink = paymentLink;
        state.paymentLinkGenerated = true;
      }
      console.log('[Step 9] Payment link extracted from response.url:', paymentLink);
      
      return { ...data, paymentLink: paymentLink, url: paymentLink };
    } catch (error) {
      console.error('[Step 9] Generate payment link error:', error);
      throw error;
    }
  }
}

function getSubscriberBirthDate() {
  try {
    const dateField = document.getElementById('dateOfBirth');
    if (!dateField || !dateField.value) {
      return null;
    }
    const value = dateField.value.trim();
    if (!value) {
      return null;
    }
    // Ensure format YYYY-MM-DD
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return value;
  } catch (error) {
    console.warn('[checkout] Could not read birth date field:', error);
    return null;
  }
}

// Initialize API instances
const businessUnitsAPI = new BusinessUnitsAPI();
const referenceDataAPI = new ReferenceDataAPI();
const authAPI = new AuthAPI();
const orderAPI = new OrderAPI();
const paymentAPI = new PaymentAPI();

// Step 6: Token validation on app reload
// Keep tokens fresh by calling POST /api/auth/validate when app reloads with saved credentials
async function validateTokensOnLoad() {
  const accessToken = window.getAccessToken();
  const refreshToken = window.getRefreshToken();
  
  if (!accessToken) {
    return; // No tokens to validate
  }
  
  const now = Date.now();
  if (now < tokenValidationCooldownUntil) {
    const secondsLeft = Math.ceil((tokenValidationCooldownUntil - now) / 1000);
    console.log(`[Step 6] Skipping token validation (cooldown ${secondsLeft}s remaining)`);
    return;
  }
  
  // Check if token is expired
  if (window.isTokenExpired && window.isTokenExpired()) {
    console.log('[Step 6] Access token expired, attempting refresh...');
    
    // If refresh token exists, try to refresh
    if (refreshToken) {
      try {
        await authAPI.refreshToken();
        console.log('[Step 6] Token refreshed successfully');
        // Header auth indicator will be updated by refreshToken() function
      } catch (error) {
        console.error('[Step 6] Token refresh failed, clearing session:', error);
        window.clearTokens();
        // Return to auth step would be handled by UI logic
      }
    } else {
      // No refresh token, clear session
      console.log('[Step 6] No refresh token available, clearing session');
      window.clearTokens();
    }
    return;
  }
  
  // Token not expired, validate it
  try {
    await authAPI.validateToken();
    console.log('[Step 6] Token validated successfully');
  } catch (error) {
    const isRateLimit = isRateLimitError(error);
    if (isRateLimit) {
      const retryMs = getRetryDelayFromError(error);
      tokenValidationCooldownUntil = Date.now() + retryMs;
      console.warn(`[Step 6] Token validation rate limited. Cooling down for ${Math.ceil(retryMs / 1000)}s`);
      return;
    }
    console.error('[Step 6] Token validation failed:', error);
    // If validation fails, try refresh if refresh token exists
    if (refreshToken) {
      try {
        await authAPI.refreshToken();
        console.log('[Step 6] Token refreshed after validation failure');
        // Header auth indicator will be updated by refreshToken() function
      } catch (refreshError) {
        const refreshRateLimited = isRateLimitError(refreshError);
        if (refreshRateLimited) {
          const retryMs = getRetryDelayFromError(refreshError);
          tokenValidationCooldownUntil = Date.now() + retryMs;
          console.warn(`[Step 6] Token refresh rate limited. Cooling down for ${Math.ceil(retryMs / 1000)}s`);
          return;
        }
        console.error('[Step 6] Token refresh failed, clearing session:', refreshError);
        window.clearTokens();
      }
    } else {
      window.clearTokens();
    }
  }
}

// Step 4: Load reference data after business unit selection
// Caches responses in client state and refreshes when business unit changes
async function loadReferenceData() {
  if (!state.selectedBusinessUnit) {
    console.warn('[Step 4] Cannot load reference data: No business unit selected');
    return;
  }

  try {
    console.log('[Step 4] Loading reference data for business unit:', state.selectedBusinessUnit);
    
    // Fetch all reference data types
    const referenceData = await referenceDataAPI.getAllReferenceData(state.selectedBusinessUnit);
    
    // Cache in state
    state.referenceData = referenceData;
    state.referenceDataLoaded = true;
    
    console.log('[Step 4] Reference data loaded and cached:', referenceData);
    
    // If reference data is available, it can be used throughout the app
    // For example, if countries/regions are available, they can populate dropdowns
    // This is extensible - add UI updates here as new reference data types are added
    
  } catch (error) {
    console.error('[Step 4] Failed to load reference data:', error);
    // Don't block the flow - reference data is optional
    state.referenceData = {};
    state.referenceDataLoaded = false;
  }
}

// Helper function to check if product should be displayed based on labels
// Rules:
// 1. If product has "Hidden" label (case-insensitive) → exclude (even if it also has "Public" or "PublicCampaign")
// 2. If product has "Public" or "PublicCampaign" label (case-insensitive) → include
// 3. Otherwise (no labels or other labels) → exclude (requires explicit "Public" or "PublicCampaign" label)
function shouldDisplayProductByLabels(product) {
  if (!product.productLabels || !Array.isArray(product.productLabels) || product.productLabels.length === 0) {
    // No labels → exclude (requires explicit "Public" or "PublicCampaign" label)
    return false;
  }
  
  // Check for "Hidden" label first (case-insensitive)
  const hasHiddenLabel = product.productLabels.some(
    label => label.name && label.name.toLowerCase() === 'hidden'
  );
  
  if (hasHiddenLabel) {
    // "Hidden" label takes priority → exclude
    return false;
  }
  
  // Check for "Public" or "PublicCampaign" label (case-insensitive)
  const hasPublicLabel = product.productLabels.some(
    label => {
      const labelName = label.name?.toLowerCase();
      return labelName === 'public' || labelName === 'publiccampaign';
    }
  );
  
  if (hasPublicLabel) {
    // Has "Public" or "PublicCampaign" label and no "Hidden" label → include
    return true;
  }
  
  // Has labels but neither "Public", "PublicCampaign", nor "Hidden" → exclude (requires explicit display label)
  return false;
}

// Step 5: Load products (subscriptions and value cards) from API
// API Endpoints (per OpenAPI documentation):
// - GET /api/ver3/products/subscriptions?businessUnit={id} (line ~8287)
//   - Filters by businessUnit query param
//   - Returns SubscriptionProductOut objects with allowedToOrder field
// - GET /api/ver3/products/valuecards?businessUnit={id} (line ~8529)
//   - Filters by businessUnit query param
//   - Returns ValueCardProductOut objects (no allowedToOrder field)
async function loadProductsFromAPI() {
  if (!state.selectedBusinessUnit) {
    console.warn('Cannot load products: No business unit selected');
    return;
  }

  try {
    // Fetch subscriptions and value cards in parallel
    // Backend should already filter by businessUnit query param, but we do additional
    // client-side filtering to ensure compliance with OpenAPI spec display rules
    const [subscriptionsResponse, valueCardsResponse] = await Promise.all([
      businessUnitsAPI.getSubscriptions(state.selectedBusinessUnit),
      businessUnitsAPI.getValueCards(),
    ]);

    // Handle different response formats - could be array or object with data property
    let subscriptions = Array.isArray(subscriptionsResponse) 
      ? subscriptionsResponse 
      : (subscriptionsResponse.data || subscriptionsResponse.items || []);
    
    let valueCards = Array.isArray(valueCardsResponse)
      ? valueCardsResponse
      : (valueCardsResponse.data || valueCardsResponse.items || []);


    // Filter out products that shouldn't be displayed according to OpenAPI documentation
    // Reference: docs/brp-api3-openapi.yaml - SubscriptionProductOut schema (line ~14970)
    // Reference: docs/brp-api3-openapi.yaml - ValueCardProductOut schema (line ~15461)
    
    // Filter subscription products
    // According to OpenAPI spec (SubscriptionProductOut):
    // - allowedToOrder (boolean): "To determine whether the subscription product is bookable for the subscription user or not"
    // - businessUnits (array): "Business units where the product exists"
    const originalSubscriptionCount = subscriptions.length;
    subscriptions = subscriptions.filter((product) => {
      // Debug: Log details for products with "[invalid]" in name to understand backend behavior
      const productNameLower = product.name && typeof product.name === 'string' ? product.name.toLowerCase() : '';
      if (productNameLower.includes('[invalid]') || productNameLower.includes('invalid')) {
        console.log(`[Product Filter DEBUG] ⚠️ Found product with [invalid] in name:`, {
          id: product.id,
          name: product.name,
          nameLower: productNameLower,
          allowedToOrder: product.allowedToOrder,
          hasAllowedToOrderProperty: product.hasOwnProperty('allowedToOrder'),
          allowedToOrderType: typeof product.allowedToOrder,
          businessUnits: product.businessUnits,
          fullProduct: JSON.parse(JSON.stringify(product)) // Deep clone to avoid reference issues
        });
      }
      
      // Debug: Log details for specific product "Collaboration" to understand backend behavior
      if (product.name && typeof product.name === 'string' && 
          (product.name.includes('Collaboration') || product.name.includes('Studiepris'))) {
        const fullProductCopy = JSON.parse(JSON.stringify(product)); // Deep clone to avoid reference issues
        console.log(`[Product Filter DEBUG] 🔍 Found Collaboration/Studiepris product:`, {
          id: product.id,
          name: product.name,
          allowedToOrder: product.allowedToOrder,
          hasAllowedToOrderProperty: product.hasOwnProperty('allowedToOrder'),
          allowedToOrderType: typeof product.allowedToOrder,
          priceWithInterval: product.priceWithInterval,
          hasPrice: !!(product.priceWithInterval?.price?.amount),
          priceAmount: product.priceWithInterval?.price?.amount,
          businessUnits: product.businessUnits,
          businessUnitIds: product.businessUnits?.map(bu => bu.id),
          selectedBusinessUnit: state.selectedBusinessUnit,
          applicableCustomerTypes: product.applicableCustomerTypes,
          applicableCustomerTypesCount: product.applicableCustomerTypes?.length || 0,
          fullProduct: fullProductCopy
        });
        console.log(`[Product Filter DEBUG] 🔍 Full product object:`, fullProductCopy);
      }
      
      // Check 1: allowedToOrder field (per OpenAPI spec line ~15032)
      // If allowedToOrder field exists and is false, exclude the product
      // Note: We check hasOwnProperty to distinguish between undefined and false
      // IMPORTANT: Backend should set allowedToOrder=false for products that shouldn't be displayed,
      // but if backend doesn't do this correctly, we need to handle it defensively
      if (product.hasOwnProperty('allowedToOrder')) {
        if (product.allowedToOrder === false) {
          return false;
        }
        // If allowedToOrder is explicitly true, continue to next checks
      } else {
        // If allowedToOrder property doesn't exist, we need to check if this is intentional
        // According to OpenAPI spec, this field should exist, but if backend doesn't send it,
        // we should log a warning but not exclude the product (backend should handle filtering)
        // Debug logging will help identify if backend is sending products that shouldn't be displayed
        console.warn(`[Product Filter] Subscription product ${product.id} (${product.name}) missing 'allowedToOrder' field - backend should filter this or set allowedToOrder=false`);
      }
      
      // Check 1a: productLabels.availableFor (per OpenAPI spec line ~13397)
      // Product labels can have 'availableFor' field: 'API', 'PUBLIC', or 'PUBLIC_EXCLUDE_FROM_CLASS_FILTER'
      // If product has labels but none are 'PUBLIC', it might not be meant for public display
      // However, this is not a definitive check - products without labels might still be public
      // So we only log a warning, not exclude
      if (product.productLabels && Array.isArray(product.productLabels) && product.productLabels.length > 0) {
        const hasPublicLabel = product.productLabels.some(
          label => label.availableFor === 'PUBLIC' || label.availableFor === 'PUBLIC_EXCLUDE_FROM_CLASS_FILTER'
        );
        if (!hasPublicLabel) {
          console.warn(`[Product Filter] Subscription product ${product.id} (${product.name}) has productLabels but none are PUBLIC - might not be meant for public display`);
        }
      }
      
      // Check 1b: applicableCustomerTypes (per OpenAPI spec line ~15035)
      // If product has no applicable customer types, it might not be displayable
      // However, this could also be valid for products that don't use customer type pricing
      // So we only log a warning, not exclude
      if (product.applicableCustomerTypes && Array.isArray(product.applicableCustomerTypes) && product.applicableCustomerTypes.length === 0) {
        console.warn(`[Product Filter] Subscription product ${product.id} (${product.name}) has empty applicableCustomerTypes array`);
      }
      
      // Check 1c: priceWithInterval (per OpenAPI spec line ~15017)
      // According to OpenAPI spec, subscription products should have priceWithInterval.price.amount
      // Products without a valid price cannot be purchased and should not be displayed
      // Note: Free products should still have price.amount = 0, not missing price
      // This is a defensive check - backend should filter these, but we exclude them client-side too
      if (!product.priceWithInterval || !product.priceWithInterval.price || 
          product.priceWithInterval.price.amount === undefined || 
          product.priceWithInterval.price.amount === null) {
        return false;
      }
      
      // Check 2: businessUnits validation (per OpenAPI spec line ~14986)
      // Defensive check: ensure product is available for the selected business unit
      // Note: Backend should already filter by businessUnit query param, but this is a safety check
      if (product.businessUnits && Array.isArray(product.businessUnits) && product.businessUnits.length > 0) {
        const isAvailableForBusinessUnit = product.businessUnits.some(
          (bu) => bu.id === state.selectedBusinessUnit || bu.id === parseInt(state.selectedBusinessUnit, 10)
        );
        if (!isAvailableForBusinessUnit) {
          return false;
        }
      }
      
      // Check 3: Label-based filtering
      // Only display products with "Public" label, exclude products with "Hidden" label
      if (!shouldDisplayProductByLabels(product)) {
        return false;
      }
      
      return true;
    });
    

    // Filter value card products
    // According to OpenAPI spec (ValueCardProductOut):
    // - businessUnits (array): "Business units where the product exists" (line ~15477)
    // - Note: Value card products do NOT have an 'allowedToOrder' field in the schema
    const originalValueCardCount = valueCards.length;
    valueCards = valueCards.filter((product) => {
      // Check: businessUnits validation (per OpenAPI spec line ~15477)
      // Defensive check: ensure product is available for the selected business unit
      // Note: Backend should already filter by businessUnit query param, but this is a safety check
      if (product.businessUnits && Array.isArray(product.businessUnits) && product.businessUnits.length > 0) {
        const isAvailableForBusinessUnit = product.businessUnits.some(
          (bu) => bu.id === state.selectedBusinessUnit || bu.id === parseInt(state.selectedBusinessUnit, 10)
        );
        if (!isAvailableForBusinessUnit) {
          return false;
        }
      }
      
      // Check: Label-based filtering
      // Only display products with "Public" label, exclude products with "Hidden" label
      if (!shouldDisplayProductByLabels(product)) {
        return false;
      }
      
      return true;
    });
    

    // Separate subscriptions into Campaign, Membership, and 15 Day Pass categories based on labels
    // Priority: PublicCampaign > 15 Day Pass > Public
    // Products with "PublicCampaign" label → Campaign category
    // Products with "15 Day Pass" label → 15 Day Pass category
    // Products with "Public" label (but not "PublicCampaign" or "15 Day Pass") → Membership category
    const campaignSubscriptions = subscriptions.filter(product => {
      // Check if product has "PublicCampaign" label
      const hasPublicCampaignLabel = product.productLabels?.some(
        label => label.name && label.name.toLowerCase() === 'publiccampaign'
      );
      return hasPublicCampaignLabel;
    });
    
    const dayPassSubscriptions = subscriptions.filter(product => {
      // Check if product has "15 Day Pass" label (but not "PublicCampaign")
      const has15DayPassLabel = product.productLabels?.some(
        label => label.name && label.name.toLowerCase() === '15 day pass'
      );
      const hasPublicCampaignLabel = product.productLabels?.some(
        label => label.name && label.name.toLowerCase() === 'publiccampaign'
      );
      return has15DayPassLabel && !hasPublicCampaignLabel;
    });
    
    const membershipSubscriptions = subscriptions.filter(product => {
      // Check if product has "PublicCampaign" or "15 Day Pass" label
      const hasPublicCampaignLabel = product.productLabels?.some(
        label => label.name && label.name.toLowerCase() === 'publiccampaign'
      );
      const has15DayPassLabel = product.productLabels?.some(
        label => label.name && label.name.toLowerCase() === '15 day pass'
      );
      // If it has "PublicCampaign" or "15 Day Pass" label, exclude from membership
      if (hasPublicCampaignLabel || has15DayPassLabel) {
        return false;
      }
      // Otherwise, include if it has "Public" label (already filtered by shouldDisplayProductByLabels)
      return true;
    });
    
    // Store in state
    state.campaignSubscriptions = campaignSubscriptions;
    state.subscriptions = membershipSubscriptions;
    state.dayPassSubscriptions = dayPassSubscriptions;
    state.valueCards = valueCards;


    // Re-render the membership plans with API data
    renderProductsFromAPI();
  } catch (error) {
    console.error('Failed to load products from API:', error);
    // Show error message to user
    showToast('Failed to load membership options. Please try again later.', 'error');
  }
}

// Step 5: Render products from API data into the UI
function renderProductsFromAPI() {
  // Helper function to render a subscription product card
  const renderSubscriptionCard = (product, category) => {
    const planCard = document.createElement('div');
    planCard.className = 'plan-card';
    const productId = product.id;
    planCard.dataset.plan = `${category}-${productId}`;
    planCard.dataset.productId = productId;
    planCard.dataset.category = category;
    
    // Extract price from API structure
    const priceInCents = product.priceWithInterval?.price?.amount || 
                         product.price?.amount || 
                         product.amount || 
                         0;
    const price = priceInCents > 0 ? priceInCents / 100 : 0;
    const currency = product.priceWithInterval?.price?.currency || 
                     product.price?.currency || 
                     product.currency || 
                     'DKK';
    
    // Determine price unit from interval
    const intervalUnit = product.priceWithInterval?.interval?.unit || 'MONTH';
    const priceUnit = intervalUnit === 'MONTH' ? 'kr/mo' : 
                     intervalUnit === 'YEAR' ? 'kr/year' : 'kr';
    
    // Get description - prefer imageBanner.text for campaign products, otherwise use description
    // For campaign products, check both imageBanner.text and description fields
    let description = '';
    if (category === 'campaign') {
      // Campaign: prefer imageBanner.text, but fall back to description if imageBanner.text is empty or single-line
      const bannerText = product.imageBanner?.text || '';
      const descText = product.description || '';
      // If bannerText exists and has newlines, use it; otherwise try description
      description = (bannerText && bannerText.includes('\n')) ? bannerText : 
                    (descText && descText.includes('\n')) ? descText : 
                    bannerText || descText || product.productNumber || '';
    } else {
      description = product.imageBanner?.text || product.description || product.productNumber || '';
    }
    
    // Preserve line breaks from backend - escape HTML and preserve newlines
    const descriptionHtml = description 
      ? description
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
      : '';
    
    planCard.innerHTML = `
      <div class="plan-info">
        <div class="plan-content-left">
          <div class="plan-type">${product.name || 'Membership'}</div>
          ${descriptionHtml ? `<div class="plan-description">${descriptionHtml}</div>` : ''}
        </div>
        <div class="plan-content-right">
          <div class="plan-price">
            <span class="price-amount">${price > 0 ? formatPriceHalfKrone(roundToHalfKrone(price)) : '—'}</span>
            <span class="price-unit">${priceUnit}</span>
          </div>
        </div>
      </div>
      <div class="check-circle"></div>
    `;
    
    return planCard;
  };
  
  // Render campaign subscriptions into the campaign category
  const campaignCategoryItem = document.querySelector('[data-category="campaign"]');
  const campaignPlansList = document.querySelector('[data-category="campaign"] .plans-list');
  
  if (campaignCategoryItem) {
    // Hide campaign category if no products
    if (!state.campaignSubscriptions || state.campaignSubscriptions.length === 0) {
      campaignCategoryItem.style.display = 'none';
    } else {
      // Show category and render products
      campaignCategoryItem.style.display = '';
      if (campaignPlansList) {
        campaignPlansList.innerHTML = '';
        state.campaignSubscriptions.forEach((product) => {
          const planCard = renderSubscriptionCard(product, 'campaign');
          // Event listeners will be set up by setupNewAccessStep()
          campaignPlansList.appendChild(planCard);
        });
      }
    }
  }
  
  // Render subscriptions (memberships) into the membership category
  const membershipPlansList = document.querySelector('[data-category="membership"] .plans-list');
  if (membershipPlansList) {
    membershipPlansList.innerHTML = '';
    
    if (state.subscriptions.length > 0) {
      state.subscriptions.forEach((product) => {
        const planCard = renderSubscriptionCard(product, 'membership');
        // Event listeners will be set up by setupNewAccessStep()
        membershipPlansList.appendChild(planCard);
      });
    } else {
      // Show "No products available" message
      const noProductsMessage = document.createElement('div');
      noProductsMessage.className = 'no-products-message';
      noProductsMessage.innerHTML = `
        <div class="no-products-content">
          <p data-i18n-key="message.noProducts.membership">No membership options available at this time.</p>
        </div>
      `;
      membershipPlansList.appendChild(noProductsMessage);
      // Update translation immediately
      const messageP = noProductsMessage.querySelector('p[data-i18n-key]');
      if (messageP) messageP.textContent = t('message.noProducts.membership');
    }
  }

  // Render 15 Day Pass subscriptions into the 15daypass category
  const dayPassPlansList = document.querySelector('[data-category="15daypass"] .plans-list');
  if (dayPassPlansList) {
    dayPassPlansList.innerHTML = '';
    
    if (state.dayPassSubscriptions && state.dayPassSubscriptions.length > 0) {
      state.dayPassSubscriptions.forEach((product) => {
        const planCard = renderSubscriptionCard(product, '15daypass');
        // Event listeners will be set up by setupNewAccessStep()
        dayPassPlansList.appendChild(planCard);
      });
    } else {
      // Show "No products available" message
      const noProductsMessage = document.createElement('div');
      noProductsMessage.className = 'no-products-message';
      noProductsMessage.innerHTML = `
        <div class="no-products-content">
          <p>No 15 Day Pass options available at this time.</p>
        </div>
      `;
      dayPassPlansList.appendChild(noProductsMessage);
    }
  }

  // Render value cards (punch cards) into the punchcard category
  const punchCardPlansList = document.querySelector('[data-category="punchcard"] .plans-list');
  if (punchCardPlansList) {
    punchCardPlansList.innerHTML = '';
    
    if (state.valueCards.length > 0) {
      state.valueCards.forEach((product) => {
        const planCard = document.createElement('div');
        planCard.className = 'plan-card';
        // Use numeric ID from API
        const productId = product.id;
        planCard.dataset.plan = `punch-${productId}`; // For backward compatibility
        planCard.dataset.productId = productId; // Store API product ID (numeric)
        
        // Extract price from API structure: price.amount is in cents/øre (e.g., 77500 = 775.00 DKK)
        const priceInCents = product.price?.amount || product.amount || 0;
        const price = priceInCents / 100; // Convert from cents to main currency unit
        planCard.dataset.price = price;
        
        // Value cards are one-time purchases, so no interval unit needed
        const description = product.description || product.productNumber || '';
        
        // Preserve line breaks from backend
        const descriptionHtml = description 
          ? description
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\n/g, '<br>')
          : '';
        
        planCard.innerHTML = `
          <div class="plan-info">
            <div class="plan-content-left">
              <div class="plan-type">${product.name || 'Punch Card'}</div>
              ${descriptionHtml ? `<div class="plan-description">${descriptionHtml}</div>` : ''}
            </div>
            <div class="plan-content-right">
              <div class="plan-price">
                <span class="price-amount">${price > 0 ? formatPriceHalfKrone(roundToHalfKrone(price)) : '—'}</span>
                <span class="price-unit">kr</span>
              </div>
            </div>
          </div>
          <div class="check-circle"></div>
          <div class="quantity-panel">
            <div class="quantity-selector">
              <button class="quantity-btn minus" data-action="decrement-quantity" data-plan-id="punch-${productId}" disabled>−</button>
              <span class="quantity-value" data-plan-id="punch-${productId}">1</span>
              <button class="quantity-btn plus" data-action="increment-quantity" data-plan-id="punch-${productId}">+</button>
            </div>
            <button class="continue-btn" data-action="continue-value-cards" data-plan-id="punch-${productId}">Continue</button>
          </div>
        `;
        
        // Event listeners will be set up by setupNewAccessStep()
        punchCardPlansList.appendChild(planCard);
      });
    } else {
      // Show "No products available" message
      const noProductsMessage = document.createElement('div');
      noProductsMessage.className = 'no-products-message';
      noProductsMessage.innerHTML = `
        <div class="no-products-content">
          <p data-i18n-key="message.noProducts.punchcard">No punch card options available at this time.</p>
        </div>
      `;
      punchCardPlansList.appendChild(noProductsMessage);
      // Update translation immediately
      const messageP = noProductsMessage.querySelector('p[data-i18n-key]');
      if (messageP) messageP.textContent = t('message.noProducts.punchcard');
    }
  }
  
  // Re-setup event listeners for the new cards
  // Use setTimeout to ensure DOM is ready
  setTimeout(() => {
    setupNewAccessStep();
  }, 100);
}

// Step 5: Load add-ons when a membership is selected
async function loadSubscriptionAdditions(productId) {
  if (!productId) {
    console.warn('Cannot load additions: No product ID provided');
    return;
  }

  try {
    const response = await businessUnitsAPI.getSubscriptionAdditions(productId);
    
    // Handle different response formats
    const additions = Array.isArray(response)
      ? response
      : (response.data || response.items || []);

    state.subscriptionAdditions = additions;
    console.log(`Loaded ${additions.length} subscription additions for product ${productId}`);

    // TODO: Update add-ons UI with fetched data (Step 3 - Add-ons step)
    // This will be used in the add-ons step
  } catch (error) {
    console.error('Failed to load subscription additions:', error);
    state.subscriptionAdditions = [];
  }
}

// Store user location and gym distances
let userLocation = null;
let gymsWithDistances = [];

// Load gyms from API and update UI
async function loadGymsFromAPI() {
  try {
    const response = await businessUnitsAPI.getBusinessUnits();
    
    // Handle different response formats - could be array or object with data property
    const gyms = Array.isArray(response) ? response : (response.data || response.items || []);
    
    devLog('Loaded gyms from API:', gyms);
    devLog(`Found ${gyms.length} business units`);
    
    // Store gyms for distance calculation
    gymsWithDistances = gyms;
    
    // Update selected gym display if we're on step 2
    if (state.currentStep === 2) {
      updateSelectedGymDisplay();
    }
    
    // Clear existing gym list
    const gymList = document.querySelector('.gym-list');
    if (gymList) {
      gymList.innerHTML = '';
    }
    
    // Show error message if no gyms found
    if (gyms.length === 0) {
      const noResults = document.getElementById('noResults');
      if (noResults) {
        noResults.classList.remove('hidden');
        noResults.textContent = 'No business units found. Please check API authentication.';
      }
      console.warn('No business units returned from API');
      return;
    }
    
    // Hide no results message if gyms are found
    const noResults = document.getElementById('noResults');
    if (noResults) {
      noResults.classList.add('hidden');
    }
    
    // Log sample gym structure to debug coordinate location
    if (gyms.length > 0) {
      devLog('[Load Gyms] Sample gym structure:', {
        name: gyms[0].name,
        address: gyms[0].address,
        hasLatLon: !!(gyms[0].address?.latitude && gyms[0].address?.longitude),
        fullGym: gyms[0]
      });
    }
    
    // If user location is available, sort by distance
    let gymsToDisplay = gyms;
    if (userLocation) {
      devLog('[Load Gyms] User location available, calculating distances...', userLocation);
      // Show loading message
      // Hide status text
      const locationStatus = document.getElementById('locationStatus');
      if (locationStatus) {
        locationStatus.style.display = 'none';
      }
      
      gymsToDisplay = await calculateGymDistances(
        gyms,
        userLocation.latitude,
        userLocation.longitude,
        userLocation.accuracy,
        { logger: geoLogger }
      );
      gymsWithDistances = gymsToDisplay;
      
      // Update selected gym display if we're on step 2
      if (state.currentStep === 2) {
        updateSelectedGymDisplay();
      }
      
      // Ensure location button is highlighted if location is active
      const locationBtn = document.getElementById('findNearestGym');
      if (locationBtn && userLocation) {
        locationBtn.classList.add('active');
      }
      
      // Log first few gyms to verify sorting
      devLog('[Load Gyms] First 3 gyms after sorting:', gymsToDisplay.slice(0, 3).map(g => ({
        name: g.name,
        distance: g.distance !== null ? `${g.distance.toFixed(2)} km` : 'N/A',
        hasCoordinates: !!(g.address?.latitude && g.address?.longitude)
      })));
    } else {
      devLog('[Load Gyms] No user location available, displaying gyms in original order');
    }
    
    // Store existing gym items and their positions for animation
    const existingItems = Array.from(gymList.querySelectorAll('.gym-item'));
    const existingPositions = new Map();
    existingItems.forEach((item, index) => {
      const gymId = item.getAttribute('data-gym-id');
      if (gymId) {
        existingPositions.set(gymId, {
          element: item,
          oldIndex: index,
          rect: item.getBoundingClientRect()
        });
      }
    });
    
    // Clear the list
    gymList.innerHTML = '';
    
    // Create gym items from API data
    const newItems = [];
    for (let i = 0; i < gymsToDisplay.length; i++) {
      const gym = gymsToDisplay[i];
      if (gym.name && gym.address) {
        // Create and display gym item
        // Mark as nearest if it's the first gym AND has a valid distance
        const isNearest = i === 0 && userLocation && gym.distance !== null && gym.distance !== undefined;
        if (isNearest) {
          devLog('[Load Gyms] Marking as nearest:', gym.name, `${gym.distance.toFixed(2)} km`);
        }
        const gymItem = createGymItem(gym, isNearest);
        const gymId = `gym-${gym.id}`;
        
        // Check if this item existed before and get its old position
        const existingData = existingPositions.get(gymId);
        if (existingData && existingData.oldIndex !== i) {
          // Item moved - add animation class
          gymItem.classList.add('reordering');
        } else if (!existingData) {
          // New item - fade in with staggered delay
          gymItem.classList.add('fade-in');
          gymItem.style.animationDelay = `${i * 0.05}s`;
        }
        
        newItems.push({ item: gymItem, index: i });
        if (gymList) {
          gymList.appendChild(gymItem);
        }
      }
    }
    
    // Animate reordering using FLIP technique
    if (existingItems.length > 0) {
      requestAnimationFrame(() => {
        newItems.forEach(({ item, index }) => {
          const gymId = item.getAttribute('data-gym-id');
          const existingData = existingPositions.get(gymId);
          
          if (existingData && existingData.oldIndex !== index) {
            // Calculate new position
            const newRect = item.getBoundingClientRect();
            const oldRect = existingData.rect;
            
            // Calculate transform
            const deltaX = oldRect.left - newRect.left;
            const deltaY = oldRect.top - newRect.top;
            
            // Apply initial transform
            item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            item.style.transition = 'none';
            
            // Trigger reflow
            item.offsetHeight;
            
            // Animate to final position with staggered delay
            requestAnimationFrame(() => {
              item.style.transform = '';
              item.style.transition = `transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)`;
              // Add slight delay based on distance moved
              const delay = Math.min(Math.abs(index - existingData.oldIndex) * 0.03, 0.2);
              if (delay > 0) {
                item.style.transitionDelay = `${delay}s`;
              }
            });
          }
        });
      });
    }
    
    // Re-setup event listeners for new gym items
    setupGymEventListeners();
    
  } catch (error) {
    console.error('Failed to load gyms from API:', error);
    
    // Show user-friendly error message
    const gymList = document.querySelector('.gym-list');
    const noResults = document.getElementById('noResults');
    if (gymList && noResults) {
      gymList.innerHTML = '';
      noResults.classList.remove('hidden');
      
      // Provide more helpful error message based on error type
      let errorMessage = 'Failed to load locations. ';
      if (error.message && error.message.includes('HTML instead of JSON')) {
        errorMessage += 'API proxy may not be configured correctly. Please contact support.';
      } else {
        errorMessage += error.message || 'Please check console for details.';
      }
      
      noResults.textContent = errorMessage;
    }
  }
}

// Load countries from API and populate country code selectors
async function loadCountriesFromAPI() {
  try {
    // Determine base URL and proxy settings
    const { baseUrl, useProxy, isDevelopment } = getApiConfig();

    // Helper to log only in development
    const devLog = (...args) => {
      if (isDevelopment) console.log(...args);
    };
    const devWarn = (...args) => {
      if (isDevelopment) console.warn(...args);
    };
    const devError = (...args) => {
      if (isDevelopment) console.error(...args);
    };
    // Build URL for countries endpoint
    // Note: /api/ver3/ endpoints use boulders.brpsystems.com/apiserver base URL
    // In development, use Vite proxy which handles this
    // In production with proxy, the proxy handles the base URL mapping
    let url;
    if (useProxy) {
      url = `${baseUrl}?path=/api/ver3/services/countries`;
    } else if (isDevelopment) {
      // In development, use Vite proxy (relative URL)
      url = '/api/ver3/services/countries';
    } else {
      // Direct API call (shouldn't happen in production, but fallback)
      url = 'https://boulders.brpsystems.com/apiserver/api/ver3/services/countries';
    }
    
    devLog('[Countries] Fetching countries from:', url);
    
    const headers = {
      'Accept-Language': getAcceptLanguageHeader(),
      'Content-Type': 'application/json',
    };
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    devLog('[Countries] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      devError(`[Countries] Failed to load countries (${response.status}):`, errorText);
      devWarn(`[Countries] Using default +45 only.`);
      return; // Fallback to default +45
    }
    
    const countries = await response.json();
    devLog('[Countries] Loaded countries from API:', countries);
    devLog('[Countries] Number of countries:', countries?.length || 0);
    
    if (!Array.isArray(countries) || countries.length === 0) {
      devWarn('[Countries] No countries returned from API. Using default +45 only.');
      return; // Fallback to default +45
    }
    
    // Sort countries alphabetically by name
    const sortedCountries = countries.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    // Populate both country code selectors
    const countryCodeSelect = document.getElementById('countryCode');
    const parentCountryCodeSelect = document.getElementById('parentCountryCode');
    
    devLog('[Countries] Found selectors - countryCode:', !!countryCodeSelect, 'parentCountryCode:', !!parentCountryCodeSelect);
    
    if (!countryCodeSelect && !parentCountryCodeSelect) {
      devWarn('[Countries] Neither selector found in DOM. Retrying in 500ms...');
      // Retry after a delay in case DOM isn't ready yet (only retry once)
      if (!loadCountriesFromAPI.retryAttempted) {
        loadCountriesFromAPI.retryAttempted = true;
        setTimeout(() => {
          loadCountriesFromAPI();
        }, 500);
      }
      return;
    }
    
    // Reset retry flag on successful execution
    loadCountriesFromAPI.retryAttempted = false;
    
    if (countryCodeSelect) {
      populateCountrySelector(countryCodeSelect, sortedCountries);
      devLog('[Countries] Populated countryCode selector with', countryCodeSelect.options.length, 'options');
      // Add event listener to update flag when selection changes
      countryCodeSelect.addEventListener('change', () => {
        updateCountryFlagIcon(countryCodeSelect);
      });
    } else {
      devWarn('[Countries] countryCode selector not found in DOM');
    }
    
    if (parentCountryCodeSelect) {
      populateCountrySelector(parentCountryCodeSelect, sortedCountries);
      devLog('[Countries] Populated parentCountryCode selector with', parentCountryCodeSelect.options.length, 'options');
      // Add event listener to update flag when selection changes
      parentCountryCodeSelect.addEventListener('change', () => {
        updateCountryFlagIcon(parentCountryCodeSelect);
      });
    } else {
      devWarn('[Countries] parentCountryCode selector not found in DOM');
    }
    
    devLog('[Countries] Country selectors populated successfully');
  } catch (error) {
    devWarn('[Countries] Error loading countries from API:', error);
    // Fallback to default +45 - selectors already have this option
  }
}

// Store country data mapping for flag lookups
let countryDataMap = new Map(); // Maps phoneCountryCode (as string like "+45") to {alpha2, name, phoneCountryCode}

// Helper function to populate a country selector with countries
function populateCountrySelector(selectElement, countries) {
  if (!selectElement || !Array.isArray(countries)) return;
  
  // Store current selected value
  const currentValue = selectElement.value || '+45';
  
  // Clear existing options (except keep the structure)
  selectElement.innerHTML = '';
  
  // Clear and rebuild country data map
  countryDataMap.clear();
  
  // Add countries as options
  countries.forEach(country => {
    if (country.phoneCountryCode != null) {
      const option = document.createElement('option');
      const phoneCode = `+${country.phoneCountryCode}`;
      option.value = phoneCode;
      // Format: "+45 Denmark" or "+45" if no name
      const countryName = country.name || country.alpha2 || '';
      option.textContent = countryName ? `${phoneCode} ${countryName}` : phoneCode;
      
      // Store data attribute for flag lookup
      if (country.alpha2) {
        option.dataset.alpha2 = country.alpha2;
        // Store in map for quick lookup
        countryDataMap.set(phoneCode, {
          alpha2: country.alpha2,
          name: country.name,
          phoneCountryCode: country.phoneCountryCode
        });
      }
      
      selectElement.appendChild(option);
    }
  });
  
  // Set default selection to +45 (Denmark) if available, otherwise keep current or select first
  if (selectElement.querySelector('option[value="+45"]')) {
    selectElement.value = '+45';
  } else if (selectElement.options.length > 0) {
    selectElement.value = selectElement.options[0].value;
  }
  
  // If current value exists, try to restore it
  if (currentValue && selectElement.querySelector(`option[value="${currentValue}"]`)) {
    selectElement.value = currentValue;
  }
  
  // Update flag icon for the selected value
  updateCountryFlagIcon(selectElement);
}

// Helper function to update flag icon based on selected country code
function updateCountryFlagIcon(selectElement) {
  if (!selectElement) return;
  
  const selectedValue = selectElement.value;
  const flagIcon = selectElement.closest('.country-selector')?.querySelector('.flag-icon');
  
  if (!flagIcon) return;
  
  // Find the selected option
  const selectedOption = selectElement.querySelector(`option[value="${selectedValue}"]`);
  const alpha2 = selectedOption?.dataset.alpha2 || countryDataMap.get(selectedValue)?.alpha2;
  
  if (alpha2) {
    flagIcon.textContent = getFlagEmoji(alpha2);
  } else {
    // Fallback: try to infer from phone code (common countries)
    const phoneCode = selectedValue.replace('+', '');
    const commonFlags = {
      '45': 'DK', // Denmark
      '46': 'SE', // Sweden
      '47': 'NO', // Norway
      '358': 'FI', // Finland
      '49': 'DE', // Germany
      '33': 'FR', // France
      '44': 'GB', // United Kingdom
      '1': 'US', // United States
    };
    
    const inferredAlpha2 = commonFlags[phoneCode];
    if (inferredAlpha2) {
      flagIcon.textContent = getFlagEmoji(inferredAlpha2);
    } else {
      flagIcon.textContent = '🌍'; // Default globe emoji
    }
  }
}


// Find nearest gym using geolocation
async function findNearestGym() {
  const locationBtn = document.getElementById('findNearestGym');
  const locationStatus = document.getElementById('locationStatus');
  
  if (!locationBtn || !locationStatus) return;
  
  // Check if location is already active - toggle it off
  if (userLocation && locationBtn.classList.contains('active')) {
    devLog('[Geolocation] Toggling location off, restoring default order');
    
    // Clear user location
    userLocation = null;
    gymsWithDistances = [];
    
    // Remove active state and loading
    locationBtn.classList.remove('active');
    locationBtn.classList.remove('loading');
    
    // Reload gyms in default order (without distance sorting)
    await loadGymsFromAPI();
    
    return;
  }
  
  // Check if geolocation is supported
  if (!isGeolocationAvailable()) {
    locationStatus.style.display = 'none';
    return;
  }
  
  // Update button state - show loading
  locationBtn.disabled = true;
  locationBtn.classList.add('loading');
  
  // Hide status text
  locationStatus.style.display = 'none';
  
  try {
    // Trigger geolocation immediately from user gesture, then await permission info
    const permissionPromise = checkGeolocationPermission();
    const locationPromise = getUserLocation({ logger: geoLogger });
    const [permissionStatus, location] = await Promise.all([permissionPromise, locationPromise]);
    devLog('[Geolocation] Permission status before request:', permissionStatus);
    userLocation = location;
    
    devLog('User location:', location);
    
    // Hide status text
    locationStatus.style.display = 'none';
    
    // Reload gyms with distance sorting
    await loadGymsFromAPI();
    
    // Highlight icon button (add active class)
    locationBtn.classList.add('active');
    locationBtn.classList.remove('loading');
    locationBtn.disabled = false;
    
  } catch (error) {
    // Log location errors as warnings (not errors) since they're handled gracefully
    // Location unavailable/timeout is common in testing/dev environments, especially on macOS
    if (error.type === 'unavailable') {
      console.warn('[Geolocation] Location unavailable:', error.message);
    } else if (error.type === 'timeout') {
      console.warn('[Geolocation] Location timeout (common on macOS when CoreLocation cannot determine position):', error.message);
    } else if (error.type === 'permission-denied') {
      console.warn('[Geolocation] Location permission denied:', error.message);
    } else {
      console.warn('[Geolocation] Location error:', error.message);
    }
    
    // Show helpful error message based on error type
    let errorMessage = error.message;
    let showHelp = false;
    
    if (error.type === 'permission-denied') {
      errorMessage = 'Location access was denied. Please allow location access in your browser settings and try again.';
      showHelp = true;
    } else if (error.type === 'unavailable') {
      // Provide macOS-specific troubleshooting
      const isMacOS = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      if (isMacOS) {
        devLog('%c[Geolocation Troubleshooting]', 'color: #F401F5; font-weight: bold;');
        devLog('macOS CoreLocation cannot determine your position. Try:');
        devLog('1. System Settings → Privacy & Security → Location Services (enable)');
        devLog('2. Grant location permission to your browser');
        devLog('3. Enable WiFi (needed for macOS location, even if not connected)');
        devLog('4. Reset browser location permissions');
        devLog('5. Restart your browser');
        errorMessage = 'Location unavailable on macOS. Check: System Settings → Privacy → Location Services, enable WiFi, and grant browser permission.';
      } else {
        errorMessage = 'Location information is unavailable. Please ensure location services are enabled on your device.';
      }
      showHelp = true;
    } else if (error.type === 'timeout') {
      // Timeout errors on macOS are often CoreLocation issues - be more helpful
      if (error.isMacOS) {
        errorMessage = 'Location request timed out. On macOS, this usually means CoreLocation cannot determine your position. The "Find nearest gym" feature may not be available in this environment. You can still browse all gyms normally.';
      } else {
        errorMessage = 'Location request timed out. Please check your connection and try again.';
      }
      showHelp = true;
    }
    
    // Hide status text (no error messages shown)
    locationStatus.style.display = 'none';
    
    // Remove active state and loading from button
    locationBtn.classList.remove('active');
    locationBtn.classList.remove('loading');
    locationBtn.disabled = false;
  }
}

// Create gym item element from API data
function createGymItem(gym, isNearest = false) {
  const gymItem = document.createElement('div');
  gymItem.className = 'gym-item';
  if (isNearest) {
    gymItem.classList.add('nearest-gym');
  }
  gymItem.setAttribute('data-gym-id', `gym-${gym.id}`);
  
  const address = gym.address;
  // Break address before zipcode - street on first line, zipcode + city on second
  const addressStreet = address.street;
  const addressPostalCity = `${address.postalCode} ${address.city}`;
  
  // Add distance badge if available
  const distanceBadge = gym.distance !== null && gym.distance !== undefined
    ? `<div class="gym-distance-badge">${formatDistance(gym.distance)}</div>`
    : '';
  
  // Add nearest badge if this is the nearest gym (positioned absolutely in top right)
  const nearestBadge = isNearest
    ? `<div class="nearest-badge">${t('gym.nearest')}</div>`
    : '';
  
  gymItem.innerHTML = `
    ${nearestBadge}
    ${distanceBadge}
    <div class="gym-info">
      <div class="gym-name">${gym.name}</div>
      <div class="gym-details">
        <div class="gym-address">
          <div class="gym-address-street">${addressStreet}</div>
          <div class="gym-address-postal-city">${addressPostalCity}</div>
        </div>
      </div>
    </div>
    <div class="check-circle"></div>
  `;
  
  return gymItem;
}

// Setup event listeners for gym items
function setupGymEventListeners() {
  const gymItems = document.querySelectorAll('.gym-item');
  gymItems.forEach(item => {
    item.addEventListener('click', (e) => {
      handleGymSelection(item);
    });
  });
}


// Track pending navigation timeouts to prevent double-clicks and stale state
const pendingNavigationTimeouts = {
  gym: null,
  plan: null,
  membership: null,
  punchcard: null
};

// Language management
const SUPPORTED_LANGUAGES = {
  'da-DK': { code: 'da-DK', name: 'Dansk', flag: '🇩🇰' },
  'en-GB': { code: 'en-GB', name: 'English', flag: '🇬🇧' }
};

const DEFAULT_LANGUAGE = 'da-DK';

function getStoredLanguage() {
  try {
    const stored = localStorage.getItem('selectedLanguage');
    return stored && SUPPORTED_LANGUAGES[stored] ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function setStoredLanguage(languageCode) {
  try {
    if (SUPPORTED_LANGUAGES[languageCode]) {
      localStorage.setItem('selectedLanguage', languageCode);
      return true;
    }
  } catch {
    // Ignore localStorage errors
  }
  return false;
}

function getAcceptLanguageHeader() {
  return state.language || DEFAULT_LANGUAGE;
}

function getReturnUrlBase() {
  let override = null;
  try {
    override = window?.BOULDERS_RETURN_URL_BASE || localStorage.getItem('boulders_return_url_base');
  } catch (e) {
    // Ignore localStorage errors
  }

  if (override) {
    return String(override).replace(/\/$/, '');
  }

  const isHttps = window.location.protocol === 'https:';
  if (isHttps) {
    return window.location.origin.replace('http://', 'https://');
  }

  // Local HTTP is not accepted by payment API, default to production
  return 'https://join.boulders.dk';
}

const state = {
  currentStep: 1,
  language: getStoredLanguage(), // Current selected language
  selectedGymId: null,
  selectedBusinessUnit: null, // Step 3: Store chosen business unit for API requests
  selectedGymName: null, // Store selected gym name for display
  currentAuthMode: null, // Track current auth mode (login/create)
  membershipPlanId: null,
  valueCardQuantities: new Map(),
  addonIds: new Set(),
  totals: {
    cartTotal: 0,
    membershipMonthly: 0,
    discountAmount: 0, // Discount amount applied
    subtotal: 0, // Subtotal before discount
  },
  cartItems: [],
  billingPeriod: '',
  forms: {},
  order: null, // Order summary object for confirmation view (created by buildOrderSummary)
  fullOrder: null, // Full order object from API (includes subscriptionItems, price, etc.) - used for payment overview
  orderId: null, // Step 7: Created order ID
  customerId: null, // Step 6: Created customer ID (for membership ID display)
  paymentFailed: false, // Flag to track if payment failed (prevents success page from showing)
  paymentPending: false, // Flag to track if payment is pending (prevents success page from showing)
  paymentConfirmed: false, // Flag to track if payment is confirmed (allows success page to show)
  authenticatedEmail: null,
  authenticatedCustomer: null, // Full customer profile data from API
  checkoutInProgress: false, // Flag to prevent duplicate checkout attempts
  loginInProgress: false, // Prevent duplicate login submissions
  paymentMethod: null,
  // Step 9: Payment link state
  paymentLink: null, // Generated payment link for checkout
  paymentLinkGenerated: false, // Flag indicating if payment link has been generated
  // Discount code state
  discountCode: null, // Applied discount code
  discountApplied: false, // Whether discount is currently applied
  // Email tracking to prevent duplicate account creation
  createdEmails: new Set(), // Track emails that have been used to create accounts in this session
  // Step 5: Store fetched products from API
  campaignSubscriptions: [], // Fetched campaign products (with "PublicCampaign" label)
  subscriptions: [], // Fetched membership products (with "Public" label, excluding "PublicCampaign" and "15 Day Pass")
  dayPassSubscriptions: [], // Fetched 15 Day Pass products (with "15 Day Pass" label)
  valueCards: [], // Fetched punch card products
  subscriptionAdditions: [], // Fetched add-ons for selected membership
  selectedProductType: null, // 'membership' or 'punch-card'
  selectedProductId: null, // The actual product ID from API
  selectedAddonIds: [], // Array of selected add-on product IDs
  // Step 4: Reference data cache
  referenceData: {}, // Cached reference/lookup data (countries, regions, currencies, etc.)
  referenceDataLoaded: false, // Flag to track if reference data has been loaded
  subscriptionAttachedOrderId: null, // Tracks which order already has the membership attached
  // Test mode for success page
  testMode: false, // Flag to enable test mode for success page (?testSuccess=true)
  testProductType: null, // Product type for test mode (membership, 15daypass, punch-card)
};

let orderCreationPromise = null;
let subscriptionAttachPromise = null;
let tokenValidationCooldownUntil = 0;
let loginCooldownUntil = 0;

function isUserAuthenticated() {
  return typeof window.getAccessToken === 'function' && Boolean(window.getAccessToken());
}

function getTokenMetadata() {
  if (typeof window.getTokenMetadata === 'function') {
    return window.getTokenMetadata();
  }
  return null;
}

async function syncAuthenticatedCustomerState(username = null, email = null) {
  const metadata = getTokenMetadata();
  const resolvedUsername = username || state.customerId || metadata?.username || metadata?.userName;
  const resolvedEmail = email || state.authenticatedEmail || metadata?.email;

  if (resolvedUsername) {
    state.customerId = String(resolvedUsername);
  }

  if (resolvedEmail) {
    state.authenticatedEmail = resolvedEmail;
  }

  // Fetch customer profile if we have customer ID and access token
  // Always fetch to ensure we have complete profile data (not just partial form data)
  if (state.customerId && isUserAuthenticated()) {
    try {
      const customerData = await authAPI.getCustomer(state.customerId);
      state.authenticatedCustomer = customerData;
      console.log('[Auth] Customer profile loaded:', customerData);
      // Refresh UI after loading profile to show all fields
      refreshLoginUI();
    } catch (profileError) {
      console.warn('[Auth] Could not fetch customer profile:', profileError);
      // Continue even if profile fetch fails - refresh UI with whatever data we have
      refreshLoginUI();
    }
  } else {
    refreshLoginUI();
  }
  
  // Dispatch event to notify React components of auth state change
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth-state-changed'));
  }
  autoEnsureOrderIfReady('auth-state-sync')
    .then(() => {
      // Order should now be created and subscription attached
      // Update payment overview if we're on step 4
      if (state.currentStep === 4) {
        updatePaymentOverview();
      }
    })
    .catch(error => {
      console.warn('[Auth] Could not ensure order after auth sync:', error);
    });
}

const DOM = {};
const templates = {};
const TOTAL_STEPS = 5;
const buttonGlareTimeouts = new WeakMap();
const carouselResizeObservers = new WeakMap();
const carouselScrollHandlers = new WeakMap();
const carouselResizeFallbacks = new WeakMap();

// Determine whether a membership (not punch card) is currently selected
function isMembershipSelected() {
  const id = state.membershipPlanId;
  if (!id) return false;
  return !String(id).includes('punch');
}

// Interstitial Add-ons Modal (shown after selecting membership on step 2)
let addonsModal = null;
let addonsModalImageCol = null;
let addonsModalImageEl = null;
function defaultAddonsImage() {
  // Simple dark gradient SVG placeholder with label
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#0b0f1a"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g fill="#22d3ee" opacity="0.08">
    <circle cx="120" cy="160" r="80"/>
    <circle cx="360" cy="280" r="60"/>
    <circle cx="640" cy="180" r="90"/>
    <circle cx="240" cy="520" r="70"/>
    <circle cx="560" cy="720" r="100"/>
  </g>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#e5e7eb" font-size="36" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">Boost your membership</text>
  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="18" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">Add shoes, chalk and more</text>
</svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}
function ensureAddonsModal() {
  if (addonsModal) return addonsModal;
  const overlay = document.createElement('div');
  overlay.className = 'addons-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  
  // Modal styles are defined in styles.css (no inline style injection)

  const sheet = document.createElement('div');
  sheet.className = 'addons-sheet';

  const contentWrap = document.createElement('div');
  contentWrap.className = 'addons-content';

  // Left image column (optional)
  // Image column removed per request

  const header = document.createElement('div');
  header.className = 'addons-header';
  const title = document.createElement('h3');
  title.textContent = 'Add to your membership';
  title.className = 'addons-title';
  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.setAttribute('type', 'button');
  closeBtn.textContent = '\u00D7';
  closeBtn.className = 'addons-close';
  closeBtn.addEventListener('click', () => hideAddonsModal());
  header.appendChild(title);
  header.appendChild(closeBtn);

  const grid = document.createElement('div');
  grid.className = 'addons-grid';
  grid.setAttribute('data-modal-addons-grid', '');

  const actions = document.createElement('div');
  actions.className = 'addons-actions';
  const hint = document.createElement('div');
  hint.textContent = 'Add gear now at a special price and pick it up at your next visit.';
  hint.className = 'addons-hint';
  
  // Single dynamic button
  const actionButton = document.createElement('button');
  actionButton.textContent = 'Skip';
  actionButton.className = 'addons-action-btn';
  actionButton.addEventListener('click', () => handleAddonAction());
  
  const rightActions = document.createElement('div');
  rightActions.className = 'addons-actions-right';
  rightActions.appendChild(actionButton);
  actions.appendChild(hint);
  actions.appendChild(rightActions);

  const contentCol = document.createElement('div');
  contentCol.style.flex = '1 1 auto';
  contentCol.style.display = 'flex';
  contentCol.style.flexDirection = 'column';
  contentCol.style.minWidth = '0';
  contentCol.appendChild(header);
  contentCol.appendChild(grid);
  contentCol.appendChild(actions);

  // Image column removed
  contentWrap.appendChild(contentCol);
  sheet.appendChild(contentWrap);
  overlay.appendChild(sheet);
  
  // Add click-outside-to-close functionality
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideAddonsModal();
    }
  });
  
  document.body.appendChild(overlay);

  addonsModal = overlay;
  return addonsModal;
}

function populateAddonsModal() {
  ensureAddonsModal();
  const grid = addonsModal.querySelector('[data-modal-addons-grid]');
  if (!grid) return;
  grid.innerHTML = '';
  const addons = Array.isArray(state.subscriptionAdditions)
    ? state.subscriptionAdditions
    : [];
  if (addons.length === 0) {
    return;
  }
  if (!templates.addon) {
    // Fallback simple cards if template missing
    addons.forEach((addon) => {
      const card = document.createElement('div');
      card.className = 'plan-card addon-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div style="font-weight:600">${addon.name}</div>
        <div>${typeof addon.price?.discounted === 'number'
          ? formatPriceHalfKrone(roundToHalfKrone(addon.price.discounted))
          : '—'} kr</div>
        <div class="check-circle" data-action="toggle-addon" data-addon-id="${addon.id}"></div>
      `;
      
      // Make entire card clickable
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking the check circle itself
        const checkCircle = card.querySelector('.check-circle');
        if (e.target === checkCircle || checkCircle.contains(e.target)) {
          return;
        }
        // Toggle the addon
        if (addon.id) toggleAddon(addon.id, checkCircle);
      });
      
      grid.appendChild(card);
    });
    return;
  }
  // Use existing add-on template for consistency
  addons.forEach((addon) => {
    const card = templates.addon.content.firstElementChild.cloneNode(true);
    const checkCircle = card.querySelector('[data-action="toggle-addon"]');
    if (checkCircle) checkCircle.dataset.addonId = addon.id;
    const nameEl = card.querySelector('[data-element="name"]');
    const originalPriceEl = card.querySelector('[data-element="originalPrice"]');
    const discountedPriceEl = card.querySelector('[data-element="discountedPrice"]');
    const descriptionEl = card.querySelector('[data-element="description"]');
    const featuresEl = card.querySelector('[data-element="features"]');
    if (nameEl) nameEl.textContent = addon.name;
    // Extract and display product image
    if (imageEl) {
      // Check if addon has assets (from API product) or imageUrl (from hardcoded)
      let imageUrl = null;
      if (addon.assets && Array.isArray(addon.assets) && addon.assets.length > 0) {
        console.log('[Addons Modal] Addon assets:', addon.name, addon.assets);
        // Look for MAIN or CENTERED asset type
        const mainAsset = addon.assets.find(asset => 
          asset.type === 'MAIN' || asset.type === 'CENTERED'
        ) || addon.assets[0]; // Fallback to first asset if no MAIN/CENTERED
        
        // AssetOut has contentUrl field (per OpenAPI spec)
        // Use contentUrl if available, otherwise fall back to constructing from reference
        imageUrl = mainAsset?.contentUrl || mainAsset?.url || null;
        
        // If no contentUrl, construct from reference ID
        if (!imageUrl && mainAsset?.reference) {
          // Construct asset URL from reference ID
          const referenceId = mainAsset.reference;
          const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const isCloudflarePages = window.location.hostname.includes('pages.dev') ||
                                   window.location.hostname.includes('join.boulders.dk') ||
                                   window.location.hostname === 'boulders.dk';
          
          if (isDevelopment) {
            imageUrl = `/api-proxy?path=/api/assets/${referenceId}`;
          } else if (isCloudflarePages) {
            imageUrl = `/api-proxy?path=/api/assets/${referenceId}`;
          } else {
            imageUrl = `https://api-join.boulders.dk/api/assets/${referenceId}`;
          }
          console.log('[Addons Modal] Constructed asset URL from reference:', referenceId, '->', imageUrl);
        }
      } else if (addon.imageUrl) {
        imageUrl = addon.imageUrl;
      }
      
      console.log('[Addons Modal] Image URL for', addon.name, ':', imageUrl);
      
      if (imageUrl) {
        imageEl.src = imageUrl;
        imageEl.alt = addon.name || 'Addon image';
        imageEl.removeAttribute('style'); // Remove inline style that hides it
        imageEl.style.display = 'block';
        imageEl.style.visibility = 'visible';
        imageEl.style.opacity = '1';
        imageEl.style.width = '100%';
        imageEl.style.height = '200px';
        imageEl.style.objectFit = 'cover';
        imageEl.style.borderRadius = '8px';
        imageEl.style.marginBottom = '12px';
        imageEl.classList.add('addon-image');
        console.log('[Addons Modal] Image set for', addon.name, '- src:', imageEl.src);
        console.log('[Addons Modal] Image computed display:', window.getComputedStyle(imageEl).display);
      } else {
        imageEl.style.display = 'none';
        console.log('[Addons Modal] No image URL found for', addon.name);
      }
    } else {
      console.log('[Addons Modal] Image element not found for', addon.name);
    }
    
    if (originalPriceEl) originalPriceEl.textContent = formatPriceHalfKrone(roundToHalfKrone(addon.price.original));
    if (discountedPriceEl) discountedPriceEl.textContent = formatPriceHalfKrone(roundToHalfKrone(addon.price.discounted));
    if (descriptionEl) descriptionEl.textContent = addon.description;
    if (featuresEl) {
      featuresEl.innerHTML = '';
      addon.features.forEach((feature) => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresEl.appendChild(li);
      });
    }
    
    // Make entire card clickable
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking the check circle itself
      if (e.target === checkCircle || checkCircle.contains(e.target)) {
        return;
      }
      // Toggle the addon
      if (addon.id) toggleAddon(addon.id, checkCircle);
    });
    
    grid.appendChild(card);
  });
}

function showAddonsModal() {
  ensureAddonsModal();
  populateAddonsModal();
  updateAddonActionButton();
  
  // Show modal with subtle animation
  addonsModal.style.display = 'block';
  addonsModal.style.opacity = '0';
  addonsModal.style.transform = 'scale(0.95)';
  document.body.style.overflow = 'hidden';
  
  // Trigger animation after a brief moment
  requestAnimationFrame(() => {
    addonsModal.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    addonsModal.style.opacity = '1';
    addonsModal.style.transform = 'scale(1)';
  });
}

function hideAddonsModal() {
  if (!addonsModal) return;
  addonsModal.style.display = 'none';
  document.body.style.overflow = '';
}

function proceedAfterAddons() {
  hideAddonsModal();
  // Jump directly to Info step (step 4)
  state.currentStep = 4;
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();
  scrollToTop();
  setTimeout(scrollToTop, 200);
}

// Populate boost modal with products that have "boostProduct" label
function populateBoostModal() {
  ensureAddonsModal();
  const grid = addonsModal.querySelector('[data-modal-addons-grid]');
  const title = addonsModal.querySelector('.addons-title');
  
  if (!grid) {
    console.error('[Boost Modal] Grid element not found!');
    return;
  }
  
  // Update title for boost modal
  if (title) {
    title.textContent = 'Boost your membership';
  }
  
  grid.innerHTML = '';
  
  // Use products with "boostProduct" label
  const boostProducts = state.boostProducts || [];
  
  if (boostProducts.length === 0) {
    // No boost products available
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'addons-empty';
    emptyMsg.textContent = 'No boost products available.';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.padding = '2rem';
    emptyMsg.style.color = 'var(--color-text-secondary, #6b7280)';
    grid.appendChild(emptyMsg);
    return;
  }
  
  // Render each boost product
  boostProducts.forEach((product) => {
    if (!templates.addon) {
      // Fallback simple card if template missing
      const card = document.createElement('div');
      card.className = 'plan-card addon-card';
      card.style.cursor = 'pointer';
      
      // Extract price from product structure (similar to renderSubscriptionCard)
      const priceInCents = product.priceWithInterval?.price?.amount || 
                           product.price?.amount || 
                           product.amount || 
                           0;
      const price = priceInCents > 0 ? priceInCents / 100 : 0;
      const currency = product.priceWithInterval?.price?.currency || 
                       product.price?.currency || 
                       product.currency || 
                       'DKK';
      
      card.innerHTML = `
        <div style="font-weight:600">${product.name || 'Boost Product'}</div>
        <div>${price > 0 ? formatPriceHalfKrone(roundToHalfKrone(price)) + ' kr' : '—'}</div>
        <div class="check-circle" data-action="toggle-addon" data-addon-id="${product.id}"></div>
      `;
      
      // Make entire card clickable
      card.addEventListener('click', (e) => {
        const checkCircle = card.querySelector('.check-circle');
        if (e.target === checkCircle || checkCircle.contains(e.target)) {
          return;
        }
        if (product.id) toggleAddon(product.id, checkCircle);
      });
      
      // Ensure card is visible
      card.style.opacity = '1';
      card.style.visibility = 'visible';
      
      grid.appendChild(card);
      return;
    }
    
    // Use existing add-on template
    const card = templates.addon.content.firstElementChild.cloneNode(true);
    const checkCircle = card.querySelector('[data-action="toggle-addon"]');
    if (checkCircle) checkCircle.dataset.addonId = product.id;
    
    const nameEl = card.querySelector('[data-element="name"]');
    const imageEl = card.querySelector('[data-element="image"]');
    const originalPriceEl = card.querySelector('[data-element="originalPrice"]');
    const discountedPriceEl = card.querySelector('[data-element="discountedPrice"]');
    const descriptionEl = card.querySelector('[data-element="description"]');
    const featuresEl = card.querySelector('[data-element="features"]');
    
    if (nameEl) nameEl.textContent = product.name || 'Boost Product';
    
    // Extract and display product image
    if (imageEl) {
      let imageUrl = null;
      
      if (product.assets && Array.isArray(product.assets) && product.assets.length > 0) {
        console.log('[Boost Modal] Product assets:', product.name, product.assets);
        // Look for MAIN or CENTERED asset type
        const mainAsset = product.assets.find(asset => 
          asset.type === 'MAIN' || asset.type === 'CENTERED'
        ) || product.assets[0]; // Fallback to first asset if no MAIN/CENTERED
        
        console.log('[Boost Modal] Selected asset full object:', JSON.stringify(mainAsset, null, 2));
        console.log('[Boost Modal] Asset contentUrl:', mainAsset?.contentUrl);
        console.log('[Boost Modal] Asset url:', mainAsset?.url);
        console.log('[Boost Modal] Asset reference:', mainAsset?.reference);
        
        // AssetOut has contentUrl field (per OpenAPI spec)
        // Use contentUrl if available, otherwise fall back to constructing from reference
        imageUrl = mainAsset?.contentUrl || mainAsset?.url || null;
        
        // If no contentUrl, construct from reference ID
        if (!imageUrl && mainAsset?.reference) {
          // Construct asset URL from reference ID
          const referenceId = mainAsset.reference;
          const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const isCloudflarePages = window.location.hostname.includes('pages.dev') ||
                                   window.location.hostname.includes('join.boulders.dk') ||
                                   window.location.hostname === 'boulders.dk';
          
          if (isDevelopment) {
            imageUrl = `/api-proxy?path=/api/assets/${referenceId}`;
          } else if (isCloudflarePages) {
            imageUrl = `/api-proxy?path=/api/assets/${referenceId}`;
          } else {
            imageUrl = `https://api-join.boulders.dk/api/assets/${referenceId}`;
          }
          console.log('[Boost Modal] Constructed asset URL from reference:', referenceId, '->', imageUrl);
        }
      }
      
      console.log('[Boost Modal] Image URL for', product.name, ':', imageUrl);
      
      if (imageUrl) {
        imageEl.src = imageUrl;
        imageEl.alt = product.name || 'Product image';
        imageEl.style.display = 'block';
        imageEl.classList.add('addon-image');
        console.log('[Boost Modal] Image set for', product.name);
      } else {
        imageEl.style.display = 'none';
        console.log('[Boost Modal] No image URL found for', product.name);
      }
    }
    
    // Extract price from product structure (similar to renderSubscriptionCard)
    const priceInCents = product.priceWithInterval?.price?.amount || 
                         product.price?.amount || 
                         product.amount || 
                         0;
    const price = priceInCents > 0 ? priceInCents / 100 : 0;
    const originalPrice = product.originalPrice ? product.originalPrice / 100 : null;
    
    if (originalPriceEl && originalPrice && originalPrice > price) {
      originalPriceEl.textContent = formatPriceHalfKrone(roundToHalfKrone(originalPrice));
      originalPriceEl.style.display = '';
    } else if (originalPriceEl) {
      originalPriceEl.style.display = 'none';
    }
    
    if (discountedPriceEl) {
      // Always show price, including "0 kr" for free items
      discountedPriceEl.textContent = formatPriceHalfKrone(roundToHalfKrone(price));
    }
    
    if (descriptionEl) {
      // Get description similar to renderSubscriptionCard
      const description = product.imageBanner?.text || product.description || product.productNumber || '';
      descriptionEl.textContent = description;
    }
    
    if (featuresEl && product.features && Array.isArray(product.features)) {
      featuresEl.innerHTML = '';
      product.features.forEach((feature) => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresEl.appendChild(li);
      });
    } else if (featuresEl) {
      featuresEl.innerHTML = '';
    }
    
    // Make entire card clickable
    card.style.cursor = 'pointer';
    
    // Ensure card is visible (fix opacity: 0 issue)
    card.style.opacity = '1';
    card.style.visibility = 'visible';
    
    card.addEventListener('click', (e) => {
      if (e.target === checkCircle || checkCircle.contains(e.target)) {
        return;
      }
      if (product.id) toggleAddon(product.id, checkCircle);
    });
    
    grid.appendChild(card);
  });
}

// Show boost modal (uses same modal infrastructure as addons)
async function showBoostModal() {
  ensureAddonsModal();
  
  // Load boost products if not already loaded
  if (!state.boostProducts || state.boostProducts.length === 0) {
    await loadBoostProducts();
  }
  
  populateBoostModal();
  updateAddonActionButton();
  
  // Show modal with subtle animation
  addonsModal.style.display = 'block';
  addonsModal.style.opacity = '0';
  addonsModal.style.transform = 'scale(0.95)';
  document.body.style.overflow = 'hidden';
  
  // Trigger animation after a brief moment
  requestAnimationFrame(() => {
    addonsModal.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    addonsModal.style.opacity = '1';
    addonsModal.style.transform = 'scale(1)';
  });
}

// Expose a small API to set the image dynamically if desired
// Usage: window.setAddonsUpsellImage('https://.../image.jpg')
// Image API removed

// Hide Boost from the step indicator permanently and toggle Boost step panel by selection
function applyConditionalSteps() {
  // 1) Hide Boost in the step indicator entirely (never shown)
  const boostStep = Array.from(document.querySelectorAll('.step .step-label'))
    .find((label) => label.textContent.trim() === 'Boost')?.closest('.step');
  if (boostStep) {
    boostStep.classList.add('hidden');
    // Hide adjacent connectors so the visual line doesn't have a dangling segment
    const prevConnector = boostStep.previousElementSibling;
    if (prevConnector && prevConnector.classList.contains('step-connector')) {
      prevConnector.classList.add('hidden');
    }
    const nextConnector = boostStep.nextElementSibling;
    // Keep the connector after Boost visible to bridge Access -> Send
    if (nextConnector && nextConnector.classList.contains('step-connector')) {
      nextConnector.classList.remove('hidden');
    }
  }

  // 2) Always hide Boost/Add-ons page (step 3) - disabled for now
  const boostPanel = document.getElementById('step-3');
  if (boostPanel) {
    boostPanel.style.display = 'none'; // Always hidden

    // If user is currently on step 3, move to the next visible step
    if (state.currentStep === 3) {
      nextStep();
    }
  }

  // Recompute indicator visuals after changes
  updateStepIndicator();
}

function init() {
  // Initialize email tracking from localStorage
  try {
    const storedEmails = JSON.parse(localStorage.getItem('boulders_created_emails') || '[]');
    storedEmails.forEach(email => {
      if (email && typeof email === 'string') {
        state.createdEmails.add(email.toLowerCase().trim());
      }
    });
    console.log('[Init] Loaded', state.createdEmails.size, 'previously created emails from localStorage');
  } catch (e) {
    console.warn('[Init] Could not load created emails from localStorage:', e);
  }
  
  // Initialize language (must be before API calls)
  initLanguageSwitcher();
  
  cacheDom();
  cacheTemplates();
  renderCatalog();
  refreshCarousels();
  updateCartSummary();
  initAuthModeToggle();
  updateCheckoutButton();
  setupEventListeners();
  // Apply conditional visibility for Boost on load
  applyConditionalSteps();
  updateStepIndicator();
  updateNavigationButtons();
  
  // Load gyms from API
  loadGymsFromAPI();
  
  // Load countries from API and populate country code selectors
  // Use setTimeout to ensure DOM is fully ready
  setTimeout(() => {
    loadCountriesFromAPI();
  }, 100);
  
  // Restore location button active state if location exists
  const locationBtn = document.getElementById('findNearestGym');
  if (locationBtn && userLocation) {
    locationBtn.classList.add('active');
  }
  
  // Initialize cookie banner
  initCookieBanner();
  
  // Check if consent already exists and load GTM if consented
  const existingConsent = getCookieConsent();
  if (existingConsent) {
    loadGTMIfConsented();
  }
  
  // Geolocation must be triggered by user gesture to avoid browser blocks.
  
  updateMainSubtitle();
  
  // Hide loading overlay and show main content
  hideLoadingOverlay();
}

// Hide loading overlay and show main content
function hideLoadingOverlay() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const mainContent = document.getElementById('mainContent');
  const headerContent = document.getElementById('headerContent');
  
  if (loadingOverlay) {
    // Show header and main content
    if (headerContent) {
      headerContent.style.display = '';
    }
    if (mainContent) {
      mainContent.style.display = '';
    }
    
    // Hide loading overlay with fade out
    loadingOverlay.classList.add('hidden');
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      if (loadingOverlay.parentNode) {
        loadingOverlay.remove();
      }
    }, 300);
  }
}


// Comprehensive translation system - using da-DK and en-GB to match API language codes
const translations = {
  'da-DK': {
    'step.homeGym': 'Hjemmehal', 'step.access': 'Adgang', 'step.boost': 'Boost', 'step.send': 'Send',
    'category.campaign': 'Kampagne', 'category.campaign.desc': 'Særlige tilbudsordninger og kampagner med begrænset varighed. Gør brug af disse eksklusive tilbud, mens de varer.', 'category.campaign.subtitle': 'Begrænsede tilbud', 'category.membership': 'Medlemskab', 'category.membership.subtitle': 'Løbende abonnement, ubegrænset adgang', 'category.15daypass': '15 Dages Klatring', 'category.15daypass.subtitle': 'Midlertidig adgangspas', 'category.punchcard': 'Klippekort', 'category.punchcard.subtitle': '10 indgange, delbart fysisk kort',
    'category.membership.desc': 'Medlemskab er et løbende abonnement med automatisk fornyelse. Ingen tilmelding eller opsigelsesgebyrer. Opsigelsesvarsel er resten af måneden + 1 måned.',
    'category.15daypass.desc': 'Få 15 dages ubegrænset adgang til alle haller. Perfekt til at prøve klatring eller et kortvarigt besøg.',
    'category.punchcard.desc': 'Du kan købe 1 type klippekort ad gangen. Hvert indgang bruger et klip på dit klippekort. Kortet er gyldigt i 5 år og giver ikke medlemsfordele. Genopfyld inden for 14 dage efter dit sidste klip og få 100 kr rabat i hallen.',
    'header.selectedGym': 'Valgt hal:', 'gym.headsUp': 'Hjemmehal valgt:', 'access.headsUp': 'Adgangstype valgt:',
    'main.subtitle.step1': 'Vælg din hjemmehal', 'main.subtitle.step1.secondary': 'Dette er hvor du primært træner − du får adgang til alle haller.',
    'main.subtitle.step2': 'Vælg din adgangstype', 'main.subtitle.step2.secondary': 'Vælg medlemskab hvis du klatrer mindst én gang om måneden.',
    'main.subtitle.step3': 'Vil du have pommes frites med?', 'main.subtitle.step4': 'Send',
    'button.next': 'Næste', 'button.back': 'Tilbage', 'button.continue': 'Fortsæt', 'button.skip': 'Spring over', 'button.complete': 'Færdig', 'button.edit': 'Rediger',
    'button.findNearest': 'Find nærmeste hal', 'button.searchGyms': 'Søg haller...', 'button.apply': 'Anvend', 'gym.nearest': 'Nærmeste',
    'form.email': 'E-mail*', 'form.email.placeholder': 'E-mail', 'form.password': 'Adgangskode*', 'form.password.placeholder': 'Adgangskode',
    'form.forgotPassword': 'Glemt adgangskode?', 'form.login': 'Log ind', 'form.createAccount': 'Opret konto', 'form.loggedInAs': 'Logget ind som', 'form.address': 'Adresse:',
    'form.firstName': 'Fornavn*', 'form.firstName.placeholder': 'Fornavn', 'form.lastName': 'Efternavn*', 'form.lastName.placeholder': 'Efternavn',
    'form.dateOfBirth': 'Fødselsdato*', 'form.streetAddress': 'Gade og husnummer*', 'form.streetAddress.placeholder': 'Gade og husnummer',
    'form.postalCode': 'Postnummer*', 'form.postalCode.placeholder': 'Postnummer', 'form.city': 'By', 'form.city.placeholder': 'Auto',
    'form.email.create': 'E-mail*', 'form.email.create.placeholder': 'Indtast din e-mail', 'form.country': 'Land', 'form.phoneNumber': 'Mobilnummer*',
    'form.phoneNumber.placeholder': '12345678', 'form.password.create': 'Adgangskode*', 'form.password.create.placeholder': 'Opret en adgangskode',
    'form.confirmPassword': 'Bekræft adgangskode*', 'form.confirmPassword.placeholder': 'Bekræft din adgangskode', 'form.saveAccount': 'Opret profil',
    'form.buyer': 'Køber', 'form.createProfile': 'NY PROFIL', 'form.parentGuardian': 'Forælder/Værge Information',
    'form.parentFullName': 'Fornavn og efternavn*', 'form.parentFullName.placeholder': 'Indtast dit fulde navn',
    'form.parentDateOfBirth': 'Fødselsdato*', 'form.parentStreetAddress': 'Gade og husnummer*', 'form.parentStreetAddress.placeholder': 'Indtast gade og husnummer',
    'form.parentPostalCode': 'Postnummer*', 'form.parentPostalCode.placeholder': '1234', 'form.parentCity': 'By', 'form.parentCity.placeholder': 'København',
    'form.parentEmail': 'E-mail*', 'form.parentEmail.placeholder': 'Indtast din e-mail', 'form.parentCountryCode': 'Land',
    'form.parentPhoneNumber': 'Mobilnummer*', 'form.parentPhoneNumber.placeholder': '12345678', 'form.sameAddress': 'Samme adresse og kontaktinformation',
    'form.error.firstName': 'Indtast venligst dit fornavn', 'form.error.lastName': 'Indtast venligst dit efternavn',
    'form.error.email': 'Indtast venligst en gyldig e-mailadresse',
    'form.resetPassword': 'NULSTIL ADGANGSKODE', 'form.resetPassword.desc': 'Indtast din e-mailadresse, og vi sender dig instruktioner til at nulstille din adgangskode.',
    'form.resetPassword.success': 'Nulstillingsinstruktioner er blevet sendt til din e-mail.', 'form.sendResetLink': 'SEND NULSTILLINGSLINK',
    'button.cancel': 'Annuller', 'button.close': 'Luk',
    'form.authSwitch.login': 'Log ind', 'form.authSwitch.createAccount': 'Opret konto',
    'cart.title': 'Kurv', 'cart.subtotal': 'Subtotal', 'cart.discount': 'Rabatkode', 'cart.discount.placeholder': 'Rabatkode', 'cart.discountAmount': 'Rabat', 'cart.discount.applied': 'Rabatkode anvendt!', 'cart.total': 'Total', 'cart.payNow': 'Betal nu', 'cart.monthlyFee': 'Månedlig betaling', 'cart.validUntil': 'Gyldig indtil',
    'cart.membershipDetails': 'Medlemskabsdetaljer', 'cart.membershipNumber': 'Medlemsnummer:', 'cart.membershipActivation': 'Medlemskabsaktivering og automatisk fornyelse', 'cart.memberName': 'Medlemsnavn:',
    'cart.period': 'Periode', 'cart.paymentMethod': 'Vælg betalingsmetode', 'cart.paymentRedirect': 'Du vil blive omdirigeret til vores sikre betalingsudbyder for at gennemføre din betaling.',
    'cart.consent.terms': 'Jeg accepterer <a href="#" data-action="open-terms" data-terms-type="terms" onclick="event.preventDefault();">Vilkår og Betingelser</a>',
    'cart.consent.marketing': 'Jeg vil gerne modtage marketing-e-mails. Læs vores <a href="#" data-action="open-terms" data-terms-type="privacy" onclick="event.preventDefault();">Datapolitik</a>.',
    'cart.cardPayment': 'Kortbetaling', 'cart.checkout': 'Til kassen', 'step4.completePurchase': 'Færdiggør dit køb',
    'step4.loginPrompt': 'Log ind på din eksisterende konto eller opret en ny.',
    'cart.boundUntil': 'bundet indtil', 'cart.billingPeriodConfirmed': 'Faktureringsperiode bekræftes efter køb.',
    'message.noProducts.membership': 'Ingen medlemskabsmuligheder tilgængelig på nuværende tidspunkt.',
    'message.noProducts.punchcard': 'Ingen klippekortmuligheder tilgængelig på nuværende tidspunkt.',
    'message.noProducts.15daypass': 'Ingen 15-dages muligheder tilgængelig på nuværende tidspunkt.',
    'footer.terms.title': 'Vilkår og Betingelser', 'footer.terms.all': 'Vilkår og Betingelser', 'footer.terms.membership': 'Vilkår og Betingelser for Medlemskab', 'footer.terms.punchcard': 'Vilkår og Betingelser for Klippekort',
    'footer.policies.title': 'Politikker', 'footer.policies.privacy': 'Privatlivspolitik', 'footer.policies.cookie': 'Cookiepolitik', 'footer.rights': 'Alle rettigheder forbeholdes', 'footer.copyright': '© 2026 Boulders. Alle rettigheder forbeholdes.',
    'cookie.banner.title': 'Vi bruger cookies', 'cookie.banner.description': 'Vi bruger cookies til at forbedre din browsingoplevelse, analysere trafik på sitet og personalisere indhold. Ved at klikke på "Accepter alle" giver du samtykke til vores brug af cookies. Du kan administrere dine præferencer eller læse mere i vores <a href="#" data-action="open-terms" data-terms-type="cookie" class="cookie-banner-link">Cookiepolitik</a>.', 'cookie.banner.accept': 'Accepter alle', 'cookie.banner.reject': 'Afvis alle', 'cookie.banner.settings': 'Tilpas',
    'cookie.settings.title': 'Cookie-indstillinger', 'cookie.settings.description': 'Administrer dine cookie-præferencer. Du kan aktivere eller deaktivere forskellige typer cookies nedenfor. Essentielle cookies kan ikke deaktiveres, da de er nødvendige for, at hjemmesiden fungerer.', 'cookie.settings.save': 'Gem præferencer', 'cookie.settings.button': 'Cookie-indstillinger',
    'cookie.category.essential.title': 'Essentielle Cookies', 'cookie.category.essential.desc': 'Disse cookies er nødvendige for, at hjemmesiden fungerer og kan ikke deaktiveres.',
    'cookie.category.analytics.title': 'Analyse Cookies', 'cookie.category.analytics.desc': 'Disse cookies hjælper os med at forstå, hvordan besøgende interagerer med vores hjemmeside ved at indsamle og rapportere information anonymt.',
    'cookie.category.marketing.title': 'Marketing Cookies', 'cookie.category.marketing.desc': 'Disse cookies bruges til at levere annoncer og spore kampagneeffektivitet.',
    'cookie.category.functional.title': 'Funktionelle Cookies', 'cookie.category.functional.desc': 'Disse cookies muliggør forbedret funktionalitet og personalisering, såsom at huske dine præferencer.',
    'addons.intro': 'Forbedre din klatreoplevelse med vores add-on produkter.',
    'terms.tab.membership': 'Medlemskab / 15 Dage', 'terms.tab.punchcard': 'Klippekort',
    'cart.empty': 'Din kurv er tom', 'homeGym.tooltip.title': 'Du får adgang til alle haller.', 'homeGym.tooltip.desc': 'Dette er hallen hvor du henter dit kort.', 'homeGym.label': 'Hjemmehal:',
    'search.noResults': 'Ingen haller fundet der matcher din søgning.',
  },
  'en-GB': {
    'step.homeGym': 'Home Gym', 'step.access': 'Access', 'step.boost': 'Boost', 'step.send': 'Send',
    'category.campaign': 'Campaign', 'category.campaign.desc': 'Special promotional offers and limited-time campaigns. Take advantage of these exclusive deals while they last.', 'category.campaign.subtitle': 'Limited time offers', 'category.membership': 'Membership', 'category.membership.subtitle': 'Ongoing subscription, unlimited access', 'category.15daypass': '15 Day Pass', 'category.15daypass.subtitle': 'Temporary access pass', 'category.punchcard': 'Punch Card', 'category.punchcard.subtitle': '10 entries, shareable physical card',
    'category.membership.desc': 'Membership is an ongoing subscription with automatic renewal. No signup or cancellation fees. Notice period is the rest of the month + 1 month.',
    'category.15daypass.desc': 'Get 15 days of unlimited access to all gyms. Perfect for trying out climbing or a short-term visit.',
    'category.punchcard.desc': 'You can buy 1 type of value card at a time. Each entry uses one clip on your value card. Card is valid for 5 years and does not include membership benefits. Refill within 14 days after your last clip and get 100 kr off at the gym.',
    'header.selectedGym': 'Selected Gym:', 'gym.headsUp': 'Home gym selected:', 'access.headsUp': 'Access type selected:',
    'main.subtitle.step1': 'Choose your home gym', 'main.subtitle.step1.secondary': 'This is where you will primarily train − you will have access to all gyms.',
    'main.subtitle.step2': 'Choose your access type', 'main.subtitle.step2.secondary': 'Choose membership if you climb at least once a month.',
    'main.subtitle.step3': 'Would you like fries with that?', 'main.subtitle.step4': 'Send',
    'button.next': 'Next', 'button.back': 'Back', 'button.continue': 'Continue', 'button.skip': 'Skip', 'button.complete': 'Complete', 'button.edit': 'Edit',
    'button.findNearest': 'Find nearest gym', 'button.searchGyms': 'Search gyms...', 'button.apply': 'Apply', 'gym.nearest': 'Nearest',
    'form.email': 'E-mail*', 'form.email.placeholder': 'E-mail', 'form.password': 'Password*', 'form.password.placeholder': 'Password',
    'form.forgotPassword': 'Forgot password?', 'form.login': 'Log in', 'form.createAccount': 'Create account', 'form.loggedInAs': 'Logged in as', 'form.address': 'Address:',
    'form.firstName': 'First name*', 'form.firstName.placeholder': 'First Name', 'form.lastName': 'Last name*', 'form.lastName.placeholder': 'Last name',
    'form.dateOfBirth': 'Date of birth*', 'form.streetAddress': 'Street and house number*', 'form.streetAddress.placeholder': 'Street and house nr',
    'form.postalCode': 'Postal code*', 'form.postalCode.placeholder': 'Zipcode', 'form.city': 'City', 'form.city.placeholder': 'Auto',
    'form.email.create': 'E-mail*', 'form.email.create.placeholder': 'Enter your email', 'form.country': 'Country', 'form.phoneNumber': 'Mobile number*',
    'form.phoneNumber.placeholder': '12345678', 'form.password.create': 'Password*', 'form.password.create.placeholder': 'Create a password',
    'form.confirmPassword': 'Confirm password*', 'form.confirmPassword.placeholder': 'Confirm your password', 'form.saveAccount': 'Save Account',
    'form.buyer': 'Buyer', 'form.createProfile': 'CREATE PROFILE', 'form.parentGuardian': 'Parent/Guardian Information',
    'form.parentFullName': 'First and last name*', 'form.parentFullName.placeholder': 'Enter your full name',
    'form.parentDateOfBirth': 'Date of birth*', 'form.parentStreetAddress': 'Street and house number*', 'form.parentStreetAddress.placeholder': 'Enter street and house number',
    'form.parentPostalCode': 'Postal code*', 'form.parentPostalCode.placeholder': '1234', 'form.parentCity': 'City', 'form.parentCity.placeholder': 'Copenhagen',
    'form.parentEmail': 'E-mail*', 'form.parentEmail.placeholder': 'Enter your email', 'form.parentCountryCode': 'Country',
    'form.parentPhoneNumber': 'Mobile number*', 'form.parentPhoneNumber.placeholder': '12345678', 'form.sameAddress': 'Same address and contact information',
    'form.error.firstName': 'Please enter your first name', 'form.error.lastName': 'Please enter your last name',
    'form.error.email': 'Please enter a valid email address',
    'form.resetPassword': 'RESET PASSWORD', 'form.resetPassword.desc': 'Enter your email address and we\'ll send you instructions to reset your password.',
    'form.resetPassword.success': 'Password reset instructions have been sent to your email.', 'form.sendResetLink': 'SEND RESET LINK',
    'button.cancel': 'Cancel', 'button.close': 'Close',
    'form.authSwitch.login': 'Login', 'form.authSwitch.createAccount': 'Create Account',
    'cart.title': 'Cart', 'cart.subtotal': 'Subtotal', 'cart.discount': 'Discount code', 'cart.discount.placeholder': 'Discount code', 'cart.discountAmount': 'Discount', 'cart.discount.applied': 'Discount code applied successfully!', 'cart.total': 'Total', 'cart.payNow': 'Pay now', 'cart.monthlyFee': 'Monthly payment', 'cart.validUntil': 'Valid until',
    'cart.membershipDetails': 'Membership Details', 'cart.membershipNumber': 'Membership Number:', 'cart.membershipActivation': 'Membership activation & auto-renewal setup', 'cart.memberName': 'Member Name:',
    'cart.period': 'Period', 'cart.paymentMethod': 'Choose payment method', 'cart.paymentRedirect': 'You will be redirected to our secure payment provider to complete your payment.',
    'cart.consent.terms': 'I accept the <a href="#" data-action="open-terms" data-terms-type="terms" onclick="event.preventDefault();">Terms and Conditions</a>',
    'cart.consent.marketing': 'I want to receive marketing emails. Read our <a href="#" data-action="open-terms" data-terms-type="privacy" onclick="event.preventDefault();">Data policy</a>.',
    'cart.cardPayment': 'Card payment', 'cart.checkout': 'Checkout', 'step4.completePurchase': 'Complete your purchase',
    'step4.loginPrompt': 'Log in to your existing account or create a new one.',
    'cart.boundUntil': 'bound until', 'cart.billingPeriodConfirmed': 'Billing period confirmed after checkout.',
    'message.noProducts.membership': 'No membership options available at this time.',
    'message.noProducts.punchcard': 'No punch card options available at this time.',
    'message.noProducts.15daypass': 'No 15 day pass options available at this time.',
    'footer.terms.title': 'Terms and Conditions', 'footer.terms.all': 'Terms and Conditions', 'footer.terms.membership': 'Terms and Conditions for Membership', 'footer.terms.punchcard': 'Terms and Conditions for Punch Card',
    'footer.policies.title': 'Policies', 'footer.policies.privacy': 'Privacy Policy', 'footer.policies.cookie': 'Cookie Policy', 'footer.rights': 'All rights reserved', 'footer.copyright': '© 2026 Boulders. All rights reserved.',
    'cookie.banner.title': 'We use cookies', 'cookie.banner.description': 'We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. By clicking "Accept All", you consent to our use of cookies. You can manage your preferences or learn more in our <a href="#" data-action="open-terms" data-terms-type="cookie" class="cookie-banner-link">Cookie Policy</a>.', 'cookie.banner.accept': 'Accept All', 'cookie.banner.reject': 'Reject All', 'cookie.banner.settings': 'Customize',
    'cookie.settings.title': 'Cookie Preferences', 'cookie.settings.description': 'Manage your cookie preferences. You can enable or disable different types of cookies below. Essential cookies cannot be disabled as they are necessary for the website to function.', 'cookie.settings.save': 'Save Preferences', 'cookie.settings.button': 'Cookie Settings',
    'cookie.category.essential.title': 'Essential Cookies', 'cookie.category.essential.desc': 'These cookies are necessary for the website to function and cannot be disabled.',
    'cookie.category.analytics.title': 'Analytics Cookies', 'cookie.category.analytics.desc': 'These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.',
    'cookie.category.marketing.title': 'Marketing Cookies', 'cookie.category.marketing.desc': 'These cookies are used to deliver advertisements and track campaign effectiveness.',
    'cookie.category.functional.title': 'Functional Cookies', 'cookie.category.functional.desc': 'These cookies enable enhanced functionality and personalization, such as remembering your preferences.',
    'addons.intro': 'Enhance your climbing experience with our add-on products.',
    'terms.tab.membership': 'Membership / 15 Day', 'terms.tab.punchcard': 'Punch Card',
    'cart.empty': 'Your cart is empty', 'homeGym.tooltip.title': 'You get access to all gyms.', 'homeGym.tooltip.desc': 'This is the gym where you pick up your card.', 'homeGym.label': 'Home Gym:',
    'search.noResults': 'No gyms found matching your search.',
  },
};

// Get translation for current language
function t(key, fallback = '') {
  const lang = state.language || DEFAULT_LANGUAGE;
  return translations[lang]?.[key] || translations[DEFAULT_LANGUAGE]?.[key] || fallback || key;
}

// Update all translations on the page
function updatePageTranslations() {
  const lang = state.language || DEFAULT_LANGUAGE;
  
  // Update elements with data-i18n-key attribute
  document.querySelectorAll('[data-i18n-key]').forEach(element => {
    const key = element.getAttribute('data-i18n-key');
    const translation = t(key);
    if (translation && translation !== key) {
      // Handle input placeholders
      if (element.tagName === 'INPUT') {
        if (element.hasAttribute('data-i18n-placeholder') || element.hasAttribute('placeholder') || key.includes('placeholder') || key.includes('searchGyms')) {
          element.placeholder = translation;
        } else {
          element.value = translation; // For input values
        }
      } else if (element.hasAttribute('data-i18n-title')) {
        // Handle title attributes
        element.title = translation;
      } else if (element.hasAttribute('data-i18n-aria-label')) {
        // Handle aria-label attributes
        element.setAttribute('aria-label', translation);
      } else if (element.tagName === 'BUTTON') {
        // Handle buttons - preserve SVG icons if present
        if (element.querySelector('svg')) {
          // Button with icon - update text but keep icon
          const textNodes = Array.from(element.childNodes).filter(node => 
            node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== ''
          );
          textNodes.forEach(node => node.remove());
          const icon = element.querySelector('svg');
          if (icon && icon.previousSibling) {
            // Insert before icon
            element.insertBefore(document.createTextNode(' ' + translation + ' '), icon);
          } else if (icon) {
            // Icon is first child, append text after
            element.appendChild(document.createTextNode(' ' + translation));
          } else {
            element.textContent = translation;
          }
        } else {
          element.textContent = translation;
        }
      } else {
        // Handle HTML content for elements that may contain links (like consent text)
        if (translation.includes('<a') || translation.includes('<span')) {
          element.innerHTML = translation;
        } else {
          element.textContent = translation;
        }
      }
    }
  });
  
  // Update elements with data-i18n-placeholder attribute (separate from data-i18n-key)
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    const translation = t(key);
    if (translation && translation !== key) {
      element.placeholder = translation;
    }
  });
  
  // Update cookie banner translations (needs special handling for HTML content)
  updateCookieBannerTranslations();
  
  // Update step labels
  const stepLabels = document.querySelectorAll('.step-label');
  stepLabels.forEach((label, index) => {
    const stepKeys = ['step.homeGym', 'step.access', 'step.boost', 'step.send'];
    if (stepKeys[index]) {
      label.textContent = t(stepKeys[index]);
    }
  });
  
  // Update category titles
  const categoryTitles = {
    'campaign': 'category.campaign',
    'membership': 'category.membership',
    '15daypass': 'category.15daypass',
    'punchcard': 'category.punchcard',
  };
  
  Object.entries(categoryTitles).forEach(([category, key]) => {
    const titleEl = document.querySelector(`[data-category="${category}"] .category-title`);
    if (titleEl) {
      titleEl.textContent = t(key);
    }
    
    const descEl = document.querySelector(`[data-category="${category}"] .category-description p`);
    if (descEl) {
      const descKey = `${key}.desc`;
      const desc = t(descKey);
      if (desc) {
        descEl.textContent = desc;
      }
    }
  });
  
  // Update main subtitles
  updateMainSubtitle();
  
  // Update navigation buttons
  updateNavigationButtons();
  
  // Update form labels and placeholders
  updateFormTranslations();
  
  // Update cart labels
  updateCartTranslations();
  
  // Update heads-up displays
  updateHeadsUpTranslations();
  
  // Update terms tabs if modal is open
  const termsTabs = document.querySelectorAll('.terms-tab[data-i18n-key]');
  termsTabs.forEach(tab => {
    const key = tab.getAttribute('data-i18n-key');
    if (key) {
      tab.textContent = t(key);
    }
  });
  
  console.log('[Translations] Page translations updated for language:', lang);
}

// Update form translations
function updateFormTranslations() {
  // Login form
  const emailLabel = document.querySelector('label[for="loginEmail"]');
  if (emailLabel && emailLabel.hasAttribute('data-i18n-key')) {
    emailLabel.textContent = t('form.email');
  }
  
  const emailInput = document.getElementById('loginEmail');
  if (emailInput && emailInput.hasAttribute('data-i18n-placeholder')) {
    emailInput.placeholder = t('form.email.placeholder');
  }
  
  const passwordLabel = document.querySelector('label[for="loginPassword"]');
  if (passwordLabel && passwordLabel.hasAttribute('data-i18n-key')) {
    passwordLabel.textContent = t('form.password');
  }
  
  const passwordInput = document.getElementById('loginPassword');
  if (passwordInput && passwordInput.hasAttribute('data-i18n-placeholder')) {
    passwordInput.placeholder = t('form.password.placeholder');
  }
  
  const forgotPasswordLink = document.querySelector('[data-action="forgot-password"]');
  if (forgotPasswordLink && forgotPasswordLink.hasAttribute('data-i18n-key')) {
    forgotPasswordLink.textContent = t('form.forgotPassword');
  }
  
  // Registration form fields
  const formFields = [
    { id: 'firstName', labelKey: 'form.firstName', placeholderKey: 'form.firstName.placeholder' },
    { id: 'lastName', labelKey: 'form.lastName', placeholderKey: 'form.lastName.placeholder' },
    { id: 'dateOfBirth', labelKey: 'form.dateOfBirth' },
    { id: 'streetAddress', labelKey: 'form.streetAddress', placeholderKey: 'form.streetAddress.placeholder' },
    { id: 'postalCode', labelKey: 'form.postalCode', placeholderKey: 'form.postalCode.placeholder' },
    { id: 'city', labelKey: 'form.city', placeholderKey: 'form.city.placeholder' },
    { id: 'email', labelKey: 'form.email.create', placeholderKey: 'form.email.create.placeholder' },
    { id: 'phoneNumber', labelKey: 'form.phoneNumber', placeholderKey: 'form.phoneNumber.placeholder' },
    { id: 'password', labelKey: 'form.password.create', placeholderKey: 'form.password.create.placeholder' },
  ];
  
  formFields.forEach(field => {
    const label = document.querySelector(`label[for="${field.id}"]`);
    if (label && label.hasAttribute('data-i18n-key')) {
      label.textContent = t(field.labelKey);
    }
    
    if (field.placeholderKey) {
      const input = document.getElementById(field.id);
      if (input && input.hasAttribute('data-i18n-placeholder')) {
        input.placeholder = t(field.placeholderKey);
      }
    }
  });
  
  // Parent/Guardian form fields
  const parentFields = [
    { id: 'parentFullName', labelKey: 'form.parentFullName', placeholderKey: 'form.parentFullName.placeholder' },
    { id: 'parentDateOfBirth', labelKey: 'form.parentDateOfBirth' },
    { id: 'parentStreetAddress', labelKey: 'form.parentStreetAddress', placeholderKey: 'form.parentStreetAddress.placeholder' },
    { id: 'parentPostalCode', labelKey: 'form.parentPostalCode', placeholderKey: 'form.parentPostalCode.placeholder' },
    { id: 'parentCity', labelKey: 'form.parentCity', placeholderKey: 'form.parentCity.placeholder' },
    { id: 'parentEmail', labelKey: 'form.parentEmail', placeholderKey: 'form.parentEmail.placeholder' },
    { id: 'parentPhoneNumber', labelKey: 'form.parentPhoneNumber', placeholderKey: 'form.parentPhoneNumber.placeholder' },
    { id: 'parentPassword', labelKey: 'form.password.create', placeholderKey: 'form.password.create.placeholder' },
  ];
  
  parentFields.forEach(field => {
    const label = document.querySelector(`label[for="${field.id}"]`);
    if (label && label.hasAttribute('data-i18n-key')) {
      label.textContent = t(field.labelKey);
    }
    
    if (field.placeholderKey) {
      const input = document.getElementById(field.id);
      if (input && input.hasAttribute('data-i18n-placeholder')) {
        input.placeholder = t(field.placeholderKey);
      }
    }
  });
  
  // Error messages
  const errorMessages = document.querySelectorAll('.error-message[data-i18n-key]');
  errorMessages.forEach(error => {
    const key = error.getAttribute('data-i18n-key');
    if (key) {
      error.textContent = t(key);
    }
  });
  
  // Buttons and other elements
  const loginStatusLabel = document.querySelector('.login-status-label');
  if (loginStatusLabel) loginStatusLabel.textContent = t('form.loggedInAs');
  
  const addressLabel = document.querySelector('.profile-detail-label');
  if (addressLabel && (addressLabel.textContent.includes('Address') || addressLabel.textContent.includes('Adresse'))) {
    addressLabel.textContent = t('form.address');
  }
  
  // Save account button
  const saveAccountBtn = document.querySelector('.save-account-btn[data-i18n-key]');
  if (saveAccountBtn) {
    saveAccountBtn.textContent = t('form.saveAccount');
  }
  
  // Login button
  const loginBtn = document.querySelector('.login-btn[data-i18n-key="form.login"]');
  if (loginBtn) {
    loginBtn.textContent = t('form.login').toUpperCase();
  }
  
  // Discount code placeholder is handled by data-i18n-placeholder attribute
  
  // Update apply button
  const applyDiscountBtn = document.querySelector('.apply-discount-btn');
  if (applyDiscountBtn && applyDiscountBtn.hasAttribute('data-i18n-key')) {
    applyDiscountBtn.textContent = t('button.apply');
  }
  
  // Forgot password modal
  const resetPasswordTitle = document.querySelector('#forgotPasswordModal .info-section-title[data-i18n-key="form.resetPassword"]');
  if (resetPasswordTitle) {
    resetPasswordTitle.textContent = t('form.resetPassword');
  }
  
  const resetPasswordDesc = document.querySelector('.forgot-password-description[data-i18n-key]');
  if (resetPasswordDesc) {
    resetPasswordDesc.textContent = t('form.resetPassword.desc');
  }
  
  const resetPasswordSuccess = document.querySelector('.forgot-password-success-message[data-i18n-key]');
  if (resetPasswordSuccess) {
    resetPasswordSuccess.textContent = t('form.resetPassword.success');
  }
  
  const sendResetLinkBtn = document.querySelector('.login-btn[data-i18n-key="form.sendResetLink"]');
  if (sendResetLinkBtn) {
    sendResetLinkBtn.textContent = t('form.sendResetLink');
  }
  
  const cancelBtn = document.querySelector('.forgot-password-cancel-btn[data-i18n-key]');
  if (cancelBtn) {
    cancelBtn.textContent = t('button.cancel');
  }
  
  const closeBtn = document.querySelector('.login-btn[data-i18n-key="button.close"]');
  if (closeBtn) {
    closeBtn.textContent = t('button.close');
  }
}

// Update cart translations
function updateCartTranslations() {
  // Cart title
  const cartTitle = document.querySelector('.summary-title[data-i18n-key="cart.title"]');
  if (cartTitle) {
    cartTitle.textContent = t('cart.title');
  }
  
  // Discount section
  const discountToggle = document.querySelector('.discount-toggle span[data-i18n-key="cart.discount"]');
  if (discountToggle) {
    discountToggle.textContent = t('cart.discount');
  }
  
  const discountInput = document.querySelector('.discount-input[data-i18n-placeholder]');
  if (discountInput) {
    discountInput.placeholder = t('cart.discount.placeholder');
  }
  
  // Payment method section
  const paymentTitle = document.querySelector('.payment-title[data-i18n-key]');
  if (paymentTitle) {
    paymentTitle.textContent = t('cart.paymentMethod');
  }
  
  const paymentRedirect = document.querySelector('.payment-methods p[data-i18n-key]');
  if (paymentRedirect) {
    paymentRedirect.textContent = t('cart.paymentRedirect');
  }
  
  // Card payment label
  const cardPaymentLabel = document.querySelector('#cardPayment + label span[data-i18n-key="cart.cardPayment"]');
  if (cardPaymentLabel) {
    cardPaymentLabel.textContent = t('cart.cardPayment');
  }
  
  // Checkout button
  const checkoutBtn = document.querySelector('.checkout-btn[data-i18n-key]');
  if (checkoutBtn) {
    checkoutBtn.textContent = t('cart.checkout');
  }
  
  // Consent checkboxes
  const termsConsent = document.querySelector('.consent-checkbox .consent-text[data-i18n-key="cart.consent.terms"]');
  if (termsConsent) {
    // Handle HTML content with links
    const termsHtml = t('cart.consent.terms');
    termsConsent.innerHTML = termsHtml;
  }
  
  const marketingConsent = document.querySelector('.consent-checkbox .consent-text[data-i18n-key="cart.consent.marketing"]');
  if (marketingConsent) {
    const marketingHtml = t('cart.consent.marketing');
    marketingConsent.innerHTML = marketingHtml;
  }
  
  // Payment overview labels are handled by data-i18n-key attributes in HTML
  // Cart labels are updated dynamically in updateCartSummary and updatePaymentOverview
}

// Update heads-up displays
function updateHeadsUpTranslations() {
  const gymHeadsUpLabel = document.querySelector('.gym-heads-up-label');
  if (gymHeadsUpLabel) gymHeadsUpLabel.textContent = t('gym.headsUp');
  
  const accessHeadsUpLabel = document.querySelector('.access-heads-up-label');
  if (accessHeadsUpLabel) accessHeadsUpLabel.textContent = t('access.headsUp');
  
  const selectedGymLabel = document.querySelector('.selected-gym-label');
  if (selectedGymLabel) selectedGymLabel.textContent = t('header.selectedGym');
}

// Change language and reload products
async function changeLanguage(languageCode) {
  if (!SUPPORTED_LANGUAGES[languageCode]) {
    console.warn('[Language] Unsupported language code:', languageCode);
    return;
  }
  
  // Update state and storage
  state.language = languageCode;
  setStoredLanguage(languageCode);
  
  // Update HTML lang attribute
  document.documentElement.lang = languageCode.split('-')[0]; // 'da-DK' -> 'da'
  
  // Update language switcher UI
  updateLanguageSwitcherUI();
  
  // Update all page translations
  updatePageTranslations();
  
  // Reload products if we're on step 2 or later
  if (state.currentStep >= 2 && state.selectedBusinessUnit) {
    console.log('[Language] Reloading products with language:', languageCode);
    // Clear cached products to force fresh fetch
    state.subscriptions = [];
    state.campaignSubscriptions = [];
    state.dayPassSubscriptions = [];
    state.valueCards = [];
    await loadProductsFromAPI();
    renderProductsFromAPI();
  }
  
  // Reload gyms if we're on step 1
  if (state.currentStep === 1) {
    console.log('[Language] Reloading gyms with language:', languageCode);
    await loadGymsFromAPI();
  }
}

// Update language switcher UI to show active language
function updateLanguageSwitcherUI() {
  const switcher = document.getElementById('languageSwitcher');
  if (!switcher) return;
  
  const buttons = switcher.querySelectorAll('.language-btn');
  buttons.forEach(btn => {
    const langCode = btn.dataset.lang;
    if (langCode === state.language) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  });
}

// Initialize language switcher
function initLanguageSwitcher() {
  const switcher = document.getElementById('languageSwitcher');
  if (!switcher) return;
  
  // Set initial language
  const currentLang = state.language || DEFAULT_LANGUAGE;
  document.documentElement.lang = currentLang.split('-')[0];
  updateLanguageSwitcherUI();
  
  // Update page translations on initial load
  updatePageTranslations();
  
  // Add click handlers to language buttons
  const buttons = switcher.querySelectorAll('.language-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const langCode = btn.dataset.lang;
      if (langCode && langCode !== state.language) {
        await changeLanguage(langCode);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize language switcher (must be early to set language before API calls)
  initLanguageSwitcher();
  
  // Set up cookie settings button (ensure it works even if footer loads late)
  setupCookieSettingsButton();
  
  // Check URL parameters for test mode and payment return
  const urlParams = new URLSearchParams(window.location.search);
  const testSuccess = urlParams.get('testSuccess') === 'true';
  const testProductType = urlParams.get('testProductType') || 'membership'; // membership, 15daypass, punch-card
  const paymentReturn = urlParams.get('payment');
  const paymentStatus = urlParams.get('status'); // Check for payment status (cancelled, failed, etc.)
  const paymentError = urlParams.get('error'); // Check for payment error (can be 'cancelled' or numeric error code like '205')
  
  if (testSuccess) {
    console.log('[Test Mode] Test success page mode enabled for product type:', testProductType);
    // Store test mode in state
    state.testMode = true;
    state.testProductType = testProductType;
  }
  let orderId = urlParams.get('orderId');
  let isPaymentReturnFlow = false;
  
  // Fix: Payment provider may append /confirmation to orderId
  // Extract just the numeric part (e.g., "817247/confirmation" -> "817247")
  if (orderId) {
    // Remove any path segments after the order ID
    orderId = orderId.split('/')[0].trim();
    // Ensure it's a valid number
    const numericOrderId = parseInt(orderId, 10);
    if (isNaN(numericOrderId)) {
      console.warn('[Payment Return] Invalid order ID:', orderId);
      orderId = null;
    } else {
      orderId = numericOrderId.toString();
      isPaymentReturnFlow = paymentReturn === 'return' && !!orderId;
    }
  }
  
  if (!isPaymentReturnFlow) {
    clearStoredOrderData('page-refresh');
  }
  
  if (paymentReturn === 'return' && orderId) {
    // We're returning from payment - show confirmation instead of resetting
    console.log('[Payment Return] Detected payment return for order:', orderId);
    // Set order ID in state if available
    state.orderId = parseInt(orderId, 10);
    // Skip normal init and go straight to confirmation
    // We'll still call init but then immediately show confirmation
  }
  
  init();
  
  // If in test mode, navigate directly to success page
  if (testSuccess) {
    console.log('[Test Mode] Navigating to success page for testing');
    state.currentStep = TOTAL_STEPS;
    
    // Set up test mode data immediately
    const productType = testProductType;
    console.log('[Test Mode] Creating mock order data for testing:', productType);
    
    // Create mock order data for testing
    state.order = {
      number: 'TEST-12345',
      date: new Date(),
      items: [
        { name: productType === 'membership' ? 'Membership' : productType === '15daypass' ? '15 Day Pass' : 'Punch Card', amount: 469 }
      ],
      total: 469,
      memberName: 'Test User',
      membershipNumber: 'TEST-12345',
      membershipType: productType === 'membership' ? 'Medlemskab' : productType === '15daypass' ? '15 Day Pass' : 'Punch Card',
      primaryGym: 'Boulders Aarhus Nord',
      membershipPrice: 469,
    };
    state.orderId = 'TEST-12345';
    
    // Set product type for test mode - ensure state is set correctly
    state.testMode = true;
    state.testProductType = productType;
    state.paymentConfirmed = true; // Set payment confirmed for test mode
    state.paymentFailed = false;
    state.paymentPending = false;
    
    // Set product type for test mode
    if (productType === 'punch-card') {
      state.selectedProductType = 'punch-card';
      // Mock value card items with price
      state.fullOrder = {
        valueCardItems: [{
          quantity: 2,
          product: { name: 'Klippekort', productLabels: [] },
          valueCard: { number: '12345', numberOfPassages: 10 },
          price: { amount: 46900 } // 469.00 DKK in cents
        }]
      };
    } else if (productType === '15daypass') {
      state.selectedProductType = 'membership';
      state.membershipPlanId = '15daypass-123';
      // Mock subscription items with 15 day pass label and price
      state.fullOrder = {
        subscriptionItems: [{
          product: {
            name: '15 Day Pass',
            productLabels: [{ name: '15 Day Pass' }]
          },
          price: { amount: 46900 } // 469.00 DKK in cents
        }]
      };
    } else {
      // Default to membership
      state.selectedProductType = 'membership';
      state.membershipPlanId = 'membership-123';
      // Mock subscription items with price
      state.fullOrder = {
        subscriptionItems: [{
          product: {
            name: 'Medlemskab',
            productLabels: [{ name: 'Public' }]
          },
          price: { amount: 46900 } // 469.00 DKK in cents
        }]
      };
    }
    
    console.log('[Test Mode] Mock data created:', {
      productType: productType,
      selectedProductType: state.selectedProductType,
      membershipPlanId: state.membershipPlanId,
      hasValueCardItems: !!(state.fullOrder?.valueCardItems?.length),
      hasSubscriptionItems: !!(state.fullOrder?.subscriptionItems?.length)
    });
    
    // Show step and render confirmation
    showStep(TOTAL_STEPS);
    updateStepIndicator();
    updateNavigationButtons();
    updateMainSubtitle();
    
    // Render confirmation view after a short delay to ensure DOM is ready
    setTimeout(() => {
      renderConfirmationView();
    }, 100);
    
    return; // Skip payment return flow
  }
  
  // If returning from payment, fetch order data and show confirmation view
  if (paymentReturn === 'return' && orderId) {
    // TEST MODE: Force failure for testing (add ?test=fail to URL)
    const testMode = urlParams.get('test');
    if (testMode === 'fail') {
      console.log('[Payment Return] TEST MODE: Simulating payment failure');
      showPaymentFailedMessage(null, parseInt(orderId, 10), null); // Use default calm message
      return;
    }
    
    // Always load order first; error params are handled after we verify payment state
    loadOrderForConfirmation(parseInt(orderId, 10));
  }
  
  // Step 6: Validate tokens on app load
  validateTokensOnLoad();
  
  // Restore authenticated state from stored tokens (if available)
  syncAuthenticatedCustomerState();
  
  // Initialize header auth indicator after state sync
  // Use setTimeout to ensure syncAuthenticatedCustomerState completes first
  setTimeout(() => {
    refreshHeaderAuthIndicator();
  }, 100);
  
  // Listen for storage events (cross-tab synchronization)
  // If tokens are saved/cleared in another tab, update the header
  window.addEventListener('storage', (e) => {
    if (e.key === 'boulders_auth_tokens') {
      // Tokens were changed in another tab
      setTimeout(() => {
        refreshHeaderAuthIndicator();
      }, 100);
    }
  });
});


// Re-initialize form scrolling on window resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    setupFormFieldScrolling();
  }, 250);
});

function cacheDom() {
  DOM.stepPanels = Array.from(document.querySelectorAll('.step-panel'));
  DOM.stepCircles = Array.from(document.querySelectorAll('.step-circle'));
  DOM.stepConnectors = Array.from(document.querySelectorAll('.step-connector'));
  DOM.prevBtn = document.getElementById('prevBtn');
  DOM.nextBtn = document.getElementById('nextBtn');
  DOM.mainSubtitle = document.getElementById('mainSubtitle');
  DOM.mainTitle = document.querySelector('.main-title');
  DOM.membershipPlans = document.querySelector('[data-component="membership-plans"]');
  DOM.valuePlans = document.querySelector('[data-component="value-plans"]');
  DOM.singlePlanSection = document.getElementById('singlePlans');
  DOM.valuePlanSection = document.getElementById('quantityPlans');
  DOM.singleCarousel = document.getElementById('singleChoiceMode');
  DOM.valueCarousel = document.getElementById('quantityMode');
  DOM.toggleButtons = Array.from(document.querySelectorAll('.toggle-btn'));
  DOM.categoryToggle = document.querySelector('.category-toggle');
  DOM.addonPlans = document.querySelector('[data-component="addon-plans"]');
  DOM.valueCardPunches = document.querySelector('[data-value-card-punches]');
  DOM.valueCardContinueBtn = document.querySelector('[data-action="continue-value-cards"]');
  DOM.valueCardEntryLabel = document.querySelector('[data-entry-label]');
  DOM.cartItems = document.querySelector('[data-component="cart-items"]');
  DOM.paymentOverview = document.querySelector('.payment-overview');
  DOM.payNow = document.querySelector('[data-summary-field="pay-now"]');
  DOM.monthlyPayment = document.querySelector('[data-summary-field="monthly-payment"]');
  DOM.paymentDiscount = document.querySelector('[data-summary-field="discount-amount"]');
  DOM.paymentBillingPeriod = document.querySelector('[data-summary-field="payment-billing-period"]');
  DOM.paymentBoundUntil = document.querySelector('[data-summary-field="payment-bound-until"]');
  DOM.checkoutBtn = document.querySelector('[data-action="submit-checkout"]');
  DOM.termsConsent = document.getElementById('termsConsent');
  DOM.discountToggle = document.querySelector('.discount-toggle');
  DOM.discountForm = document.querySelector('.discount-form');
  DOM.discountInput = document.querySelector('.discount-input');
  DOM.applyDiscountBtn = document.querySelector('.apply-discount-btn');
  DOM.discountDisplay = document.querySelector('[data-discount-display]');
  DOM.skipAddonsBtn = document.getElementById('skipAddons');
  DOM.backFromAddonsBtn = document.getElementById('backFromAddons');
  DOM.paymentOptions = Array.from(document.querySelectorAll('input[name="paymentMethod"]'));
  DOM.cardPaymentForm = document.getElementById('cardPaymentForm');
  DOM.parentGuardianToggle = document.getElementById('parentGuardian');
  DOM.parentGuardianForm = document.getElementById('parentGuardianForm');
  DOM.parentGuardianReminder = document.querySelector('[data-role="parent-guardian-reminder"]');
  DOM.sameAddressToggle = document.getElementById('sameAddressToggle');
  DOM.loginForm = document.querySelector('.login-form');
  DOM.loginEmail = document.getElementById('loginEmail');
  DOM.loginPassword = document.getElementById('loginPassword');
  DOM.loginButton = DOM.loginForm?.querySelector('.login-btn');
  DOM.loginButtonDefaultText = DOM.loginButton?.textContent?.trim() || 'Log in';
  DOM.loginStatus = document.querySelector('[data-login-status]');
  DOM.loginStatusEmail = document.querySelector('[data-auth-email]');
  DOM.loginStatusName = document.querySelector('[data-auth-name]');
  DOM.loginStatusDob = document.querySelector('[data-auth-dob]');
  DOM.loginStatusAddress = document.querySelector('[data-auth-address]');
  DOM.loginStatusPhone = document.querySelector('[data-auth-phone]');
  DOM.loginStatusNameRow = document.querySelector('[data-auth-name-row]');
  DOM.loginStatusDobRow = document.querySelector('[data-auth-dob-row]');
  DOM.loginStatusEmailRow = document.querySelector('[data-auth-email-row]');
  DOM.loginStatusAddressRow = document.querySelector('[data-auth-address-row]');
  DOM.loginStatusPhoneRow = document.querySelector('[data-auth-phone-row]');
  DOM.loginFormContainer = document.querySelector('[data-login-form-container]');
  // Find form-container that contains login-status (parent of login-status)
  DOM.loginFormContainerWrapper = DOM.loginStatus?.closest('.form-container');
  DOM.authModeToggle = null; // Removed - using button in form instead
  DOM.forgotPasswordLink = document.querySelector('[data-action="forgot-password"]');
  DOM.forgotPasswordModal = document.getElementById('forgotPasswordModal');
  DOM.forgotPasswordForm = document.getElementById('forgotPasswordForm');
  DOM.forgotPasswordEmail = document.getElementById('forgotPasswordEmail');
  DOM.forgotPasswordSuccess = document.getElementById('forgotPasswordSuccess');
  DOM.confirmationItems = document.querySelector('[data-component="confirmation-items"]');
  // Terms modal
  DOM.termsModal = document.getElementById('termsModal');
  DOM.termsModalTitle = document.getElementById('termsModalTitle');
  DOM.termsModalContent = document.getElementById('termsModalContent');
  DOM.termsModalLoading = document.getElementById('termsModalLoading');
  DOM.termsModalClose = document.getElementById('termsModalClose');
  DOM.termsModalTabs = document.getElementById('termsModalTabs');
  DOM.termsModalSearch = document.getElementById('termsModalSearch');
  DOM.termsSearchInput = document.getElementById('termsSearchInput');
  DOM.termsSearchClear = document.getElementById('termsSearchClear');
  
  // Store original content for search
  state.termsOriginalContent = null;
  
  // Data Policy modal
  DOM.dataPolicyModal = document.getElementById('dataPolicyModal');
  DOM.dataPolicyModalContent = document.getElementById('dataPolicyModalContent');
  DOM.dataPolicyModalLoading = document.getElementById('dataPolicyModalLoading');
  DOM.dataPolicyModalClose = document.getElementById('dataPolicyModalClose');
  DOM.dataPolicyModalLangDa = document.getElementById('dataPolicyModalLangDa');
  DOM.dataPolicyModalLangEn = document.getElementById('dataPolicyModalLangEn');
  
  // Store current modal state
  state.currentModalType = null;
  state.currentModalTab = null;
  // Postal code and city fields for auto-fill
  DOM.postalCode = document.getElementById('postalCode');
  DOM.city = document.getElementById('city');
  DOM.parentPostalCode = document.getElementById('parentPostalCode');
  DOM.parentCity = document.getElementById('parentCity');
  DOM.confirmationFields = {
    orderNumber: document.querySelector('[data-summary-field="order-number"]'),
    orderDate: document.querySelector('[data-summary-field="order-date"]'),
    orderTotal: document.querySelector('[data-summary-field="order-total"]'),
    memberName: document.querySelector('[data-summary-field="member-name"]'),
    membershipNumber: document.querySelector('[data-summary-field="membership-number"]'),
    membershipType: document.querySelector('[data-summary-field="membership-type"]'),
    primaryGym: document.querySelector('[data-summary-field="primary-gym"]'),
    membershipPrice: document.querySelector('[data-summary-field="membership-price"]'),
  };

  refreshLoginUI();
}

function cacheTemplates() {
  templates.membership = document.getElementById('membership-plan-template');
  templates.valueCard = document.getElementById('value-card-template');
  templates.addon = document.getElementById('addon-card-template');
  templates.cartItem = document.getElementById('cart-item-template');
  templates.confirmationItem = document.getElementById('confirmation-item-template');
}

function setupEventListeners() {
  DOM.nextBtn?.addEventListener('click', nextStep);
  DOM.prevBtn?.addEventListener('click', prevStep);
  DOM.discountToggle?.addEventListener('click', toggleDiscountForm);
  DOM.applyDiscountBtn?.addEventListener('click', handleApplyDiscount);
  DOM.discountInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleApplyDiscount();
    }
  });
  DOM.sameAddressToggle?.addEventListener('change', handleSameAddressToggle);
  DOM.parentGuardianToggle?.addEventListener('change', handleParentGuardianToggle);
  DOM.termsConsent?.addEventListener('change', updateCheckoutButton);

  // Postal code auto-fill event listeners
  setupPostalCodeAutoFill();

  // Gym selection event listeners will be set up dynamically when gyms are loaded

  // Search functionality
  const gymSearch = document.getElementById('gymSearch');
  gymSearch?.addEventListener('input', handleGymSearch);
  
  // Location button
  const findNearestGymBtn = document.getElementById('findNearestGym');
  findNearestGymBtn?.addEventListener('click', (e) => {
    findNearestGym();
  });



  DOM.toggleButtons?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category ?? 'single';
      handleCategoryToggle(category);
    });
  });

  // New category and plan selection functionality
  setupNewAccessStep();

  if (DOM.paymentOptions.length) {
    DOM.paymentOptions.forEach((option) => {
      option.addEventListener('change', handlePaymentChange);
    });
  }

  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('input', handleGlobalInput);

  const cardNumber = document.getElementById('cardNumber');
  const expiryDate = document.getElementById('expiryDate');
  const cvv = document.getElementById('cvv');

  cardNumber?.addEventListener('input', formatCardNumber);
  expiryDate?.addEventListener('input', formatExpiryDate);
  cvv?.addEventListener('input', stripNonDigits);
  
  // Setup form field scrolling for mobile
  setupFormFieldScrolling();
  
  // Ensure form fields get focused when clicked
  setupFormFieldFocus();
  
  // Setup save account button validation
  setupSaveAccountButtonValidation();

  if (DOM.loginForm) {
    DOM.loginForm.addEventListener('submit', handleLoginSubmit);
  }
  
  // Forgot password handlers
  if (DOM.forgotPasswordLink) {
    DOM.forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      openForgotPasswordModal();
    });
  }
  
  // Close forgot password modal handlers
  document.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'close-forgot-password') {
      closeForgotPasswordModal();
    }
  });
  
  // Close modal when clicking outside
  if (DOM.forgotPasswordModal) {
    DOM.forgotPasswordModal.addEventListener('click', (e) => {
      if (e.target === DOM.forgotPasswordModal) {
        closeForgotPasswordModal();
      }
    });
  }
  
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.forgotPasswordModal && DOM.forgotPasswordModal.style.display === 'flex') {
      closeForgotPasswordModal();
    }
  });
  
  // Forgot password form submission
  if (DOM.forgotPasswordForm) {
    DOM.forgotPasswordForm.addEventListener('submit', handleForgotPasswordSubmit);
  }
  
  // Terms modal handlers
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="open-terms"]')) {
      e.preventDefault();
      const termsType = e.target.closest('[data-action="open-terms"]').dataset.termsType;
      if (termsType === 'privacy') {
        openDataPolicyModal();
      } else if (termsType === 'terms') {
        openTermsModal('terms');
      } else if (termsType === 'membership' || termsType === 'punchcard') {
        // Open terms modal with tabs and select the appropriate tab
        openTermsModal('terms');
        // Small delay to ensure modal is open before switching tab
        setTimeout(() => {
          switchTermsTab(termsType);
        }, 100);
      } else {
        openTermsModal(termsType);
      }
    }
    
    // Tab switching in terms modal
    if (e.target.closest('.terms-tab')) {
      const tab = e.target.closest('.terms-tab');
      const tabType = tab.dataset.tab;
      switchTermsTab(tabType);
    }
    
    // Language switching in data policy modal
    if (e.target.closest('#dataPolicyModalLangDa') || e.target.closest('#dataPolicyModalLangEn')) {
      const langBtn = e.target.closest('.language-btn');
      const lang = langBtn.dataset.lang;
      switchModalLanguage('privacy', lang);
    }
    
    // Search clear button
    if (e.target.closest('#termsSearchClear')) {
      clearTermsSearch();
    }
    
    if (e.target === DOM.termsModalClose || e.target.closest('#termsModalClose')) {
      closeTermsModal();
    }
    
    if (e.target === DOM.dataPolicyModalClose || e.target.closest('#dataPolicyModalClose')) {
      closeDataPolicyModal();
    }
  });
  
  // Search input live update
  if (DOM.termsSearchInput) {
    DOM.termsSearchInput.addEventListener('input', (e) => {
      performTermsSearch(e.target.value);
    });
    
    // Handle Enter key to prevent form submission
    DOM.termsSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    });
  }
  
  // Close terms modal when clicking outside
  if (DOM.termsModal) {
    DOM.termsModal.addEventListener('click', (e) => {
      if (e.target === DOM.termsModal) {
        closeTermsModal();
      }
    });
  }
  
  // Close data policy modal when clicking outside
  if (DOM.dataPolicyModal) {
    DOM.dataPolicyModal.addEventListener('click', (e) => {
      if (e.target === DOM.dataPolicyModal) {
        closeDataPolicyModal();
      }
    });
  }
  
  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOM.termsModal && DOM.termsModal.style.display !== 'none') {
        closeTermsModal();
      }
      if (DOM.dataPolicyModal && DOM.dataPolicyModal.style.display !== 'none') {
        closeDataPolicyModal();
      }
      const receiptModal = document.getElementById('detailedReceiptModal');
      if (receiptModal && receiptModal.style.display !== 'none') {
        closeDetailedReceipt();
      }
    }
  });
  
  // Close receipt modal when clicking outside
  const receiptModal = document.getElementById('detailedReceiptModal');
  if (receiptModal) {
    receiptModal.addEventListener('click', (e) => {
      if (e.target === receiptModal) {
        closeDetailedReceipt();
      }
    });
  }
}

function setLoginLoadingState(isLoading) {
  if (!DOM.loginButton) return;
  const defaultText = DOM.loginButtonDefaultText || DOM.loginButton.textContent || 'Log in';
  DOM.loginButton.disabled = isLoading;
  DOM.loginButton.classList.toggle('is-loading', isLoading);
  DOM.loginButton.textContent = isLoading ? 'Logging in...' : defaultText;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (state.loginInProgress) {
    return;
  }

  // Check for login cooldown (rate limiting)
  const now = Date.now();
  const cooldownUntil = loginCooldownUntil || (typeof window !== 'undefined' && window.loginCooldownUntil) || 0;
  if (now < cooldownUntil) {
    const secondsLeft = Math.ceil((cooldownUntil - now) / 1000);
    const minutesLeft = Math.floor(secondsLeft / 60);
    const remainingSeconds = secondsLeft % 60;
    const cooldownMessage = minutesLeft > 0
      ? `${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}${remainingSeconds > 0 ? ` and ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}` : ''}`
      : `${secondsLeft} second${secondsLeft !== 1 ? 's' : ''}`;
    showToast(`Rate limit: Please wait ${cooldownMessage} before trying again.`, 'error');
    return;
  }

  const email = DOM.loginEmail?.value?.trim() || '';
  const password = DOM.loginPassword?.value || '';

  if (!email || !password) {
    showToast('Please enter both email and password.', 'error');
    if (!email) {
      DOM.loginEmail?.closest('.form-group')?.classList.add('error');
    }
    if (!password) {
      DOM.loginPassword?.closest('.form-group')?.classList.add('error');
    }
    return;
  }

  state.loginInProgress = true;
  setLoginLoadingState(true);

  try {
    const response = await authAPI.login(email, password);
    const payload = response?.data ?? response;
    const username = payload?.username || email;
    state.authenticatedEmail = email;
    
    // Sync customer state and fetch profile
    await syncAuthenticatedCustomerState(username, email);
    
    // Always fetch full customer profile to ensure we have complete data
    try {
      const customerId = state.customerId || username;
      if (customerId) {
        const customerData = await authAPI.getCustomer(customerId);
        state.authenticatedCustomer = customerData;
        console.log('[login] Customer profile loaded:', customerData);
        
        // Get display name for toast
        let displayName = email;
        if (customerData?.firstName && customerData?.lastName) {
          displayName = `${customerData.firstName} ${customerData.lastName}`;
        } else if (customerData?.firstName) {
          displayName = customerData.firstName;
        } else if (customerData?.lastName) {
          displayName = customerData.lastName;
        }
        showToast(`Logged in as ${displayName}.`, 'success');
        
        // Refresh UI again to show profile data
        refreshLoginUI();
        
        // Dispatch event to notify React components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-state-changed'));
        }
      } else {
        showToast(`Logged in as ${email}.`, 'success');
      }
      
      // Dispatch event to notify React components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-state-changed'));
      }
    } catch (profileError) {
      console.warn('[login] Could not fetch customer profile:', profileError);
      // Continue even if profile fetch fails - refresh UI with whatever data we have
      showToast(`Logged in as ${email}.`, 'success');
      refreshLoginUI();
      
      // Dispatch event to notify React components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-state-changed'));
      }
    }
    
    try {
      await ensureOrderCreated('login');
      await ensureSubscriptionAttached('login');
      // Payment overview should be updated by ensureSubscriptionAttached
      // But let's make sure it's updated if we're on step 4
      if (state.currentStep === 4) {
        updatePaymentOverview();
      }
    } catch (orderError) {
      console.warn('[login] Auto order creation after login failed:', orderError);
    }
    DOM.loginForm?.reset();
    // Clear cooldown on successful login
    loginCooldownUntil = 0;
    if (typeof window !== 'undefined') {
      window.loginCooldownUntil = 0;
    }
  } catch (error) {
    console.error('[login] Login failed:', error);
    
    // Handle rate limit errors - set cooldown to prevent further attempts
    if (error.message && error.message.includes('Rate limit exceeded')) {
      const retryMs = getRetryDelayFromError(error);
      loginCooldownUntil = Date.now() + retryMs;
      if (typeof window !== 'undefined') {
        window.loginCooldownUntil = loginCooldownUntil;
      }
      const secondsLeft = Math.ceil(retryMs / 1000);
      const minutesLeft = Math.floor(secondsLeft / 60);
      const remainingSeconds = secondsLeft % 60;
      const cooldownMessage = minutesLeft > 0
        ? `${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}${remainingSeconds > 0 ? ` and ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}` : ''}`
        : `${secondsLeft} second${secondsLeft !== 1 ? 's' : ''}`;
      showToast(`Rate limit exceeded. Please wait ${cooldownMessage} before trying again.`, 'error');
      console.warn(`[login] Rate limited. Cooldown set for ${secondsLeft}s (${cooldownMessage})`);
    } else {
      showToast(getErrorMessage(error, 'Login'), 'error');
    }
  } finally {
    state.loginInProgress = false;
    setLoginLoadingState(false);
  }
}

function openForgotPasswordModal() {
  if (!DOM.forgotPasswordModal) return;
  
  // Pre-fill email if user has entered it in login form
  if (DOM.loginEmail?.value) {
    DOM.forgotPasswordEmail.value = DOM.loginEmail.value;
  }
  
  DOM.forgotPasswordModal.style.display = 'flex';
  DOM.forgotPasswordForm.style.display = 'block';
  DOM.forgotPasswordSuccess.style.display = 'none';
  document.body.classList.add('modal-open');
  
  // Focus on email input
  setTimeout(() => {
    DOM.forgotPasswordEmail?.focus();
  }, 100);
}

function closeForgotPasswordModal() {
  if (!DOM.forgotPasswordModal) return;
  
  DOM.forgotPasswordModal.style.display = 'none';
  document.body.classList.remove('modal-open');
  
  // Reset form
  if (DOM.forgotPasswordForm) {
    DOM.forgotPasswordForm.reset();
  }
}

// Terms Content - Embedded directly to avoid CORS issues
const termsContent = {
  membership: {
    da: `<h2>Vilkår og betingelser for medlemmer og 15 dages klatring i Boulders</h2>
<p><strong>Gælder alle medlemskaber</strong></p>

<h3>Accept</h3>
<p>Ved gennemførsel af indmeldelsesprocessen har du accepteret nedenstående regelsæt. Din accept af aftalen er en bindende aftale mellem medlemmet og Boulders. Din accept heraf fungerer som en underskrift.</p>

<h3>Highlights</h3>
<p>Du skal læse hele regelsættet grundigt igennem, inden du skriver under. Nærlæs særligt nedenstående:</p>
<p><strong>Fra §3:</strong> "Dit medlemskab i Boulders er et løbende abonnement med automatisk fornyelse. Abonnementet starter på købsdatoen og fortsætter indtil det opsiges efter §8."</p>
<p><strong>Fra §8:</strong> "En opsigelse skal ske online på din medlemsprofil eller pr. e-mail til medlem@boulders.dk." … "Opsigelsesperioden for et medlemskab er løbende måned + næste hele afsluttede måned. Et medlemskab kan derfor kun ophøre med effekt sidste dag i en måned."</p>
<p><strong>Fra §10:</strong> "Klatring er en sportsaktivitet, hvor det er påregneligt, at der kan ske skader og uheld. Kunden er derfor indforstået med at benyttelse af Boulders' faciliteter, herunder klatrefaciliteter, foretages på kundens eget ansvar, samt at kunden ikke kan gøre erstatningsansvar gældende på nogen måde overfor Boulders. Kunden erklærer sig således indforstået med, at eventuelle skader på kunden selv eller tredjemand ikke vil blive erstattet af Boulders."</p>

<h3>Indholdsfortegnelse</h3>
<ul>
<li>§1. Generelt</li>
<li>§2. Ændring af medlemsbetingelser og priser</li>
<li>§3. Indmeldelse</li>
<li>§4. Kampagne/tilbud/prisreduceret medlemskab</li>
<li>§5. Medlemskaber og Medlemskort</li>
<li>§6. Betaling</li>
<li>§7. Bero</li>
<li>§8. Opsigelse af medlemskab</li>
<li>§9. Fortrydelsesret</li>
<li>§10. Helbredstilstand og personskade</li>
<li>§11. Force Majeure</li>
<li>§12. Persondataforordningen (GDPR)</li>
<li>§13. Lovvalg og værneting</li>
<li>§14. 15 dages klatring</li>
</ul>

<h3>§1 Generelt</h3>
<p>Følgende regelsæt er gældende for dit medlemskab i Boulders. Gældende regelsæt vil altid kunne findes på Boulders.dk. Vi gør opmærksom på at løbende ændringer af priser, betingelser, åbningstider og regelsæt kan forekomme. Du kan læse mere om ændringer under §2.</p>

<p>Dit medlemskab i Boulders er personligt og må ikke benyttes af andre. Ved misbrug af dit medlemskab eller medlemskort, opsiges dit medlemskab øjeblikkeligt uden refusion for den resterende periode af dit medlemskab.</p>

<p>For at kunne identificere dig som medlem opbevares et billede af dig sammen med dine øvrige personoplysninger. Læs mere om GDPR (Persondataforordningen) i §12. Hvis der sker ændringer i de oplysninger, du har givet ved medlemskabets oprettelse, skal du straks meddele dette til Boulders. Du er som medlem selv ansvarlig for, at Boulders til enhver tid har dine korrekte personoplysninger herunder særligt e-mailadresse.</p>

<p>Ved oprettelsen af et medlemskab accepterer du, ud over dette regelsæt, at modtage meddelelser om væsentlige prisændringer og ændringer i dette regelsæt pr. e-mail. Du accepterer også at modtage andre relevante informationer pr. e-mail.</p>

<p>Henvendelser om medlemskab, herunder spørgsmål til medlemskaber og betingelser skal rettes til medlem@boulders.dk. Kun skriftlige svar herfra kan betragtes som værende fuldgyldige.</p>

<h3>§2 Ændring af medlemsbetingelser og priser</h3>
<p>Boulders forbeholder sig retten til løbende at ændre regelsættet, gebyrer, betingelser, åbningstider og priser, herunder prisen for dit medlemskab. De til enhver tid gældende priser og regelsæt vil altid kunne findes på Boulders.dk.</p>
<p>Ændringer kan forekomme i følgende situationer: En rabataftale, som er tilknyttet dit medlemskab, bortfalder. Boulders foretager investeringer til forbedring af din brugeroplevelse, fx. ansættelse af mere personale eller renovation og modernisering af faciliteter samt udvidelse med flere klatrecentre.</p>
<p>Priserne reguleres som følge af markedsforholdene og samfundsudviklingen, herunder forøgede omkostninger og inflation, indførelsen af nye lovgivningsmæssige krav og lignende situationer. Niveauet af prisstigningen vil blive fastsat forholdsmæssigt ud fra Boulders forøgede omkostninger.</p>
<p>Væsentlige ændringer af priser og regelsæt vil blive varslet pr. e-mail minimum 60 dage inden disse træder i kraft. Såfremt du ikke ønsker at fortsætte dit medlemskab, skal du opsige dette jævnfør §8. Vær opmærksom på opsigelsesfristen!</p>

<h3>§3 Indmeldelse</h3>
<p>Dit medlemskab i Boulders er et løbende abonnement med automatisk fornyelse, der starter på købsdagen og fortsætter indtil det opsiges efter §8.</p>
<p>Se også §4, hvis du har tegnet medlemskab på kampagne/tilbud/prisreduceret.</p>

<h3>§3A Medlemskab når du er under 18 år eller umyndiggjort</h3>
<p>For at tegne eget medlemskab i Boulders skal du være fyldt 18 år.</p>
<p>Hvis du er under 18 år eller umyndig, skal du, for at tegne et medlemskab, enten gøre det online eller møde personligt op i et af Boulders' klatrecentre med din værge eller en af dine forældre. Det skal være en værge/forældre, som betaler medlemskabet. Ved afhentning af medlemskort skal den pågældende værge/forældre underskrive dette regelsæt på vegne af den umyndige.</p>
<p>Du er selv ansvarlig for at oplyse Boulders om, at du er umyndig/U18 og dermed ikke kan indgå aftalen.</p>
<p>Hvis du er værge eller forælder, der indmelder en person under 18 år, indestår og hæfter du for den umyndiges overholdelse af betaling, regelsættet og husets regler. Du kan kun tegne medlemskab i Boulders, hvis din værge/forælder står som betaler af dit medlemskab.</p>

<h3>§4 Kampagne/tilbud/prisreduceret medlemskab</h3>
<p>Medlemskaber købt som kampagne/tilbud/prisreduceret er underlagt en 3 måneders bindingsperiode, fra indgåelse af medlemskabet og tre hele afsluttede måneder fremad.</p>
<p>Medlemskaber købt på kampagne/tilbud/prisreduceret overgår efter endt rabatperiode automatisk til løbende abonnement på normale priser og betingelser, som beskrevet her i regelsættet.</p>
<p>Det er ikke muligt at berosætte medlemskaber i en kampagne/prisreduceret/tilbudsperiode.</p>
<p>Efter udmeldelse, efter §8, er det ikke muligt at genindmelde sig på et kampagne/tilbud/prisreduceret-medlemskab indtil 6 hele måneder efter endt medlemskab. Genindmeldelse skal i den 6 måneders periode være på normale betingelser til gældende normalpriser.</p>

<h3>§5 Medlemskaber og medlemskort</h3>
<p>På Boulders.dk kan du til enhver tid se en oversigt over vores gældende medlemskaber.</p>
<p>Studentermedlemskabet kan kun tegnes af personer med gyldig studieidentifikation. Boulders forbeholder sig retten til at afvise typer af studenteridentifikation eller tilbagekalde brugen af en allerede benyttet studenteridentifikation. Medlemmet er forpligtet til ved henvendelse at fremvise gyldig studenteridentifikation.</p>
<p>I tilfælde af overtrædelse af medlemsbetingelserne, personalets anvisninger eller husets regler, kan Boulders til enhver tid lukke dit medlemskab med øjeblikkelig virkning. Boulders forbeholder sig også retten til at udelukke dig fra medlemskab i Boulders permanent eller på ubestemt tid.</p>
<p>Medlemskortet skal altid medbringes og indlæses, inden du benytter det pågældende klatrecenter. Boulders forbeholder sig retten til at opkrævet et gebyr for glemt medlemskort og retten til at påkræve at du køber et nyt medlemskort efter gentagende at have glemt dit kort.</p>
<p>Hvis du mister eller beskadiger dit medlemskort, skal du straks meddele dette til Boulders, som vil udstede et nyt medlemskort mod et gebyr.</p>

<h3>§5A U16 medlemskaber</h3>
<p>Det er et krav for oprettelse af U16 medlemskab, at personen der benytter medlemskabet er under 16 år.</p>
<p>U16 medlemskaber skal oprettes af forældre/værge, læs mere om medlemskaber til umyndige i §3A.</p>
<p>U16 medlemskaber vil automatisk overgå til almindelig voksenpris- og betingelser, når medlemmer fylder 16 år. Er medlemmer studerende, skal dette oplyses med studenteridentifikation til medlem@boulders.dk inden overgang fra U16 medlemskab.</p>
<p>Gældende priser, medlemstyper og betingelser kan altid findes på boulders.dk</p>

<h3>§6 Betaling</h3>
<p>Du skal ved oprettelsen af dit medlemskab betale for medlemskabet fra købsdatoen tilmed slutningen af indeværende måned + evt. næste hele måned, afhængig af den specifikke indmeldelsesdato.</p>

<h3>§6A Betalingsaftale</h3>
<p>Det er et krav at medlemskabet er tilmeldt automatisk betaling med kreditkortabonnement. Kontingentbetalinger trækkes i starten af måneden, uafhængigt af indmeldelsesdatoen.</p>

<h3>§6B Manglende eller for sen betaling</h3>
<p>Hvis dit medlemskab ikke betales rettidigt, udsendes en rykkerskrivelse til dig eller din værge/forældre. Boulders opkræver rykkergebyr på 100kr efter gældende takster. Betales der ikke inden den angivne forfaldsdato, har Boulders ret til uden varsel at opsige dit medlemskab og opkræve andre udeståender til betaling omgående.</p>
<p>Boulders forbeholder sig ret til selvstændigt eller via inkasso at indkassere det udestående beløb samt et gebyr for rykning og for for sen betaling. Boulders indberetter dårlige betalere til RKI i henhold til RKI's gældende regler. Gebyret fastsættes af Boulders.</p>

<h3>§6C Refundering fra Boulders</h3>
<p>I nogle tilfælde kan det hænde, at du som medlem har penge til gode hos Boulders. Boulders vil som hovedregel godskrive sådanne beløb i dit fremadrettede medlemskab, og du har derfor som udgangspunkt ikke mulighed for at få sådanne beløb udbetalt, før ophør af dit medlemskab.</p>
<p>Hvis dit medlemskab er ophørt og du mener, at du har et beløb til gode, skal du rette henvendelse til medlem@boulders.dk.</p>
<p>Vi gør opmærksom på, at en eventuel refusion kun kan ske til danske konti og indenfor 30 dage fra din henvendelse. Refusion i forbindelse med berosætning eller anden forudbetaling, herunder konvertering af klippekort, er ikke muligt. Medlemskabet vil i disse tilfælde fortsætte indtil alt tilgodehavende er benyttet.</p>

<h3>§7 Bero</h3>
<p>Medlemskaber kan berosættes mod et gebyr på 49kr. Medlemskaber kan berosættes 3 gange pr. kalenderår. Beroperioden skal som minimum være 30 på hinanden følgende kalenderdage og kan maksimalt være 3 måneder.</p>
<p>Bero kan altid ophæves før tid, dog tidligst efter 30 på hinanden følgende kalenderdage. I beroperioden kan denne forlænges op til 3 måneder uden gebyr.</p>
<p>Medlemskaber kan ikke opsiges i beroperioden. Ligeledes kan opsagte medlemskaber ikke berosættes i udmeldelsesperioden.</p>
<p>Eventuelt tilgodehavende ved berosætning, vil blive fratrukket første periode af medlemskabsbetaling efter endt bero. Refusion er ikke muligt.</p>
<p>Det er ikke muligt at berosætte medlemskaber i en kampagne/prisreduceret/tilbudsperiode.</p>
<p>Du kan starte bero på din Boulders online medlemsprofil eller pr. e-mail til medlem@boulders.dk.</p>
<p>Medlemmet beholder sine optjente medlemsfordele og anciennitet under berosætning.</p>

<h3>§8 Opsigelse af medlemskab</h3>
<p>Opsigelsesperioden for et medlemskab er løbende måned + næste hele afsluttede måned. Et medlemskab kan derfor kun ophøre med effekt sidste dag i en måned.</p>
<p>En opsigelse skal ske online på din medlemsprofil eller pr. e-mail til medlem@boulders.dk. Ved opsigelse af dit medlemskab skal du oplyse dit fulde navn og/eller medlemsnummer. En opsigelse er gyldig fra den dag, Boulders modtager den, og du har modtaget en kvittering for gennemførelsen af din opsigelse fra Boulders.</p>
<p>Det påhviler medlemmet at kunne fremvise en tidligere skriftlig bekræftelse fra Boulders på en udmeldelse, hvis der opstår tvivl derom.</p>
<p>Boulders står ikke til ansvar for, om du har brugt dit medlemskab i perioden, du hæfter selv for dit medlemskab, indtil en rettidig opsigelse er gennemført.</p>
<p>Boulders står ikke til ansvar for manglende adgang til medlemmets online profil. Medlemmet skal selv øjeblikkeligt kontakte medlem@boulders.dk, hvis de har problemer med login og udmeldelse online.</p>
<p>Behandler man selv sit medlemskab på sin online medlemsprofil, efter man har kontaktet medlem@boulders.dk, vil din online aktivitet og ændringer være gældende for dit videre medlemskabsforløb og mailen vil ikke være gældende.</p>
<p>Besvarer man ikke eventuelle spørgsmål til det videre forløb af medlemskab, vil sagen ikke blive færdigbehandlet og dit medlemskab fortsætter uden ændringer.</p>
<p>Bemærk at medlemskaber købt som kampagne/tilbud/prisreduceret er underlagt en 3 måneders bindingsperiode, fra indgåelse af medlemskabet og tre hele afsluttede måneder fremad. Læs mere om kampagner i §4.</p>
<p>Ved opsigelse mister medlemmet sine optjente medlemsfordele og anciennitet. Ønsker man at beholde sine fordele, bør berosætning overvejes.</p>

<h3>§9 Fortrydelsesret</h3>
<p>Ved oprettelsen af et medlemskab i Boulders har du 14 dages fortrydelsesret fra den dag, medlemskabet blev oprettet. For at gøre brug af fortrydelsesretten, skal du rette henvendelse til medlem@boulders.dk. Fortrydelsesretten kan ikke benyttes ved gentagne medlemskabsoprettelser. Hvis du benytter dig af din fortrydelsesret, har Boulders ret til at kræve forholdsmæssig betaling i form af normal entré for samtlige antal besøg i den periode, du har benyttet dig af dit medlemskab.</p>

<h3>§10 Helbredstilstand og personskade</h3>
<p>Al færdsel i Boulders klatrecentre og al klatring sker på eget ansvar. Boulders tager ikke ansvar for din brug af Boulders' faciliteter eller udendørsområder. Du er som medlem selv ansvarlig for at være i en helbredstilstand, der tillader deltagelse i aktiviteter hos Boulders.</p>
<p>Klatring er en sportsaktivitet, hvor det er påregneligt, at der kan ske skader og uheld. Kunden er derfor indforstået med at benyttelse af Boulders' faciliteter, herunder klatrefaciliteter, foretages på kundens eget ansvar, samt at kunden ikke kan gøre erstatningsansvar gældende på nogen måde overfor Boulders.</p>
<p>Kunden erklærer sig således indforstået med, at eventuelle skader på kunden selv eller tredjemand ikke vil blive erstattet af Boulders. Det er dit personlige ansvar at inspicere din landingszone inden klatring.</p>
<p>I øvrigt følges dansk erstatningsret på området.</p>

<h3>§10A Værdigenstande</h3>
<p>Boulders bærer ikke noget ansvar for tab som følge af tyveri eller tingsskade.</p>

<h3>§11 Force Majeure</h3>
<p>Såfremt udnyttelse af den til medlemskabet knyttede adgang til Boulders' klatrecentre (og Boulders' faciliteter i øvrigt) umuliggøres eller vanskeliggøres helt eller delvist af forhold, som forårsages af - eller resulterer ud fra - handlinger eller omstændigheder, der er uden for Boulders' kontrol, herunder f.eks. - men ikke begrænset til - epidemier, pandemier, oversvømmelse, frihedsindskrænkninger, nationale nødstilstande, ind greb eller påbud fra myndighedernes side, brand, jordskælv, krig, terrortrusler eller terrorhandlinger, optøjer eller andre civile uroligheder, revolution, embargoer, handelskrige, strejker eller andre arbejdskonflikter, berettiger en sådan umuliggørelse eller vanskeliggørelse dig ikke til at annullere eller på anden måde ændre eller opsige medlemskabet med forkortet varsel. Boulders kan i så fald heller ikke anses for at have misligholdt eller på anden måde overtrådt abonnementsaftalen. Du vil således være forpligtet til at betale for dit medlemskab i overensstemmelse med abonnementsaftalens øvrige vilkår og bestemmelser, som videreføres på hidtidige vilkår.</p>
<p>Såfremt medlemskabet ønskes opsagt, skal du derfor afgive en opsigelse i overensstemmelse med de almindelige vilkår for opsigelse, jf. abonnementsaftalens §8, samt iagttage den heri anførte opsigelsesvarsel, førend opsigelsen kan få virkning. Du vil derfor heller ikke have krav på tilbagebetaling af allerede betalte beløb, ligesom Boulders heller ikke på anden måde kan blive stillet til ansvar og/eller hæfte over for dig på baggrund af en sådan umuliggørelse eller vanskeliggørelse.</p>

<h3>§12 Persondataforordningen (GDPR)</h3>
<p>Når du opretter et medlemskab i Boulders accepterer du, at Boulders indsamler og behandler oplysninger om dig. Hos Boulders indsamler og behandler vi kun de oplysninger, der er nødvendige for at administrere dit medlemskab. Boulders anvender ikke oplysningerne til andre formål.</p>
<p>Boulders opbevarer oplysningerne om dig i op til 1 år efter dit medlemskab er ophørt. Herefter vil alle oplysninger blive destrueret. Når Boulders registrerer oplysninger om dig, har du ret til at:</p>
<ol>
<li>Få indsigt i de oplysninger, som vi behandler om dig.</li>
<li>Gøre indsigelse mod at indsamlingen og behandlingen af dine oplysninger finder sted.</li>
<li>Få oplysninger, der er vildledende eller urigtige, rettet eller slettet.</li>
</ol>
<p>Du har også ret til at klage til Datatilsynet over Boulders' behandling af dine personoplysninger. Henvendelser vedr. vores behandling af dine oplysninger skal ske til medlem@boulders.dk. Boulders er data ansvarlig i forbindelse med vores behandling af de oplysninger du giver os. Vi bruger alene dine persondata i forbindelse med oprettelse af dit medlemskab med løbende betaling.</p>
<p>Kontakt medlem@boulders.dk efter endt medlemskab for at få slettet dine oplysninger omgående. Oplysninger vil kun blive slettet efter udligning af alle eventuelle udeståender.</p>

<h3>§13 Lovvalg og værneting</h3>
<p>Alle køb omfattet af disse medlemsbetingelser er underlagt dansk ret, dog ikke CISG (Den Internationale Købelov), medmindre andet fremgår af ufravigelige regler. Eventuelle uenigheder, som ikke kan afgøres i mindelighed, afgøres af de danske domstole, medmindre andet fremgår af ufravigelige regler.</p>

<h3>§14 15 dages klatring</h3>
<p>15 dages klatring må kun benyttes af personer, der ikke tidligere har været medlem eller tidligere har benyttet et 15 dages kort. Opdages snyd med dette vil indehaveren blive pålagt at betale forholdsmæssig entré for sin brug af 15 dages klatring.</p>
<p>15 dages klatring er personligt og må ikke deles med andre.</p>
<p>Der henvises yderligere til §10 – helbredstilstand og personskade, §10A – Værdigenstande, §12- Persondataforordningen (GDPR) i dette regelsæt, der også er gældende for 15 dages klatring.</p>`,
    en: `<h2>Rules for Members and 15 Days of Climbing at Boulders</h2>
<p><strong>The following rules apply to all memberships</strong></p>

<h3>Acceptance</h3>
<p>By completing the registration process, you accept the rules outlined below. Your acceptance of this agreement constitutes a binding agreement between you and Boulders. Your acceptance serves as a signature.</p>

<h3>Highlights</h3>
<p>Please read the full set of rules carefully before signing. Pay special attention to the following:</p>
<p><strong>From §3:</strong> "Your membership at Boulders is a recurring subscription with automatic renewal. The subscription starts on the date of purchase and continues until it is terminated in accordance with §8."</p>
<p><strong>From §8:</strong> "Membership cancellations must be done online via your membership profile or by emailing medlem@boulders.dk." ... "The cancellation period for a membership is the current month + the next full calendar month. Therefore, a membership can only terminate effective on the last day of a month."</p>
<p><strong>From §10:</strong> "Climbing is a sports activity where injuries and accidents can occur. The customer agrees that the use of Boulders' facilities, including climbing facilities, is done at their own risk and that no claims for compensation can be made against Boulders. The customer thus agrees that any injuries to themselves or third parties will not be compensated by Boulders."</p>

<h3>Table of Contents</h3>
<ul>
<li>§1. General Provisions</li>
<li>§2. Changes to Membership Terms and Prices</li>
<li>§3. Membership Registration</li>
<li>§4. Promotional/Discounted Memberships</li>
<li>§5. Memberships and Membership Cards</li>
<li>§6. Payment</li>
<li>§7. Membership Freeze</li>
<li>§8. Membership Cancellation</li>
<li>§9. Right of Withdrawal</li>
<li>§10. Health Condition and Personal Injury</li>
<li>§11. Force Majeure</li>
<li>§12. Data Protection (GDPR)</li>
<li>§13. Governing Law and Jurisdiction</li>
<li>§14. 15 Day-Climbing Pass</li>
</ul>

<h3>§1 General Provisions</h3>
<p>The following rules apply to your membership at Boulders. The applicable rules will always be available on Boulders.dk. Please note that ongoing changes to prices, terms, opening hours, and rules may occur. You can read more about changes under §2.</p>

<p>Your membership at Boulders is personal and may not be used by others. Misuse of your membership or membership card will result in immediate termination of your membership without a refund for the remaining period. To identify you as a member, a photo of you is stored along with your other personal information. Learn more about GDPR (Data Protection Regulation) in §12.</p>

<p>If there are changes to the information you provided when registering for membership, you must notify Boulders immediately. As a member, it is your responsibility to ensure that Boulders always has your correct personal information, especially your email address.</p>

<p>By registering for a membership, you agree to receive notifications about significant price changes and changes to these rules via email. You also agree to receive other relevant information via email.</p>

<p>Inquiries about memberships, including questions regarding memberships and terms, should be directed to medlem@boulders.dk. Only written responses from this email address can be considered valid.</p>

<h3>§2 Changes to Membership Terms and Prices</h3>
<p>Boulders reserves the right to make ongoing changes to the rules, fees, terms, opening hours, and prices, including the price of your membership. The current prices and rules will always be available on Boulders.dk. Changes may occur in the following situations:</p>
<p>A discount agreement linked to your membership expires.</p>
<p>Boulders invests in improving your user experience, e.g., hiring more staff, renovating or modernizing facilities, or expanding with more climbing centers.</p>
<p>Prices are adjusted due to market conditions and societal developments, including increased costs, inflation, the introduction of new legislative requirements, and similar situations.</p>
<p>The level of price increases will be set proportionally based on Boulders' increased costs.</p>
<p>Significant changes to prices and rules will be notified via email at least 60 days before they take effect. If you do not wish to continue your membership, you must cancel it according to §8. Note the cancellation period!</p>

<h3>§3 Membership Registration</h3>
<p>Your membership at Boulders is a recurring subscription with automatic renewal, starting on the date of purchase and continuing until it is canceled in accordance with §8. See also §4 if you have signed up for a promotional/discounted membership.</p>

<h3>§3A Membership for Individuals Under 18 or Those Under Legal Guardianship</h3>
<p>To sign up for a membership at Boulders, you must be at least 18 years old. If you are under 18 or under legal guardianship, you must either register online or visit one of Boulders' climbing centers in person with your guardian or parent. The guardian/parent must be the one paying for the membership. When collecting the membership card, the guardian/parent must sign this rule set on behalf of the individual under guardianship.</p>
<p>It is your responsibility to inform Boulders if you are under legal guardianship or under 18 and thus cannot enter into the agreement.</p>
<p>If you are a guardian or parent registering someone under 18, you vouch for and are responsible for the minor's compliance with payment, the rules, and house policies. Membership at Boulders can only be signed up for if the guardian/parent is listed as the payer for the membership.</p>

<h3>§4 Promotional/Discounted Memberships</h3>
<p>Memberships purchased as part of a promotion/offer/discount are subject to a three-month binding period from the start date of the membership and for three full calendar months thereafter.</p>
<p>It is not possible to freeze memberships during a campaign/discounted/promotional period.</p>
<p>After the discount period ends, the membership automatically transitions into a recurring subscription at the normal rates and terms described in this rule set.</p>
<p>After termination, as per §8, it is not possible to re-register for a promotional/discounted membership until six full months after the end of the membership. Re-registration during this six-month period must be under normal terms at the current normal prices.</p>

<h3>§5 Memberships and Membership Cards</h3>
<p>You can always find an overview of our current memberships on Boulders.dk. The student membership can only be purchased by individuals with valid student identification. Boulders reserves the right to reject certain types of student identification or revoke the use of previously accepted student identification. Members are required to present valid student identification upon request.</p>
<p>In the event of a breach of membership terms, staff instructions, or house rules, Boulders may terminate your membership with immediate effect at any time. Boulders also reserves the right to permanently or indefinitely exclude you from membership at Boulders.</p>
<p>The membership card must always be brought and scanned before using the respective climbing center. Boulders reserves the right to charge a fee for forgotten membership cards and may require you to purchase a new membership card if you repeatedly forget it. If you lose or damage your membership card, you must immediately inform Boulders, who will issue a new card for a fee.</p>

<h3>§5A U16 Memberships</h3>
<p>It is a requirement for obtaining a U16 membership that the individual using the membership is under 16 years of age. U16 memberships must be created by a parent or guardian; see §3A for more details regarding memberships for minors.</p>
<p>U16 memberships will automatically transition to a regular adult membership, with applicable adult pricing and terms, upon the member's 16th birthday. If the member qualifies for a student membership, this must be documented with valid student identification by emailing medlem@boulders.dk prior to the transition from the U16 membership.</p>
<p>Current prices, membership types, and terms can always be found at boulders.dk.</p>

<h3>§6 Payment</h3>
<p>When creating your membership, you will be required to pay for the membership starting from the purchase date until the end of the current month plus the following full month, depending on the specific enrollment date.</p>

<h3>§6A Payment Agreement</h3>
<p>It is a requirement that the membership is registered for automatic payment through a credit card subscription. Membership fees are charged at the beginning of each month, regardless of the enrollment date.</p>

<h3>§6B Non-Payment or Late Payment</h3>
<p>If your membership fee is not paid on time, a reminder notice will be sent to you or your parent/guardian. Boulders will charge a late fee of 100 DKK, in accordance with applicable rates.</p>
<p>If payment is not made by the due date, Boulders reserves the right to terminate your membership without notice and demand immediate payment of any outstanding amounts. Boulders retains the right to collect outstanding amounts independently or through debt collection, including charging fees for reminders and late payments. Boulders may report delinquent payments to the RKI registry in accordance with RKI's applicable rules. The fee is determined by Boulders.</p>

<h3>§6C Refunds from Boulders</h3>
<p>In some cases, you may have a balance in your favor with Boulders. As a general rule, such amounts will be credited toward your ongoing membership, and you will not be able to receive a refund until your membership has ended.</p>
<p>If your membership has ended and you believe you have a balance owed to you, please contact medlem@boulders.dk. Please note that any refund can only be issued to Danish bank accounts and within 30 days of your inquiry.</p>
<p>Refunds related to freezing of memberships or other prepayments, including the conversion of punch cards, are not possible. In such cases, the membership will continue until the balance has been fully utilized.</p>

<h3>§7 Freezing Memberships</h3>
<p>Memberships can be frozen for a fee of 49 DKK. Memberships can be frozen up to 3 times per calendar year. The freezing period must be a minimum of 30 consecutive calendar days and a maximum of 3 months.</p>
<p>A freeze can always be lifted early, but not before 30 consecutive calendar days have passed. During the freezing period, it can be extended up to 3 months without additional fees.</p>
<p>Memberships cannot be canceled during the freezing period, and canceled memberships cannot be frozen during the termination period.</p>
<p>Any credit resulting from the freezing period will be deducted from the first membership fee payment after the freeze ends. Refunds are not possible.</p>
<p>It is not possible to freeze memberships during a campaign/discounted/promotional period.</p>
<p>You can initiate a freeze via your Boulders online membership profile or by emailing medlem@boulders.dk.</p>
<p>Members retain their accrued membership benefits and seniority during the freezing period.</p>

<h3>§8 Termination of Membership</h3>
<p>Termination must be done online through your membership profile or by emailing medlem@boulders.dk. When terminating your membership, you must provide your full name and/or membership number. The termination is valid from the day Boulders receives it, and you have received a confirmation from Boulders acknowledging the termination.</p>
<p>The termination period for a membership is the remainder of the current month plus the following full calendar month. Memberships can therefore only end on the last day of a month.</p>
<p>It is the member's responsibility to retain a written confirmation from Boulders regarding the termination, should any dispute arise.</p>
<p>Boulders is not responsible for whether you have used your membership during the membership period; you remain liable for the membership until a valid termination is completed.</p>
<p>Boulders is not responsible for a lack of access to your online membership profile. You must contact medlem@boulders.dk immediately if you experience issues logging in or canceling online.</p>
<p>If you make changes to your membership online after contacting medlem@boulders.dk, your online activity will take precedence, and the email correspondence will no longer be valid.</p>
<p>Failure to respond to questions regarding the next steps for your membership will result in your case not being finalized, and your membership will continue unchanged.</p>
<p>Memberships purchased as part of a campaign, promotion, or at a discounted rate are subject to a 3-month binding period, effective from the date of membership creation and lasting for three full calendar months. See §4 for more information on campaigns.</p>
<p>Upon termination, members lose their accrued benefits and seniority. If you wish to retain these, freezing your membership may be considered.</p>

<h3>§9 Right of Withdrawal</h3>
<p>When creating a membership with Boulders, you have a 14-day right of withdrawal from the date the membership was created. To exercise your right of withdrawal, contact medlem@boulders.dk. The right of withdrawal cannot be used for repeated membership sign-ups.</p>
<p>If you exercise your right of withdrawal, Boulders is entitled to require proportional payment in the form of normal entry fees for all visits made during the period in which your membership was active.</p>

<h3>§10 Health Conditions and Personal Injury</h3>
<p>All activity in Boulders climbing centers and climbing itself is conducted at your own risk. Boulders assumes no responsibility for your use of Boulders' facilities or outdoor areas. As a member, you are responsible for ensuring that your health condition allows participation in activities at Boulders.</p>
<p>Climbing is a sports activity where injuries and accidents are foreseeable. Customers acknowledge that using Boulders' facilities, including climbing facilities, is at their own risk and that they cannot claim liability or compensation from Boulders in any way. Customers further accept that any injuries to themselves or third parties will not be compensated by Boulders. It is your personal responsibility to inspect your landing zone before climbing. Danish liability law applies to this area.</p>

<h3>§10A Valuables</h3>
<p>Boulders assumes no responsibility for losses due to theft or property damage.</p>

<h3>§11 Force Majeure</h3>
<p>If access to Boulders climbing centers (and Boulders' other facilities) associated with the membership is rendered impossible or significantly hindered, wholly or partially, due to circumstances caused by or resulting from actions or situations beyond Boulders' control—including, but not limited to, epidemics, pandemics, floods, restrictions on freedom, national emergencies, government interventions or orders, fires, earthquakes, wars, terrorist threats or actions, riots or other civil disturbances, revolutions, embargoes, trade wars, strikes or other labor disputes—such hindrance or impossibility does not entitle you to cancel, modify, or terminate your membership with shortened notice.</p>
<p>In such cases, Boulders cannot be considered to have breached or otherwise violated the subscription agreement. You are therefore required to continue payment for your membership under the terms and conditions of the subscription agreement, which remains in effect as per its existing terms.</p>
<p>If you wish to terminate the membership, you must do so in accordance with the standard terms of termination, as outlined in §8 of the subscription agreement, and observe the stipulated notice period before the termination takes effect. Consequently, you are not entitled to a refund of already paid amounts, nor can Boulders be held liable or accountable in any way for such hindrance or impossibility.</p>

<h3>§12 General Data Protection Regulation (GDPR)</h3>
<p>By creating a membership at Boulders, you accept that Boulders collects and processes information about you. Boulders only collects and processes the information necessary to manage your membership and does not use the data for other purposes.</p>
<p>Boulders retains your information for up to 1 year after your membership has ended, after which all data will be destroyed.</p>
<p>When Boulders processes your information, you have the right to:</p>
<ol>
<li>Access the information we process about you.</li>
<li>Object to the collection and processing of your information.</li>
<li>Have misleading or inaccurate information corrected or deleted.</li>
</ol>
<p>You also have the right to file a complaint with the Danish Data Protection Agency regarding Boulders' processing of your personal data. Inquiries about our processing of your information should be directed to medlem@boulders.dk.</p>
<p>Boulders is the data controller responsible for processing the information you provide to us. We use your personal data exclusively for creating your membership with ongoing payment.</p>
<p>Contact medlem@boulders.dk after your membership ends to have your information deleted immediately. Information will only be deleted after settling any outstanding payments.</p>

<h3>§13 Governing Law and Jurisdiction</h3>
<p>All purchases covered by these membership terms are subject to Danish law, excluding the CISG (United Nations Convention on Contracts for the International Sale of Goods), unless otherwise specified by mandatory rules.</p>
<p>Any disputes that cannot be resolved amicably shall be settled by the Danish courts unless otherwise required by mandatory rules.</p>

<h3>§14 15-Day Climbing Pass</h3>
<p>The 15-day climbing pass may only be used by individuals who have not previously been members or used a 15-day pass. If misuse of this pass is discovered, the holder will be required to pay a proportional entrance fee for the usage of the 15-day climbing pass.</p>
<p>The 15-day climbing pass is personal and may not be shared with others.</p>
<p>Additionally, references are made to §10 – Health Condition and Personal Injury, §10A – Valuables, and §12 – General Data Protection Regulation (GDPR), which also apply to the 15-day climbing pass.</p>`
  },
  punchcard: {
    da: `<h2>Vilkår og betingelser for klippekort</h2>

<h3>§1 Generelt</h3>
<p>Følgende regelsæt er gældende for klippekort hos Boulders.<br>
Ved oprettelse af et klippekort accepterer du at modtage nyhedsmails og anden relevant information pr. e-mail.</p>

<h3>§2 Husets regler og andre bestemmelser</h3>
<p>I tilfælde af overtrædelse af regelsættet, personalets anvisninger eller husets regler, kan Boulders til enhver tid lukke dit klippekort med øjeblikkelig virkning. Boulders forbeholder sig også retten til at udelukke dig fra at klatre hos Boulders på ubestemt tid.<br>
Udleverede plastikkort fungerer som adgangskort og skal altid medbringes og indlæses, inden du benytter det pågældende klatrecenter. Hvis du mister eller beskadiger dit adgangskort, skal du straks meddele dette til Boulders, som vil udstede et nyt adgangskort mod et gebyr.</p>

<h3>§3 Helbredstilstand og personskade</h3>
<p>Al færdsel i Boulders klatrecentre og al klatring sker på eget ansvar. Boulders tager ikke ansvar for din brug af Boulders' faciliteter eller udendørsområder. Du er som klatrer selv ansvarlig for at være i en helbredstilstand, der tillader deltagelse i aktiviteter hos Boulders. Klatring er en sportsaktivitet, hvor det er påregneligt, at der kan ske skader og uheld.<br>
Kunden er derfor indforstået med, at benyttelse af Boulders' faciliteter, herunder klatrefaciliteter, foretages på kundens eget ansvar, samt at kunden ikke kan gøre erstatningsansvar gældende på nogen måde overfor Boulders. Kunden erklærer sig således indforstået med, at eventuelle skader på kunden selv eller tredjemand ikke vil blive erstattet af Boulders. Det er dit personlige ansvar at inspicere din landingszone inden klatring. I øvrigt følges dansk erstatningsret på området.</p>

<h3>§4 Persondataforordningen (GDPR)</h3>
<p>Når du opretter et klippekort i Boulders accepterer du, at Boulders indsamler og behandler oplysninger om dig. Hos Boulders indsamler og behandler vi kun de oplysninger, der er nødvendige for at administrere dit klippekort. Boulders anvender ikke oplysningerne til andre formål. Boulders opbevarer oplysningerne om dig i op til 1 år efter dit klippekort. Herefter vil alle oplysninger blive destrueret. Kontakt medlem@boulders.dk efter klippekortets udløb for at få slette dine oplysninger omgående.</p>

<p>Når Boulders registrerer oplysninger om dig, har du ret til at:</p>
<ul>
<li>Få indsigt i de oplysninger, som vi behandler om dig.</li>
<li>Gøre indsigelse mod at indsamlingen og behandlingen af dine oplysninger finder sted.</li>
<li>Få oplysninger, der er vildledende eller urigtige, rettet eller slettet.</li>
</ul>

<p>Du har også ret til at klage til Datatilsynet over Boulders' behandling af dine personoplysninger.<br>
Henvendelser vedrørende vores behandling af dine oplysninger skal ske til medlem@boulders.dk.<br>
Boulders er dataansvarlig i forbindelse med vores behandling af de oplysninger du giver os.</p>

<h3>§5 Ombytning til Medlemskab</h3>
<p>Det er muligt at ombytte sit ubrugte eller delvist brugte klippekort til et medlemskab. Boulders tager derved højde for antal brugte klip og købsprisen og udregner derved restancen, som bliver fratrukket det ønskede medlemskab. Bemærk at der skal underskrives et regelsæt til medlemskab. Det er ikke muligt at få refunderet restancen ved endt medlemskab. Ønskes ombytning skal du skrive en mail til medlem@boulders.dk. Boulders ombytter ikke i receptionen.</p>

<h3>§6 Handelsbetingelser</h3>
<p>Dit klippekort er gyldigt i 5 år fra købsdatoen og betales forud. Du har ikke ret til at få refunderet resterende klip eller på anden måde modtage godtgørelse for ubrugte klip.<br>
Ved køb af et klippekort i Boulders har du 14 dages fortrydelsesret fra den dag, klippekort blev oprettet. For at gøre brug af fortrydelsesretten, skal du rette henvendelse til medlem@boulders.dk. Fortrydelsesretten kan ikke benyttes ved gentagne oprettelser. Hvis du benytter dig af din fortrydelsesret, har Boulders ret til at kræve forholdsmæssig betaling i form af gældende entrépriser for det antal gange klippekort er benyttet og priserne vil reflektere tidspunktet for check-in i relation til peakpriser og off-peakpriser.</p>

<p>Klippekortet er ikke personligt og må gerne benyttes af andre. Enhver person, der benytter et klip fra en klippekortholders kort, skal dog underskrive Boulders' gældende ansvarsfraskrivelse.</p>`,
    en: `<h2>Terms and Conditions for Punch Card</h2>

<h3>§1 General</h3>
<p>The following rules apply to punch cards at Boulders.<br>
By purchasing a punch card, you agree to receive newsletters and other relevant information via email.</p>

<h3>§2 House Rules and Other Provisions</h3>
<p>In case of a breach of the rules, staff instructions, or house rules, Boulders reserves the right to cancel your punch card with immediate effect. Boulders also reserves the right to ban you from climbing at Boulders indefinitely.<br>
Issued plastic cards function as access cards and must always be brought and scanned before entering the climbing center. If you lose or damage your access card, you must immediately inform Boulders, which will issue a new access card for a fee.</p>

<h3>§3 Health Condition and Personal Injury</h3>
<p>All activities at Boulders climbing centers and all climbing are undertaken at your own risk. Boulders assumes no responsibility for your use of its facilities or outdoor areas. You are responsible for being in a health condition that allows participation in activities at Boulders. Climbing is a sport where injuries and accidents are foreseeable.<br>
The customer acknowledges that the use of Boulders' facilities, including climbing facilities, is entirely at their own risk and that no compensation claims can be made against Boulders in any way. The customer also acknowledges that any injuries to themselves or third parties will not be compensated by Boulders. It is your personal responsibility to inspect your landing zone before climbing. Danish liability law applies to the area.</p>

<h3>§4 General Data Protection Regulation (GDPR)</h3>
<p>By purchasing a punch card at Boulders, you accept that Boulders collects and processes information about you. At Boulders, we only collect and process the information necessary to manage your punch card. Boulders does not use the information for other purposes. Boulders stores your information for up to 1 year after your punch card expires, after which all information will be destroyed. Contact medlem@boulders.dk to have your information deleted immediately after your punch card expires.</p>

<p>When Boulders registers information about you, you have the right to:</p>
<ul>
<li>Access the information we process about you.</li>
<li>Object to the collection and processing of your information.</li>
<li>Have misleading or incorrect information corrected or deleted.</li>
</ul>

<p>You also have the right to file a complaint with the Danish Data Protection Agency regarding Boulders' processing of your personal data.<br>
Inquiries regarding our processing of your information should be directed to medlem@boulders.dk.<br>
Boulders is the data controller responsible for processing the information you provide to us.</p>

<h3>§5 Conversion to Membership</h3>
<p>It is possible to convert an unused or partially used punch card into a membership. Boulders will take into account the number of used punches and the purchase price to calculate the remaining balance, which will be deducted from the desired membership. Note that you will need to sign a membership agreement. Any remaining balance from the conversion cannot be refunded upon the termination of the membership.<br>
To request a conversion, you must send an email to medlem@boulders.dk. Boulders does not process conversions at the reception.</p>

<h3>§6 Terms of Sale</h3>
<p>Your punch card is valid for 5 years from the date of purchase and must be paid upfront. You are not entitled to a refund for remaining punches or any other compensation for unused punches.<br>
When purchasing a punch card at Boulders, you have a 14-day right of withdrawal from the date the punch card was created. To exercise your right of withdrawal, you must contact medlem@boulders.dk. The right of withdrawal cannot be exercised for repeated purchases. If you exercise your right of withdrawal, Boulders is entitled to demand proportional payment based on applicable entrance fees for the number of times the punch card has been used. Prices will reflect the check-in time in relation to peak and off-peak pricing.</p>

<p>The punch card is not personal and may be used by others. However, any person using a punch from a cardholder's punch card must sign Boulders' applicable liability waiver.</p>`
  },
  privacy: {
    da: `<h2>Privatlivspolitik</h2>
<p><em>Opdateret August 2024</em></p>

<p>Hos Boulders er det afgørende for os, at du føler dig tryg ved, hvordan vi håndterer dine personoplysninger. Derfor har vi en politik, der sikrer, at de oplysninger, vi indsamler, behandles ansvarligt og med respekt for dit privatliv, i overensstemmelse med gældende lovgivning.</p>

<h3>Generelt</h3>
<p>Denne politik for behandling af personoplysninger ("Persondatapolitik") gælder, når du interagerer med Boulders ("vi", "os", "vores"). Den beskriver, hvordan vi indsamler og behandler dine oplysninger, når du bruger vores hjemmeside boulders.dk ("Hjemmesiden"), benytter vores app ("Appen"), eller i forbindelse med dit kundeforhold og din træning hos os.</p>

<h3>Dataansvar</h3>
<p>Boulders ApS er ansvarlig for behandlingen af de personoplysninger, vi indsamler om dig. Du kan kontakte os på følgende adresse:</p>
<p>Boulders ApS<br>
Graham Bells Vej, 8200 Aarhus N<br>
CVR nr.: 32777651<br>
boulders.dk</p>

<p>Hvis du har spørgsmål om vores behandling af dine personoplysninger, kan du skrive til os på hej@boulders.dk.</p>

<h3>Hvornår indsamler vi personlige oplysninger om dig?</h3>
<p>Vi indsamler dine personoplysninger i forskellige situationer, herunder når du:</p>
<ul>
<li>Tilmelder dig som medlem af Boulders.</li>
<li>Underskriver ansvarsfraskrivelse, ved køb af dagsbillet, indløser fribillet eller lign.</li>
<li>Køber produkter på boulders.goactivebooking.com</li>
<li>Besøger og bruger vores hjemmeside eller app</li>
<li>Kontakter os via e-mail, telefon eller sociale medier</li>
</ul>

<h3>Cookies</h3>
<p>Når du besøger vores hjemmeside, indsamler vi automatisk oplysninger om din brug af hjemmesiden gennem session cookies og lignende teknologier. Cookies er små tekstfiler, der gemmes i din browser og hjælper os med at gøre hjemmesiden mere relevant for dine behov og interesser.</p>

<h3>Sletning af dine personlige oplysninger</h3>
<p>Vi opbevarer dine personlige data så længe, det er nødvendigt for formålet med behandlingen. Når dit medlemskab ophører, gemmer vi dine data i en begrænset periode for at opfylde juridiske krav og vores legitime interesser.</p>`,
    en: `<h2>Privacy Policy</h2>
<p><em>Updated August 2024</em></p>

<p>At Boulders, it is crucial for us that you feel secure about how we handle your personal information. Therefore, we have a policy that ensures the information we collect is processed responsibly and with respect for your privacy, in accordance with applicable legislation.</p>

<h3>General</h3>
<p>This policy for processing personal information ("Data Protection Policy") applies when you interact with Boulders ("we", "us", "our"). It describes how we collect and process your information when you use our website boulders.dk ("Website"), use our app ("App"), or in connection with your customer relationship and training with us.</p>

<h3>Data Controller</h3>
<p>Boulders ApS is responsible for processing the personal information we collect about you. You can contact us at the following address:</p>
<p>Boulders ApS<br>
Graham Bells Vej, 8200 Aarhus N<br>
CVR no.: 32777651<br>
boulders.dk</p>

<p>If you have questions about our processing of your personal information, you can write to us at hej@boulders.dk.</p>

<h3>When do we collect personal information about you?</h3>
<p>We collect your personal information in various situations, including when you:</p>
<ul>
<li>Register as a member of Boulders.</li>
<li>Sign a waiver, purchase a day ticket, redeem a free ticket, etc.</li>
<li>Purchase products on boulders.goactivebooking.com</li>
<li>Visit and use our website or app</li>
<li>Contact us via email, phone, or social media</li>
</ul>

<h3>Cookies</h3>
<p>When you visit our website, we automatically collect information about your use of the website through session cookies and similar technologies. Cookies are small text files stored in your browser that help us make the website more relevant to your needs and interests.</p>

<h3>Deletion of your personal information</h3>
<p>We store your personal data for as long as necessary for the purpose of processing. When your membership ends, we store your data for a limited period to fulfill legal requirements and our legitimate interests.</p>`
  },
  cookie: {
    da: `<h2>Cookie Policy</h2>

<h3>Hvad er en cookie?</h3>
<p>En cookie er en lille datafil, der gemmes på din computer, tablet eller mobiltelefon. Cookies er ikke programmer og kan ikke indeholde skadelige koder eller virus.</p>

<h3>Hjemmesidens brug af cookies</h3>
<p>Cookies er essentielle for, at vores hjemmeside fungerer korrekt. De hjælper os også med at forstå, hvordan du bruger hjemmesiden, så vi kan tilpasse indholdet til dine behov og præferencer. Cookies husker blandt andet dine loginoplysninger, sprogvalg og indstillinger samt målretter annoncer på andre hjemmesider.</p>

<h3>Opbevaringsperiode for cookies</h3>
<p>Cookies opbevares i varierende perioder, afhængigt af deres funktion og formål. Når en cookie udløber, slettes den automatisk. Du kan finde detaljer om levetiden for hver cookie i vores cookiepolitik.</p>

<h3>Afvisning og sletning af cookies</h3>
<p>Du kan til enhver tid afvise eller slette cookies ved at ændre dine browserindstillinger. Bemærk, at dette kan påvirke funktionaliteten af visse tjenester på hjemmesiden. Vejledninger til sletning af cookies varierer afhængigt af den browser og enhed, du bruger.</p>

<h3>Ændring af samtykke</h3>
<p>Hvis du ønsker at ændre dit samtykke, kan du slette cookies fra din browser eller ændre dine indstillinger via knappen i venstre bund, her på hjemmesiden.</p>

<h3>Spørgsmål?</h3>
<p>Hvis du har spørgsmål eller kommentarer vedrørende vores cookiepolitik, er du velkommen til at kontakte os. Selve cookiedeklarationen opdateres regelmæssigt via Cookiebot.</p>`,
    en: `<h2>Cookie Policy</h2>

<h3>What is a cookie?</h3>
<p>A cookie is a small data file stored on your computer, tablet, or mobile phone. Cookies are not programs and cannot contain harmful code or viruses.</p>

<h3>Website's use of cookies</h3>
<p>Cookies are essential for our website to function correctly. They also help us understand how you use the website so we can tailor content to your needs and preferences. Cookies remember, among other things, your login information, language preferences and settings, and target ads on other websites.</p>

<h3>Storage period for cookies</h3>
<p>Cookies are stored for varying periods depending on their function and purpose. When a cookie expires, it is automatically deleted. You can find details about the lifetime of each cookie in our cookie policy.</p>

<h3>Rejection and deletion of cookies</h3>
<p>You can reject or delete cookies at any time by changing your browser settings. Note that this may affect the functionality of certain services on the website. Instructions for deleting cookies vary depending on the browser and device you use.</p>

<h3>Changing consent</h3>
<p>If you wish to change your consent, you can delete cookies from your browser or change your settings via the button in the bottom left, here on the website.</p>

<h3>Questions?</h3>
<p>If you have questions or comments regarding our cookie policy, please feel free to contact us. The cookie declaration itself is regularly updated via Cookiebot.</p>`
  }
};

// Terms Modal Functions
function openTermsModal(termsType) {
  if (!DOM.termsModal || !DOM.termsModalContent || !DOM.termsModalTitle) return;
  
  state.currentModalType = termsType;
  
  // Language is managed by state.language - use translation function
  const currentLang = state.language || DEFAULT_LANGUAGE;
  
  const termsTitles = {
    membership: t('footer.terms.membership'),
    punchcard: t('footer.terms.punchcard'),
    privacy: t('footer.policies.privacy'),
    cookie: t('footer.policies.cookie'),
  };
  
  // Handle 'terms' type with tabs
  if (termsType === 'terms') {
    // Show tabs
    if (DOM.termsModalTabs) {
      DOM.termsModalTabs.style.display = 'flex';
    }
    
    // Show search
    if (DOM.termsModalSearch) {
      DOM.termsModalSearch.style.display = 'block';
      // Update placeholder based on language
      if (DOM.termsSearchInput) {
        const placeholder = currentLang === 'da' 
          ? DOM.termsSearchInput.dataset.placeholderDa || 'Søg i vilkår...'
          : DOM.termsSearchInput.dataset.placeholderEn || 'Search terms...';
        DOM.termsSearchInput.placeholder = placeholder;
      }
    }
    
    // Set title based on language
    const title = currentLang === 'da' ? 'Vilkår og Betingelser' : 'Terms and Conditions';
    DOM.termsModalTitle.textContent = title;
    
    // Show membership tab by default
    state.currentModalTab = 'membership';
    switchTermsTab('membership');
    
    // Store original content for search
    const currentTab = state.currentModalTab || 'membership';
    const content = termsContent[currentTab]?.[currentLang] || termsContent[currentTab]?.da || '';
    state.termsOriginalContent = content;
  } else {
    // Hide search for non-tabbed content
    if (DOM.termsModalSearch) {
      DOM.termsModalSearch.style.display = 'none';
    }
    // Hide tabs for other types
    if (DOM.termsModalTabs) {
      DOM.termsModalTabs.style.display = 'none';
    }
    
    const title = termsTitles[termsType]?.[currentLang] || termsTitles[termsType]?.da || 'Terms and Conditions';
    const content = termsContent[termsType]?.[currentLang] || termsContent[termsType]?.da || '<p>Content not available.</p>';
    
    if (!termsContent[termsType]) {
      console.error('Invalid terms type:', termsType);
      return;
    }
    
    // Set title
    DOM.termsModalTitle.textContent = title;
    
    // Set content
    DOM.termsModalContent.innerHTML = content;
    state.termsOriginalContent = content;
  }
  
  // Clear search when opening modal
  if (DOM.termsSearchInput) {
    DOM.termsSearchInput.value = '';
    if (DOM.termsSearchClear) {
      DOM.termsSearchClear.style.display = 'none';
    }
  }
  
  // Show modal
  DOM.termsModal.style.display = 'flex';
  DOM.termsModalContent.style.display = 'block';
  if (DOM.termsModalLoading) {
    DOM.termsModalLoading.style.display = 'none';
  }
  document.body.classList.add('modal-open');
  
  // Scroll to top of modal content
  DOM.termsModalContent.scrollTop = 0;
}

function switchTermsTab(tabType) {
  if (!DOM.termsModalTabs || !DOM.termsModalContent) return;
  
  state.currentModalTab = tabType;
  
  // Clear search when switching tabs
  if (DOM.termsSearchInput) {
    DOM.termsSearchInput.value = '';
    clearTermsSearch();
  }
  
  // Update active tab
  const tabs = DOM.termsModalTabs.querySelectorAll('.terms-tab');
  tabs.forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabType) {
      tab.classList.add('active');
    }
  });
  
  // Update tab labels based on language
  // Terms tabs are now handled by updatePageTranslations via data-i18n-key
  // This function can be removed or simplified
  tabs.forEach(tab => {
    const key = tab.getAttribute('data-i18n-key');
    if (key) {
      tab.textContent = t(key);
    }
  });
  
  // Load content for selected tab
  // Convert da-DK to da, en-GB to en for content lookup
  const langCode = (state.language || DEFAULT_LANGUAGE).split('-')[0];
  const content = termsContent[tabType]?.[langCode] || termsContent[tabType]?.da || '<p>Content not available.</p>';
  
  if (termsContent[tabType]) {
    DOM.termsModalContent.innerHTML = content;
    state.termsOriginalContent = content;
    DOM.termsModalContent.scrollTop = 0;
  }
}

function performTermsSearch(searchQuery) {
  if (!DOM.termsModalContent || !state.termsOriginalContent) return;
  
  const query = searchQuery.trim().toLowerCase();
  
  // Show/hide clear button
  if (DOM.termsSearchClear) {
    DOM.termsSearchClear.style.display = query ? 'flex' : 'none';
  }
  
  if (!query) {
    // Restore original content
    DOM.termsModalContent.innerHTML = state.termsOriginalContent;
    return;
  }
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = state.termsOriginalContent;
  
  // Search and highlight function
  function highlightText(node, searchText) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const matches = text.match(regex);
      
      if (matches && matches.length > 0) {
        const parts = text.split(regex);
        const fragment = document.createDocumentFragment();
        
        parts.forEach((part, index) => {
          if (part.toLowerCase() === searchText.toLowerCase()) {
            const highlight = document.createElement('span');
            highlight.className = 'search-highlight';
            highlight.textContent = part;
            fragment.appendChild(highlight);
          } else if (part) {
            fragment.appendChild(document.createTextNode(part));
          }
        });
        
        return fragment;
      }
      return null;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip script and style tags
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
        return null;
      }
      
      const clone = node.cloneNode(false);
      let hasMatch = false;
      
      Array.from(node.childNodes).forEach(child => {
        const result = highlightText(child, searchText);
        if (result) {
          clone.appendChild(result);
          hasMatch = true;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          // Check if element contains the search text
          if (child.textContent.toLowerCase().includes(searchText)) {
            clone.appendChild(child.cloneNode(true));
            hasMatch = true;
          }
        } else if (child.nodeType === Node.TEXT_NODE) {
          clone.appendChild(child.cloneNode(true));
        }
      });
      
      return hasMatch ? clone : null;
    }
    return null;
  }
  
  // Perform search
  const highlightedContent = highlightText(tempDiv, query);
  
  if (highlightedContent) {
    DOM.termsModalContent.innerHTML = '';
    DOM.termsModalContent.appendChild(highlightedContent);
  } else {
    // No results found
    DOM.termsModalContent.innerHTML = '<div class="search-no-results">No results found for "' + searchQuery + '"</div>';
  }
  
  // Scroll to first match
  const firstHighlight = DOM.termsModalContent.querySelector('.search-highlight');
  if (firstHighlight) {
    firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function clearTermsSearch() {
  if (!DOM.termsSearchInput || !DOM.termsModalContent) return;
  
  DOM.termsSearchInput.value = '';
  if (DOM.termsSearchClear) {
    DOM.termsSearchClear.style.display = 'none';
  }
  
  // Restore original content
  if (state.termsOriginalContent) {
    DOM.termsModalContent.innerHTML = state.termsOriginalContent;
    DOM.termsModalContent.scrollTop = 0;
  }
}

// Legacy function - language is now managed by state.language
// This function is kept for backward compatibility but does nothing
function updateLanguageSwitcher(modalType, lang) {
  // Language switching is now handled by changeLanguage() and updatePageTranslations()
  // Modal language switchers should use the main language switcher
}

function switchModalLanguage(modalType, lang) {
  // Language is now managed by state.language and changeLanguage()
  // Update translations for the modal
  updatePageTranslations();
  
  if (modalType === 'terms') {
    // Terms tabs are handled by updatePageTranslations via data-i18n-key
    
    // Update title
    const currentTab = state.currentModalTab || 'membership';
    if (state.currentModalType === 'terms') {
      const title = t('footer.terms.title');
      if (DOM.termsModalTitle) {
        DOM.termsModalTitle.textContent = title;
      }
      
      // Update tab labels (handled by updatePageTranslations via data-i18n-key)
      const tabs = DOM.termsModalTabs?.querySelectorAll('.terms-tab[data-i18n-key]');
      tabs?.forEach(tab => {
        const key = tab.getAttribute('data-i18n-key');
        if (key) {
          tab.textContent = t(key);
        }
      });
      
      // Update search placeholder (if needed, add to translations)
      // Reload content for current tab (this will clear search)
      switchTermsTab(currentTab);
      
      // Store original content for search after language switch
      // Convert da-DK to da, en-GB to en for content lookup
      const langCode = lang.split('-')[0];
      const content = termsContent[currentTab]?.[langCode] || termsContent[currentTab]?.da || '';
      state.termsOriginalContent = content;
    } else {
      // For non-tabbed content
      const termsTitles = {
        membership: {
          da: 'Vilkår og Betingelser for Medlemskab',
          en: 'Terms and Conditions for Membership',
        },
        punchcard: {
          da: 'Vilkår og Betingelser for Klippekort',
          en: 'Terms and Conditions for Punch Card',
        },
      };
      
      const title = termsTitles[state.currentModalType]?.[lang] || termsTitles[state.currentModalType]?.da || 'Terms and Conditions';
      const content = termsContent[state.currentModalType]?.[lang] || termsContent[state.currentModalType]?.da || '<p>Content not available.</p>';
      
      if (DOM.termsModalTitle) {
        DOM.termsModalTitle.textContent = title;
      }
      if (DOM.termsModalContent) {
        DOM.termsModalContent.innerHTML = content;
        state.termsOriginalContent = content;
        DOM.termsModalContent.scrollTop = 0;
      }
      
      // Clear search when switching language
      if (DOM.termsSearchInput) {
        DOM.termsSearchInput.value = '';
        if (DOM.termsSearchClear) {
          DOM.termsSearchClear.style.display = 'none';
        }
      }
    }
  } else if (modalType === 'privacy') {
    // Update data policy content
    // Convert da-DK to da, en-GB to en for content lookup
    const langCode = lang.split('-')[0];
    const content = termsContent.privacy?.[langCode] || termsContent.privacy?.da || '<p>Data policy content not available.</p>';
    
    if (DOM.dataPolicyModalContent) {
      DOM.dataPolicyModalContent.innerHTML = content;
      DOM.dataPolicyModalContent.scrollTop = 0;
    }
  }
}

function openDataPolicyModal() {
  if (!DOM.dataPolicyModal || !DOM.dataPolicyModalContent) return;
  
  state.currentModalType = 'privacy';
  
  // Language is managed by state.language - translations handled by updatePageTranslations
  updatePageTranslations();
  
  // Convert da-DK to da, en-GB to en for content lookup
  const langCode = (state.language || DEFAULT_LANGUAGE).split('-')[0];
  const content = termsContent.privacy?.[langCode] || termsContent.privacy?.da || '<p>Data policy content not available.</p>';
  
  // Set content
  DOM.dataPolicyModalContent.innerHTML = content;
  
  // Show modal
  DOM.dataPolicyModal.style.display = 'flex';
  DOM.dataPolicyModalContent.style.display = 'block';
  if (DOM.dataPolicyModalLoading) {
    DOM.dataPolicyModalLoading.style.display = 'none';
  }
  document.body.classList.add('modal-open');
  
  // Scroll to top of modal content
  DOM.dataPolicyModalContent.scrollTop = 0;
}

function closeTermsModal() {
  if (!DOM.termsModal) return;
  
  // Clear content
  if (DOM.termsModalContent) {
    DOM.termsModalContent.innerHTML = '';
  }
  
  // Clear search
  if (DOM.termsSearchInput) {
    DOM.termsSearchInput.value = '';
  }
  if (DOM.termsSearchClear) {
    DOM.termsSearchClear.style.display = 'none';
  }
  
  // Reset state
  state.currentModalType = null;
  state.currentModalTab = null;
  state.termsOriginalContent = null;
  
  // Hide modal
  DOM.termsModal.style.display = 'none';
  document.body.classList.remove('modal-open');
}

function closeDataPolicyModal() {
  if (!DOM.dataPolicyModal) return;
  
  // Clear content
  if (DOM.dataPolicyModalContent) {
    DOM.dataPolicyModalContent.innerHTML = '';
  }
  
  // Reset state
  state.currentModalType = null;
  
  // Hide modal
  DOM.dataPolicyModal.style.display = 'none';
  document.body.classList.remove('modal-open');
}

async function handleForgotPasswordSubmit(event) {
  event.preventDefault();
  
  if (!DOM.forgotPasswordEmail) return;
  
  const email = DOM.forgotPasswordEmail.value.trim();
  
  if (!email) {
    showToast('Please enter your email address.', 'error');
    DOM.forgotPasswordEmail.closest('.form-group')?.classList.add('error');
    return;
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('Please enter a valid email address.', 'error');
    DOM.forgotPasswordEmail.closest('.form-group')?.classList.add('error');
    return;
  }
  
  // Remove error state
  DOM.forgotPasswordEmail.closest('.form-group')?.classList.remove('error');
  
  // Disable form during submission
  const submitButton = DOM.forgotPasswordForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton?.textContent || 'SEND RESET LINK';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
  }
  
  try {
    console.log('[Forgot Password] Requesting password reset for:', email);
    await authAPI.resetPassword(email);
    
    // Show success message
    DOM.forgotPasswordForm.style.display = 'none';
    DOM.forgotPasswordSuccess.style.display = 'block';
    
    showToast('Password reset instructions have been sent to your email.', 'success');
    
    console.log('[Forgot Password] Password reset request successful');
  } catch (error) {
    console.error('[Forgot Password] Password reset failed:', error);
    showToast(getErrorMessage(error, 'Password reset'), 'error');
    
    // Re-enable form
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
}

function refreshHeaderAuthIndicator() {
  const headerContent = document.getElementById('headerContent');
  const headerAuthIndicator = document.getElementById('headerAuthIndicator');
  const headerAuthEmail = document.getElementById('headerAuthEmail');
  const headerLogoutBtn = document.getElementById('headerLogoutBtn');
  
  if (!headerAuthIndicator) return;
  
  const authenticated = isUserAuthenticated();
  
  // Always show the header (logo should always be visible)
  if (headerContent) {
    headerContent.style.display = 'block';
  }
  
  if (!authenticated) {
    // Hide auth indicator when not authenticated, but keep header visible
    headerAuthIndicator.style.display = 'none';
    return;
  }
  
  // Get email from various sources
  const metadata = getTokenMetadata();
  const customer = state.authenticatedCustomer;
  const emailDisplay = state.authenticatedEmail || customer?.email || metadata?.email || metadata?.username || 'User';
  
  // Update email display
  if (headerAuthEmail) {
    headerAuthEmail.textContent = emailDisplay;
  }
  
  // Show the indicator
  headerAuthIndicator.style.display = 'flex';
}

function refreshLoginUI() {
  // Update header auth indicator first
  refreshHeaderAuthIndicator();
  
  if (!DOM.loginStatus && !DOM.loginFormContainer) {
    return;
  }

  const authenticated = isUserAuthenticated();
  const metadata = getTokenMetadata();
  const customer = state.authenticatedCustomer;
  
  // Get form data if available (for recently saved accounts)
  let formData = null;
  try {
    formData = buildCheckoutPayload();
  } catch (e) {
    // Ignore errors if form is not ready
  }
  const formCustomer = formData?.customer;
  
  // Determine display values
  const emailDisplay = state.authenticatedEmail || customer?.email || metadata?.email || metadata?.username || 'Account';
  
  // Get full name from customer data or form data
  let nameDisplay = null;
  if (customer?.firstName && customer?.lastName) {
    nameDisplay = `${customer.firstName} ${customer.lastName}`;
  } else if (customer?.firstName) {
    nameDisplay = customer.firstName;
  } else if (customer?.lastName) {
    nameDisplay = customer.lastName;
  } else if (formCustomer?.firstName && formCustomer?.lastName) {
    nameDisplay = `${formCustomer.firstName} ${formCustomer.lastName}`;
  } else if (formCustomer?.firstName) {
    nameDisplay = formCustomer.firstName;
  } else if (formCustomer?.lastName) {
    nameDisplay = formCustomer.lastName;
  }
  
  // Debug logging
  if (authenticated && !nameDisplay) {
    console.log('[refreshLoginUI] No name found. Customer:', customer);
    console.log('[refreshLoginUI] Form customer:', formCustomer);
    console.log('[refreshLoginUI] Metadata:', metadata);
  }

  if (DOM.loginStatus) {
    DOM.loginStatus.style.display = authenticated ? 'block' : 'none';
  }
  
  // Update name display (order: 1)
  if (DOM.loginStatusName && DOM.loginStatusNameRow) {
    if (nameDisplay) {
      DOM.loginStatusName.textContent = nameDisplay;
      DOM.loginStatusNameRow.style.display = 'flex';
    } else {
      DOM.loginStatusNameRow.style.display = 'none';
    }
  }
  
  // Update date of birth display (order: 2)
  if (DOM.loginStatusDob && DOM.loginStatusDobRow) {
    let dobDisplay = null;
    const dobSource = customer?.dateOfBirth || customer?.birthDate || formCustomer?.dateOfBirth;
    if (dobSource) {
      if (typeof dobSource === 'string') {
        // Format date string if needed (YYYY-MM-DD to DD/MM/YYYY)
        const dateMatch = dobSource.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          dobDisplay = `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
        } else {
          dobDisplay = dobSource;
        }
      } else if (dobSource.year && dobSource.month && dobSource.day) {
        dobDisplay = `${String(dobSource.day).padStart(2, '0')}/${String(dobSource.month).padStart(2, '0')}/${dobSource.year}`;
      }
    }
    if (dobDisplay) {
      DOM.loginStatusDob.textContent = dobDisplay;
      DOM.loginStatusDobRow.style.display = 'flex';
    } else {
      DOM.loginStatusDobRow.style.display = 'none';
    }
  }
  
  // Update email display (order: 3)
  if (DOM.loginStatusEmail && DOM.loginStatusEmailRow) {
    if (emailDisplay && emailDisplay !== 'Account') {
      DOM.loginStatusEmail.textContent = emailDisplay;
      DOM.loginStatusEmailRow.style.display = 'flex';
    } else {
      DOM.loginStatusEmailRow.style.display = 'none';
    }
  }
  
  // Update address display (order: 4)
  if (DOM.loginStatusAddress && DOM.loginStatusAddressRow) {
    let addressParts = [];
    const addressSource =
      customer?.address ||
      customer?.shippingAddress ||
      customer?.streetAddress ||
      customer?.addressLine1 ||
      formCustomer?.address;
    const postalCodeSource =
      customer?.postalCode ||
      customer?.zip ||
      customer?.shippingAddress?.postalCode ||
      formCustomer?.address?.postalCode;
    const citySource =
      customer?.city ||
      customer?.shippingAddress?.city ||
      customer?.addressCity ||
      formCustomer?.address?.city;
    
    if (addressSource) {
      if (typeof addressSource === 'string') {
        addressParts.push(addressSource);
      } else if (addressSource.street) {
        addressParts.push(addressSource.street);
      }
    }
    if (postalCodeSource) {
      addressParts.push(postalCodeSource);
    }
    if (citySource) {
      addressParts.push(citySource);
    }
    const addressDisplay = addressParts.length > 0 ? addressParts.join(', ') : null;
    if (addressDisplay) {
      DOM.loginStatusAddress.textContent = addressDisplay;
      DOM.loginStatusAddressRow.style.display = 'flex';
    } else {
      DOM.loginStatusAddressRow.style.display = 'none';
    }
  }
  
  // Update phone number display (order: 5)
  if (DOM.loginStatusPhone && DOM.loginStatusPhoneRow) {
    let phoneDisplay = null;
    const phoneSource =
      customer?.mobilePhone ||
      customer?.phone ||
      customer?.phoneNumber ||
      formCustomer?.phone;
    const phoneCountryCodeSource =
      customer?.phoneCountryCode ||
      customer?.phoneCountry ||
      formCustomer?.phone?.countryCode;
    
    if (phoneSource) {
      if (typeof phoneSource === 'string') {
        phoneDisplay = phoneSource;
      } else if (phoneSource.number) {
        const countryCode = phoneSource.countryCode || phoneCountryCodeSource || '';
        phoneDisplay = countryCode ? `${countryCode} ${phoneSource.number}` : phoneSource.number;
      }
    } else if (formCustomer?.phoneNumber && formCustomer?.countryCode) {
      phoneDisplay = `${formCustomer.countryCode} ${formCustomer.phoneNumber}`;
    }
    
    if (phoneDisplay) {
      DOM.loginStatusPhone.textContent = phoneDisplay;
      DOM.loginStatusPhoneRow.style.display = 'flex';
    } else {
      DOM.loginStatusPhoneRow.style.display = 'none';
    }
  }
  
  if (DOM.loginFormContainer) {
    DOM.loginFormContainer.style.display = authenticated ? 'none' : '';
  }
  
  // Hide form-container when logged in, but keep login-status visible
  // Move login-status outside form-container when authenticated so it remains visible
  if (DOM.loginFormContainerWrapper && DOM.loginStatus) {
    if (authenticated) {
      // Hide form-container
      DOM.loginFormContainerWrapper.style.display = 'none';
      
      // Move login-status outside form-container to keep it visible
      // Find the parent of form-container (info-section)
      const formContainerParent = DOM.loginFormContainerWrapper.parentElement;
      if (formContainerParent && DOM.loginStatus.parentElement === DOM.loginFormContainerWrapper) {
        // Move login-status to be a sibling of form-container
        formContainerParent.insertBefore(DOM.loginStatus, DOM.loginFormContainerWrapper);
        DOM.loginStatus.style.display = 'block';
      }
    } else {
      // Show form-container when not authenticated
      DOM.loginFormContainerWrapper.style.display = '';
      
      // Move login-status back inside form-container if it was moved out
      if (DOM.loginStatus.parentElement !== DOM.loginFormContainerWrapper) {
        // Insert login-status as first child of form-container
        DOM.loginFormContainerWrapper.insertBefore(DOM.loginStatus, DOM.loginFormContainerWrapper.firstChild);
      }
    }
  }
  
  // Hide auth mode toggle when user is logged in
  if (DOM.authModeToggle) {
    DOM.authModeToggle.style.display = authenticated ? 'none' : '';
  }
  
  // Handle section visibility based on authentication state
  const createSection = document.querySelector('[data-auth-section="create"]');
  const loginSection = document.querySelector('[data-auth-section="login"]');
  
  if (authenticated) {
    // When logged in: hide create section, show login section (for login-status)
    if (createSection) {
      createSection.style.display = 'none';
    }
    if (loginSection) {
      loginSection.style.display = 'block';
    }
  } else {
    // When logged out: hide login section, create section visibility handled by switchAuthMode
    if (loginSection) {
      loginSection.style.display = 'none';
    }
    // Create section will be shown/hidden by switchAuthMode based on active tab
  }
}

async function handleSaveAccount() {
  const saveBtn = document.querySelector('[data-action="save-account"]');
  const messageDiv = document.getElementById('saveAccountMessage');
  
  if (!saveBtn || !messageDiv) {
    console.error('[Save Account] Save button or message div not found');
    return;
  }
  
  // Validate required fields
  const requiredFields = [
    { id: 'firstName', name: 'First name' },
    { id: 'lastName', name: 'Last name' },
    { id: 'dateOfBirth', name: 'Date of birth' },
    { id: 'streetAddress', name: 'Street address' },
    { id: 'postalCode', name: 'Postal code' },
    { id: 'email', name: 'Email' },
    { id: 'phoneNumber', name: 'Phone number' },
    { id: 'password', name: 'Password' },
  ];
  
  const missingFields = [];
  requiredFields.forEach(field => {
    const input = document.getElementById(field.id);
    if (!input || !input.value.trim()) {
      missingFields.push(field.name);
    }
  });
  
  // Validate password length
  const passwordInput = document.getElementById('password');
  if (passwordInput && passwordInput.value && passwordInput.value.length < 6) {
    showSaveAccountMessage('Password must be at least 6 characters long.', 'error');
    highlightFieldError('password', true);
    const saveBtn = document.querySelector('[data-action="save-account"]');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Account';
    }
    return;
  }
  
  // Validate parent password length if parent form is visible
  const parentPasswordInput = document.getElementById('parentPassword');
  const parentForm = document.getElementById('parentGuardianForm');
  if (parentPasswordInput && parentForm && parentForm.style.display !== 'none' && parentPasswordInput.value && parentPasswordInput.value.length < 6) {
    showSaveAccountMessage('Parent/Guardian password must be at least 6 characters long.', 'error');
    highlightFieldError('parentPassword', true);
    const saveBtn = document.querySelector('[data-action="save-account"]');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Account';
    }
    return;
  }
  
  if (missingFields.length > 0) {
    showSaveAccountMessage(`Please fill in all required fields: ${missingFields.join(', ')}`, 'error');
    // Animate save account button with red flash and highlight missing fields
    const saveBtn = document.querySelector('[data-action="save-account"]');
    if (saveBtn) {
      saveBtn.classList.remove('error-flash');
      // Trigger reflow to restart animation
      void saveBtn.offsetWidth;
      saveBtn.classList.add('error-flash');
      setTimeout(() => {
        saveBtn.classList.remove('error-flash');
      }, 600);
    }
    
    // Highlight missing fields with shake animation
    requiredFields.forEach(field => {
      const input = document.getElementById(field.id);
      if (!input || !input.value.trim()) {
        highlightFieldError(field.id, true); // Animate when triggered from button click
      }
    });
    return;
  }
  
  // Set loading state
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  messageDiv.style.display = 'none';
  
  try {
    // Build customer data from form
    const payload = buildCheckoutPayload();
    
    // Also read form fields directly as fallback to ensure we get all values
    const phoneNumberField = document.getElementById('phoneNumber');
    const countryCodeField = document.getElementById('countryCode');
    const dateOfBirthField = document.getElementById('dateOfBirth');
    
    // Get phone number and country code
    const phoneNumber = payload.customer?.phone?.number || phoneNumberField?.value?.trim() || payload.customer?.phone;
    const phoneCountryCode = payload.customer?.phone?.countryCode || countryCodeField?.value?.trim() || '+45';
    
    // Build mobilePhone object if we have phone number
    let mobilePhone = null;
    if (phoneNumber) {
      mobilePhone = {
        countryCode: phoneCountryCode,
        number: phoneNumber
      };
    }
    
    // Get date of birth and convert to birthDate format if needed
    let birthDate = payload.customer?.dateOfBirth || dateOfBirthField?.value?.trim();
    // If dateOfBirth is in YYYY-MM-DD format, keep it (API might accept this)
    // Otherwise, ensure it's in the correct format
    
    // Get address fields
    const streetAddress = payload.customer?.address?.street || document.getElementById('streetAddress')?.value?.trim() || payload.customer?.address;
    const city = payload.customer?.address?.city || document.getElementById('city')?.value?.trim() || payload.customer?.city;
    const postalCode = payload.customer?.address?.postalCode || document.getElementById('postalCode')?.value?.trim() || payload.customer?.postalCode;
    // Country is always Denmark (DK) for this application
    const country = 'DK';
    
    // Build shippingAddress object if we have address data (API expects shippingAddress)
    let shippingAddress = null;
    if (streetAddress || city || postalCode) {
      shippingAddress = {};
      if (streetAddress) shippingAddress.street = streetAddress;
      if (city) shippingAddress.city = city;
      if (postalCode) shippingAddress.postalCode = postalCode;
      shippingAddress.country = country; // Always DK
    }
    
    const customerData = {
      email: payload.customer?.email || document.getElementById('email')?.value?.trim(),
      firstName: payload.customer?.firstName || document.getElementById('firstName')?.value?.trim(),
      lastName: payload.customer?.lastName || document.getElementById('lastName')?.value?.trim(),
      mobilePhone: mobilePhone, // API expects mobilePhone object with countryCode and number
      birthDate: birthDate, // API expects birthDate (not dateOfBirth)
      shippingAddress: shippingAddress, // API expects shippingAddress object
      address: streetAddress, // Keep for backward compatibility
      city: city, // Keep for backward compatibility
      postalCode: postalCode, // Keep for backward compatibility - ensure it's always included
      country: country, // Always DK
      primaryGym: payload.customer?.primaryGym || state.selectedBusinessUnit,
      password: payload.customer?.password || document.getElementById('password')?.value,
      customerType: 1, // Required by API
      ...(payload.consent?.marketing !== undefined && { allowMassSendEmail: payload.consent.marketing }),
    };
    
    // Also include phone and phoneCountryCode for backward compatibility (remove if not needed)
    if (phoneNumber) {
      customerData.phone = phoneNumber;
      customerData.phoneCountryCode = phoneCountryCode;
    }
    
    // Also include dateOfBirth for backward compatibility
    if (birthDate) {
      customerData.dateOfBirth = birthDate;
    }
    
    // Log the payload and customerData for debugging
    console.log('[Save Account] Payload from buildCheckoutPayload:', JSON.stringify(payload, null, 2));
    console.log('[Save Account] Customer data before cleanup:', JSON.stringify(customerData, null, 2));
    
    // Remove undefined/null/empty string values (but keep 0 and false)
    // IMPORTANT: Don't remove postalCode, mobilePhone, birthDate, or shippingAddress even if they seem empty
    // as they might be objects or have nested values
    Object.keys(customerData).forEach(key => {
      const value = customerData[key];
      // Skip removal for complex objects
      if (key === 'mobilePhone' || key === 'shippingAddress') {
        // Only remove if it's null/undefined, not if it's an empty object
        if (value === null || value === undefined) {
          delete customerData[key];
        }
      } else if (value === undefined || value === null || value === '') {
        delete customerData[key];
      }
    });
    
    // Ensure postalCode is included in shippingAddress if it exists
    if (customerData.shippingAddress && postalCode && !customerData.shippingAddress.postalCode) {
      customerData.shippingAddress.postalCode = postalCode;
    }
    
    // Also ensure postalCode is at top level if shippingAddress exists
    if (customerData.shippingAddress && postalCode) {
      customerData.postalCode = postalCode;
    }
    
    console.log('[Save Account] Customer data after cleanup:', JSON.stringify(customerData, null, 2));
    
    // Pre-check: Verify email is not already in use
    const email = customerData.email?.toLowerCase().trim();
    if (email) {
      // Check if user is already logged in with this email
      const authenticatedEmail = state.authenticatedEmail || 
        (typeof window.getTokenMetadata === 'function' && window.getTokenMetadata()?.email);
      if (authenticatedEmail && authenticatedEmail.toLowerCase() === email) {
        showSaveAccountMessage('You are already logged in with this email address.', 'error');
        showToast('You are already logged in with this email.', 'error');
        return;
      }
      
      // Check if we've already created an account with this email in this session
      if (state.createdEmails.has(email)) {
        showSaveAccountMessage('An account with this email address has already been created in this session. Please log in instead.', 'error');
        showToast('Account already created. Please log in.', 'error');
        switchAuthMode('login', email);
        return;
      }
      
      // Check localStorage for previously created emails
      try {
        const storedEmails = JSON.parse(localStorage.getItem('boulders_created_emails') || '[]');
        if (storedEmails.includes(email)) {
          showSaveAccountMessage('An account with this email address already exists. Please log in instead.', 'error');
          showToast('Account already exists. Please log in.', 'error');
          switchAuthMode('login', email);
          return;
        }
      } catch (e) {
        console.warn('[Save Account] Could not check localStorage:', e);
      }
      
      // If the backend allows duplicate creation when password matches, prevent it by probing login.
      const passwordForExistingCheck = customerData.password || document.getElementById('password')?.value;
      if (passwordForExistingCheck) {
        try {
          await authAPI.login(email, passwordForExistingCheck, { saveTokens: false });
          showSaveAccountMessage('An account with this email address already exists. Please log in instead.', 'error');
          showToast('Account already exists. Please log in.', 'error');
          switchAuthMode('login', email);
          return;
        } catch (probeError) {
          const probeMessage = probeError?.message || '';
          const isInvalidCredentials =
            probeMessage.includes('Login failed: 401') ||
            probeMessage.includes('INVALID_CREDENTIALS');
          if (!isInvalidCredentials) {
            throw probeError;
          }
        }
      }

      // Note: We don't check via login for non-matching passwords because the API returns INVALID_CREDENTIALS
      // for both "account doesn't exist" and "wrong password" for security reasons.
      // We rely on:
      // 1. Session tracking (state.createdEmails)
      // 2. localStorage tracking
      // 3. API duplicate detection (which will catch it during account creation)
      console.log('[Save Account] Proceeding with account creation. Duplicate detection will be handled by API.');
    }
    
    console.log('[Save Account] Creating customer account...');
    const customer = await authAPI.createCustomer(customerData);
    
    // Log the full customer creation response to check for tokens
    console.log('[Save Account] Customer creation response:', JSON.stringify(customer, null, 2));
    
    // Track this email as used for account creation
    if (email) {
      state.createdEmails.add(email);
      // Also store in localStorage for persistence across sessions
      try {
        const storedEmails = JSON.parse(localStorage.getItem('boulders_created_emails') || '[]');
        if (!storedEmails.includes(email)) {
          storedEmails.push(email);
          localStorage.setItem('boulders_created_emails', JSON.stringify(storedEmails));
        }
      } catch (e) {
        console.warn('[Save Account] Could not store email in localStorage:', e);
      }
    }
    
    // Extract customer ID from response
    const customerId = customer?.data?.id || customer?.id || customer?.customerId || customer?.data?.customerId;
    
    if (customerId) {
      // Store customer ID in state
      state.customerId = customerId;
      
      let hasTokens = false;
      
      // Save tokens if provided in customer creation response
      if (customer?.accessToken && customer?.refreshToken) {
        if (typeof window.saveTokens === 'function') {
          const metadata = {
            username: customer?.username || customerData.email,
            email: customerData.email,
            roles: customer?.roles,
          };
          window.saveTokens(customer.accessToken, customer.refreshToken, undefined, metadata);
          syncAuthenticatedCustomerState(metadata.username, metadata.email);
          hasTokens = true;
          console.log('[Save Account] ✅ Tokens saved from customer creation response');
        }
      } else if (customer?.data?.accessToken && customer?.data?.refreshToken) {
        if (typeof window.saveTokens === 'function') {
          const metadata = {
            username: customer?.data?.username || customerData.email,
            email: customerData.email,
            roles: customer?.data?.roles,
          };
          window.saveTokens(customer.data.accessToken, customer.data.refreshToken, undefined, metadata);
          syncAuthenticatedCustomerState(metadata.username, metadata.email);
          hasTokens = true;
          console.log('[Save Account] ✅ Tokens saved from customer creation response (nested in data)');
        }
      }
      
      // If tokens are not provided in account creation response, automatically log in
      // Get password directly from form field to ensure we have it even if it was removed from customerData
      const password = customerData.password || document.getElementById('password')?.value;
      if (!hasTokens && email && password) {
        try {
          console.log('[Save Account] Tokens not provided, automatically logging in...');
          // Add a small delay to avoid hitting rate limits immediately after account creation
          await new Promise(resolve => setTimeout(resolve, 500));
          const loginResponse = await authAPI.login(email, password);
          const loginPayload = loginResponse?.data ?? loginResponse;
          const username = loginPayload?.username || email;
          
          // Extract and save tokens from login response
          const loginAccessToken = loginPayload?.accessToken || loginPayload?.access_token;
          const loginRefreshToken = loginPayload?.refreshToken || loginPayload?.refresh_token;
          let loginExpiresAt = loginPayload?.expiresAt || loginPayload?.expires_at;
          const loginExpiresIn = loginPayload?.expiresIn || loginPayload?.expires_in;
          if (!loginExpiresAt && loginExpiresIn) {
            const expiresInMs = Number(loginExpiresIn) * 1000;
            loginExpiresAt = Date.now() + (Number.isFinite(expiresInMs) ? expiresInMs : 0);
          }
          
          if (loginAccessToken && loginRefreshToken && typeof window.saveTokens === 'function') {
            const loginMetadata = {
              username: username,
              email: email,
              roles: loginPayload?.roles,
              tokenType: loginPayload?.tokenType || loginPayload?.token_type,
              expiresIn: loginPayload?.expiresIn || loginPayload?.expires_in,
            };
            window.saveTokens(loginAccessToken, loginRefreshToken, loginExpiresAt, loginMetadata);
            console.log('[Save Account] ✅ Tokens saved from login response');
          }
          
          // Sync customer state and fetch profile (syncAuthenticatedCustomerState will fetch and refresh UI)
          await syncAuthenticatedCustomerState(username, email);
          
          hasTokens = true; // Mark as logged in
          console.log('[Save Account] ✅ Successfully logged in after account creation');
        } catch (loginError) {
          console.warn('[Save Account] Auto-login failed:', loginError);
          
          // Handle rate limit errors specifically
          const errorMessage = loginError.message || String(loginError);
          if (errorMessage.includes('429') || errorMessage.includes('Rate limit') || errorMessage.includes('Too many requests')) {
            // Extract retryAfter if available
            let retryAfterSeconds = 60; // Default 1 minute
            const retryAfterMatch = errorMessage.match(/retryAfter["\s:]*(\d+)/i);
            if (retryAfterMatch) {
              retryAfterSeconds = parseInt(retryAfterMatch[1], 10);
            }
            const retryMinutes = Math.ceil(retryAfterSeconds / 60);
            
            console.warn(`[Save Account] Rate limit hit. Will retry login automatically in ${retryMinutes} minute(s)`);
            showSaveAccountMessage(`Account saved successfully! Login temporarily rate-limited. Please log in manually to continue, or wait ${retryMinutes} minute(s) and refresh.`, 'error');
            showToast('Account saved! Login rate-limited. Please log in manually.', 'warning');
          } else {
            // Other login errors
            console.warn('[Save Account] Auto-login failed, user will need to log in manually:', loginError);
            showSaveAccountMessage('Account saved successfully! Please log in to continue.', 'success');
            showToast('Account saved successfully!', 'success');
          }
        }
      }
      
      // Store customer data from form temporarily until profile is fetched
      if (!state.authenticatedCustomer && customerData) {
        state.authenticatedCustomer = {
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          email: customerData.email,
          dateOfBirth: customerData.dateOfBirth,
          address: customerData.address,
          city: customerData.city,
          postalCode: customerData.postalCode,
          phone: customerData.phone,
          phoneCountryCode: customerData.phoneCountryCode,
        };
        console.log('[Save Account] Stored customer data from form:', state.authenticatedCustomer);
      }
      
      // Fetch customer profile if tokens are available (always fetch to get complete data)
      if (hasTokens && customerId) {
        try {
          const customerProfile = await authAPI.getCustomer(customerId);
          state.authenticatedCustomer = customerProfile;
          console.log('[Save Account] Customer profile loaded:', customerProfile);
          // Refresh UI to show all profile fields
          refreshLoginUI();
        } catch (profileError) {
          console.warn('[Save Account] Could not fetch customer profile:', profileError);
          // Keep the form data we stored above and refresh UI
          refreshLoginUI();
        }
      }
      
      // Refresh login UI
      refreshLoginUI();
      
      // Show appropriate message based on whether user is logged in
      if (hasTokens) {
        showSaveAccountMessage('Account saved successfully! You are now logged in. You can proceed to checkout.', 'success');
        showToast('Account saved and logged in successfully!', 'success');
        
        // Auto-create order and attach subscription if on step 4
        if (state.currentStep === 4) {
          try {
            await ensureOrderCreated('profile-create');
            await ensureSubscriptionAttached('profile-create');
            updatePaymentOverview();
          } catch (orderError) {
            console.warn('[Save Account] Auto order creation after login failed:', orderError);
          }
        }
      } else {
        showSaveAccountMessage('Account saved successfully! Please log in to continue.', 'success');
        showToast('Account saved successfully!', 'success');
      }
    } else {
      throw new Error('Customer ID not found in response');
    }
  } catch (error) {
    console.error('[Save Account] Error saving account:', error);
    
    // Handle invalid email error specifically
    if (error.isInvalidEmail) {
      showSaveAccountMessage('Please enter a valid email address.', 'error');
      showToast('Please enter a valid email address.', 'error');
      highlightFieldError('email', true);
    } else if (error.isDuplicateEmail || (error.message && error.message.includes('already exists'))) {
      const email = document.getElementById('email')?.value?.trim() || '';
      const duplicateMessage = `An account with this email address${email ? ` (${email})` : ''} already exists. Please log in instead.`;
      showSaveAccountMessage(duplicateMessage, 'error');
      showToast('Account already exists. Please log in.', 'error');
      
      // Highlight the email field
      const emailInput = document.getElementById('email');
      if (emailInput) {
        emailInput.closest('.form-group')?.classList.add('error');
      }
      
      // Switch to login view and populate email field
      if (email) {
        switchAuthMode('login', email);
      } else {
        switchAuthMode('login');
      }
    } else {
      const errorMessage = error.message || 'Failed to save account. Please try again.';
      showSaveAccountMessage(errorMessage, 'error');
      showToast('Failed to save account', 'error');
    }
  } finally {
    // Reset button state
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Account';
  }
}

function showSaveAccountMessage(message, type = 'success') {
  const messageDiv = document.getElementById('saveAccountMessage');
  if (!messageDiv) return;
  
  messageDiv.textContent = message;
  messageDiv.className = `save-account-message ${type}`;
  messageDiv.style.display = 'block';
  
  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 5000);
  }
}

function checkSaveAccountButtonState() {
  const saveBtn = document.querySelector('[data-action="save-account"]');
  if (!saveBtn) return;
  
  // Check if we're on the create account section
  const createSection = document.querySelector('[data-auth-section="create"]');
  if (!createSection || createSection.style.display === 'none') {
    saveBtn.classList.remove('valid');
    return;
  }
  
  // Validate required fields
  const requiredFields = [
    'firstName',
    'lastName',
    'dateOfBirth',
    'streetAddress',
    'postalCode',
    'email',
    'phoneNumber',
    'password',
  ];
  
  let allFieldsFilled = true;
  requiredFields.forEach(fieldId => {
    const input = document.getElementById(fieldId);
    if (!input || !input.value.trim()) {
      allFieldsFilled = false;
    }
  });
  
  // Add 'valid' class if all fields are filled
  if (allFieldsFilled) {
    saveBtn.classList.add('valid');
  } else {
    saveBtn.classList.remove('valid');
  }
}

function showLogoutConfirmation() {
  // Create confirmation modal
  const confirmationOverlay = document.createElement('div');
  confirmationOverlay.className = 'logout-confirmation-overlay';
  confirmationOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    backdrop-filter: blur(4px);
  `;
  
  const confirmationDialog = document.createElement('div');
  confirmationDialog.className = 'logout-confirmation-dialog';
  confirmationDialog.style.cssText = `
    background: rgba(31, 41, 55, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    text-align: center;
    color: rgba(255, 255, 255, 0.9);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  `;
  
  confirmationDialog.innerHTML = `
    <h3 style="margin: 0 0 16px 0; color: #FFFFFF; font-size: 18px; font-weight: 600;">Log out?</h3>
    <p style="margin: 0 0 24px 0; color: rgba(255, 255, 255, 0.7); line-height: 1.5; font-size: 14px;">
      Are you sure you want to log out? You'll need to log in again to continue.
    </p>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button class="logout-confirmation-btn logout-confirmation-cancel" style="
        padding: 10px 20px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        background: transparent;
        color: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        transition: all 0.2s ease;
      ">Cancel</button>
      <button class="logout-confirmation-btn logout-confirmation-confirm" style="
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #F87171;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.2s ease;
      ">Log out</button>
    </div>
  `;
  
  confirmationOverlay.appendChild(confirmationDialog);
  document.body.appendChild(confirmationOverlay);
  
  // Add hover effects
  const cancelBtn = confirmationOverlay.querySelector('.logout-confirmation-cancel');
  const confirmBtn = confirmationOverlay.querySelector('.logout-confirmation-confirm');
  
  if (cancelBtn) {
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      cancelBtn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = 'transparent';
      cancelBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });
  }
  
  if (confirmBtn) {
    confirmBtn.addEventListener('mouseenter', () => {
      confirmBtn.style.background = 'rgba(239, 68, 68, 0.3)';
      confirmBtn.style.borderColor = 'rgba(239, 68, 68, 0.6)';
    });
    confirmBtn.addEventListener('mouseleave', () => {
      confirmBtn.style.background = 'rgba(239, 68, 68, 0.2)';
      confirmBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    });
  }
  
  // Add event listeners
  cancelBtn?.addEventListener('click', () => {
    document.body.removeChild(confirmationOverlay);
  });
  
  confirmBtn?.addEventListener('click', () => {
    document.body.removeChild(confirmationOverlay);
    handleLogout();
  });
  
  // Close on overlay click
  confirmationOverlay.addEventListener('click', (e) => {
    if (e.target === confirmationOverlay) {
      document.body.removeChild(confirmationOverlay);
    }
  });
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(confirmationOverlay);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function handleLogout() {
  // Clear customer profile data
  state.authenticatedCustomer = null;
  state.authenticatedEmail = null;
  state.customerId = null;
  
  if (typeof window.clearTokens === 'function') {
    window.clearTokens();
  }
  
  // Refresh UI to show logged out state
  refreshLoginUI();
  
  // Switch to create account mode when logging out
  switchAuthMode('create');
  
  showToast('You have been logged out.', 'info');
  
  // Dispatch event to notify React components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth-state-changed'));
  }
}

function renderCatalog() {
  // API-driven catalog: renderProductsFromAPI handles memberships/value cards
  // Add-ons are rendered from subscription additions when available
  renderAddons();
}

function renderMembershipPlans() {
  if (!templates.membership || !DOM.membershipPlans) return;
  if (typeof MEMBERSHIP_PLANS === 'undefined' || !Array.isArray(MEMBERSHIP_PLANS) || MEMBERSHIP_PLANS.length === 0) {
    return;
  }
  DOM.membershipPlans.innerHTML = '';
  DOM.membershipPlans.dataset.centerInitialized = 'false';

  MEMBERSHIP_PLANS.forEach((plan) => {
    const card = templates.membership.content.firstElementChild.cloneNode(true);
    card.dataset.planId = plan.id;

    const nameEl = card.querySelector('[data-element="name"]');
    const priceValueEl = card.querySelector('[data-element="priceValue"]');
    const priceSuffixEl = card.querySelector('[data-element="priceSuffix"]');
    const descriptionEl = card.querySelector('[data-element="description"]');
    const featuresEl = card.querySelector('[data-element="features"]');
    const buttonEl = card.querySelector('[data-action="select-membership"]');

    if (nameEl) nameEl.textContent = plan.name;
    if (priceValueEl) priceValueEl.textContent = formatPriceHalfKrone(roundToHalfKrone(plan.price));
    if (priceSuffixEl) priceSuffixEl.textContent = ` ${plan.priceSuffix}`;
    if (descriptionEl) descriptionEl.textContent = plan.description;
    if (featuresEl) {
      featuresEl.innerHTML = '';
      plan.features.forEach((feature) => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresEl.appendChild(li);
      });
    }
    if (buttonEl) {
      buttonEl.dataset.planId = plan.id;
      buttonEl.textContent = plan.cta ?? 'Select Plan';
    }

    card.addEventListener('click', (event) => handleMembershipCardClick(event, card));

    DOM.membershipPlans.appendChild(card);
  });
}

function handleGymSelection(item) {
  const gymIdString = item.dataset.gymId;
  const numericId = gymIdString ? gymIdString.replace('gym-', '') : null;
  
  // Remove selected class from all gym items
  document.querySelectorAll('.gym-item').forEach(gymItem => {
    gymItem.classList.remove('selected');
  });
  
  // Add selected class to clicked item
  item.classList.add('selected');
  
  // Step 3: Store the chosen unit in client state so every later request can reference it
  // Extract numeric ID from data attribute (format: "gym-{id}")
  // Note: numericId was already extracted above for early return check
  
  // Step 4: If business unit changed, clear cached reference data to force refresh
  const previousBusinessUnit = state.selectedBusinessUnit;
  if (previousBusinessUnit !== numericId) {
    state.referenceData = {};
    state.referenceDataLoaded = false;
  }
  
  state.selectedGymId = numericId; // Store numeric ID for API requests
  state.selectedBusinessUnit = numericId; // Also store as businessUnit for clarity
  
  // Store gym name for display - try multiple selectors
  let gymNameText = null;
  const gymNameElement = item.querySelector('.gym-name');
  if (gymNameElement) {
    gymNameText = gymNameElement.textContent.trim();
  }
  
  // Fallback: try to get from gymsWithDistances if DOM doesn't have it
  if (!gymNameText && gymsWithDistances && gymsWithDistances.length > 0) {
    const selectedGym = gymsWithDistances.find(gym => 
      String(gym.id) === String(numericId)
    );
    if (selectedGym && selectedGym.name) {
      gymNameText = selectedGym.name;
    }
  }
  
  if (gymNameText && gymNameText.trim() !== '') {
    state.selectedGymName = gymNameText.trim();
    console.log('[Gym Selection] ✅ Stored gym name:', state.selectedGymName, 'for ID:', numericId);
    // Immediately update display if we're already on step 2
    if (state.currentStep === 2) {
      setTimeout(() => updateSelectedGymDisplay(), 50);
    }
  } else {
    console.warn('[Gym Selection] ❌ Could not find gym name. Item:', item);
    console.warn('[Gym Selection] gymNameElement found:', !!gymNameElement);
    console.warn('[Gym Selection] gymsWithDistances length:', gymsWithDistances?.length || 0);
    if (gymsWithDistances && gymsWithDistances.length > 0) {
      console.warn('[Gym Selection] First 3 gyms:', gymsWithDistances.slice(0, 3).map(g => ({ id: String(g.id), name: g.name })));
    }
  }
  
  // Step 4: Load reference data after business unit selection
  // Cache responses in client state and refresh when business unit changes
  if (numericId) {
    loadReferenceData();
  }
  
  // Step 5: Pre-load products when business unit is selected (for faster step 2 loading)
  if (numericId) {
    loadProductsFromAPI();
  }
  
  // Update heads-up display
  updateGymHeadsUp(item);
  
  // Update selected gym display if we're on step 2
  if (state.currentStep === 2) {
    updateSelectedGymDisplay();
  }
  
  // Clear any pending gym navigation timeout to prevent double-clicks
  if (pendingNavigationTimeouts.gym) {
    clearTimeout(pendingNavigationTimeouts.gym);
    pendingNavigationTimeouts.gym = null;
  }
  
  // Only auto-advance if we're on step 1 (gym selection step)
  if (state.currentStep !== 1) {
    return;
  }
  
  // Auto-advance to next step after a short delay
  const timeoutGymId = numericId; // Capture gym ID at timeout creation to prevent stale navigation
  pendingNavigationTimeouts.gym = setTimeout(() => {
    // Read current state ONCE at timeout execution time (atomic read to prevent race conditions)
    const currentStepNow = state.currentStep;
    const selectedGymIdNow = state.selectedGymId;
    // Check if timeout is still valid BEFORE clearing it
    // If prevStep() cleared it, pendingNavigationTimeouts.gym will be null
    const timeoutStillValid = pendingNavigationTimeouts.gym !== null;
    
    // Clear timeout reference immediately to prevent double execution
    pendingNavigationTimeouts.gym = null;
    
    // Only navigate if ALL conditions are met:
    // 1. We're still on step 1 (where gym selection happens)
    // 2. The gym selection hasn't changed (same gym ID)
    // 3. The timeout wasn't cleared (still valid)
    if (timeoutStillValid && currentStepNow === 1 && state.currentStep === 1 && selectedGymIdNow === timeoutGymId) {
      // Final verification: ensure we're still on step 1 and haven't navigated away
      if (state.currentStep !== 1) {
        return; // State changed between check and navigation - abort
      }
      // Navigate to step 2 (next step after gym selection)
      nextStep(1);
    }
  }, 500);
}

// Update gym heads-up display
function updateGymHeadsUp(selectedItem) {
  const headsUp = document.getElementById('gymHeadsUp');
  const gymName = document.getElementById('selectedGymName');
  
  if (selectedItem && headsUp && gymName) {
    const gymNameText = selectedItem.querySelector('.gym-name').textContent;
    gymName.textContent = gymNameText;
    
    // Show heads-up with animation
    headsUp.classList.add('show');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      headsUp.classList.remove('show');
    }, 3000);
  }
}

// Update access type heads-up display
function updateAccessHeadsUp(selectedCard) {
  const headsUp = document.getElementById('accessHeadsUp');
  const accessName = document.getElementById('selectedAccessName');
  
  if (selectedCard && headsUp && accessName) {
    const planType = selectedCard.querySelector('.plan-type').textContent;
    const category = selectedCard.closest('.category-item').dataset.category;
    
    // Format the display name based on category and plan type
    let displayName = planType;
    if (category === 'punchcard') {
      displayName = `${planType} Punch Card`;
    } else if (category === 'campaign') {
      displayName = `${planType} Campaign`;
    } else if (category === 'membership') {
      displayName = `${planType} Membership`;
    } else if (category === '15daypass') {
      displayName = `${planType} 15 Day Pass`;
    }
    
    accessName.textContent = displayName;
    
    // Show heads-up with animation
    headsUp.classList.add('show');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      headsUp.classList.remove('show');
    }, 3000);
  }
}

// Sync punch card quantity UI
function syncPunchCardQuantityUI(card, planId) {
  const quantity = state.valueCardQuantities.get(planId) || 1;
  const pricePerUnit = parseInt(card.dataset.price) || 1200;
  const total = pricePerUnit * quantity;
  
  // Find the quantity panel (now a sibling of the card)
  const panel = card.nextElementSibling;
  if (!panel || !panel.classList.contains('quantity-panel')) return;
  
  const quantityValue = panel.querySelector('[data-element="quantityValue"]');
  const quantityTotal = panel.querySelector('[data-element="quantityTotal"]');
  const decrementBtn = panel.querySelector('[data-action="decrement-quantity"]');
  const incrementBtn = panel.querySelector('[data-action="increment-quantity"]');
  
  if (quantityValue) quantityValue.textContent = quantity;
  if (quantityTotal) quantityTotal.textContent = `${total.toLocaleString('da-DK')} kr`;
  
  // Disable buttons based on min/max
  if (decrementBtn) decrementBtn.disabled = quantity <= 1;
  if (incrementBtn) incrementBtn.disabled = quantity >= 5;
  
  // Update cart when quantity changes
  updateCartSummary();
}

// Scroll to top function with multiple approaches
function scrollToTop() {
  // Method 1: Direct scroll to top
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  
  // Method 2: Smooth scroll with requestAnimationFrame
  requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  });
  
  // Method 3: Force scroll after a brief delay
  setTimeout(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 50);
}


// Setup form field focus scrolling for mobile
function setupFormFieldScrolling() {
  // Only on mobile
  if (window.innerWidth > 768) return;
  
  const formInputs = document.querySelectorAll('input, select, textarea');
  
  formInputs.forEach((input) => {
    input.addEventListener('focus', function() {
      // Auto-scroll removed - will be revisited later
    });
  });
}

function setupFormFieldFocus() {
  // Ensure form inputs get focused when clicked
  const formInputs = document.querySelectorAll('input, select, textarea');
  
  formInputs.forEach((input) => {
    // Ensure focus on click
    input.addEventListener('click', function(e) {
      // Only focus if not already focused
      if (document.activeElement !== this) {
        this.focus();
      }
    });
    
    // Also handle label clicks - labels with 'for' attribute should work automatically
    // Handle clicking on labels to focus the associated input
    const label = input.closest('.form-group')?.querySelector(`label[for="${input.id}"]`);
    if (label) {
      label.addEventListener('click', function(e) {
        e.preventDefault();
        input.focus();
      });
    }
  });
}

function handleGymSearch(event) {
  const searchTerm = event.target.value.toLowerCase();
  const gymItems = document.querySelectorAll('.gym-item');
  const noResults = document.getElementById('noResults');
  let visibleCount = 0;
  
  gymItems.forEach(item => {
    const gymName = item.querySelector('.gym-name').textContent.toLowerCase();
    const gymAddress = item.querySelector('.gym-address').textContent.toLowerCase();
    
    if (gymName.includes(searchTerm) || gymAddress.includes(searchTerm)) {
      item.classList.remove('hidden');
      visibleCount++;
    } else {
      item.classList.add('hidden');
    }
  });
  
  // Show/hide no results message
  if (visibleCount === 0 && searchTerm.length > 0) {
    noResults.classList.remove('hidden');
  } else {
    noResults.classList.add('hidden');
  }
}

function handleBackToGym() {
  // Clear any pending navigation timeouts when going back
  Object.keys(pendingNavigationTimeouts).forEach(key => {
    if (pendingNavigationTimeouts[key]) {
      clearTimeout(pendingNavigationTimeouts[key]);
      pendingNavigationTimeouts[key] = null;
    }
  });
  
  // Go back to step 1 (gym selection)
  state.currentStep = 1;
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();
  
  // Scroll to top immediately and with delay
  scrollToTop();
  setTimeout(() => {
    scrollToTop();
  }, 200);
  
  // Restore previously selected gym if any
  if (state.selectedGymId) {
    // Convert numeric ID back to data attribute format (gym-{id})
    const gymDataId = `gym-${state.selectedGymId}`;
    const selectedGymItem = document.querySelector(`[data-gym-id="${gymDataId}"]`);
    if (selectedGymItem) {
      // Remove selected class from all items first
      document.querySelectorAll('.gym-item').forEach(item => {
        item.classList.remove('selected');
      });
      // Add selected class to previously selected item
      selectedGymItem.classList.add('selected');
      
      // Show heads-up for previously selected gym
      updateGymHeadsUp(selectedGymItem);
    }
  }
}

function handleMembershipCardClick(event, card) {
  const button = card.querySelector('[data-action="select-membership"]');
  if (!button) return;

  centerPlanCard(card);

  if (event.target.closest('[data-action="select-membership"]')) return;

  if (card.classList.contains('selected')) return;

  triggerPlanButtonGlare(button);
}

function triggerPlanButtonGlare(button) {
  const existingTimeout = buttonGlareTimeouts.get(button);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  button.classList.add('attention-glare');

  const timeoutId = window.setTimeout(() => {
    button.classList.remove('attention-glare');
    buttonGlareTimeouts.delete(button);
  }, 900);

  buttonGlareTimeouts.set(button, timeoutId);
}

function renderValueCards() {
  if (!templates.valueCard || !DOM.valuePlans) return;
  if (typeof VALUE_CARDS === 'undefined' || !Array.isArray(VALUE_CARDS) || VALUE_CARDS.length === 0) {
    return;
  }
  DOM.valuePlans.innerHTML = '';
  DOM.valuePlans.dataset.centerInitialized = 'false';

  VALUE_CARDS.forEach((plan) => {
    const card = templates.valueCard.content.firstElementChild.cloneNode(true);
    card.dataset.planId = plan.id;

    const nameEl = card.querySelector('[data-element="name"]');
    const priceValueEl = card.querySelector('[data-element="priceValue"]');
    const priceSuffixEl = card.querySelector('[data-element="priceSuffix"]');
    const descriptionEl = card.querySelector('[data-element="description"]');
    const featuresEl = card.querySelector('[data-element="features"]');
    const quantityValueEl = card.querySelector('[data-element="quantityValue"]');
    const quantityTotalEl = card.querySelector('[data-element="quantityTotal"]');
    const selector = card.querySelector('.quantity-selector');
    const decrementBtn = card.querySelector('[data-action="decrement-quantity"]');
    const incrementBtn = card.querySelector('[data-action="increment-quantity"]');

    if (nameEl) nameEl.textContent = plan.name;
    if (priceValueEl) priceValueEl.textContent = formatPriceHalfKrone(roundToHalfKrone(plan.price));
    if (priceSuffixEl) priceSuffixEl.textContent = ` ${plan.priceSuffix}`;
    if (descriptionEl) descriptionEl.textContent = plan.description;
    if (featuresEl) {
      featuresEl.innerHTML = '';
      plan.features.forEach((feature) => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresEl.appendChild(li);
      });
    }

    if (quantityValueEl) quantityValueEl.textContent = plan.min;
    if (quantityTotalEl) quantityTotalEl.textContent = formatPriceHalfKrone(roundToHalfKrone(plan.min * plan.price));

    if (selector) {
      selector.dataset.planId = plan.id;
      selector.dataset.basePrice = String(plan.price);
      selector.dataset.min = String(plan.min ?? 0);
      selector.dataset.max = String(Number.isFinite(plan.max) ? plan.max : '');
      selector.dataset.current = String(plan.min ?? 0);
    }

    if (decrementBtn) decrementBtn.dataset.planId = plan.id;
    if (incrementBtn) incrementBtn.dataset.planId = plan.id;

    card.addEventListener('click', () => centerPlanCard(card));

    DOM.valuePlans.appendChild(card);

    syncValueCardUI(plan.id);
  });

  enforceValueCardAvailability();
  updateValueCardSummary();
}

function renderAddons() {
  if (!templates.addon || !DOM.addonPlans) return;
  DOM.addonPlans.innerHTML = '';
  DOM.addonPlans.dataset.centerInitialized = 'false';
  const addons = Array.isArray(state.subscriptionAdditions)
    ? state.subscriptionAdditions
    : [];
  if (addons.length === 0) {
    updateAddonSkipButton();
    return;
  }

  addons.forEach((addon) => {
    const card = templates.addon.content.firstElementChild.cloneNode(true);
    card.dataset.planId = addon.id;

    const nameEl = card.querySelector('[data-element="name"]');
    const originalPriceEl = card.querySelector('[data-element="originalPrice"]');
    const discountedPriceEl = card.querySelector('[data-element="discountedPrice"]');
    const descriptionEl = card.querySelector('[data-element="description"]');
    const featuresEl = card.querySelector('[data-element="features"]');
    const buttonEl = card.querySelector('[data-action="toggle-addon"]');

    if (nameEl) nameEl.textContent = addon.name;
    const priceOriginal = typeof addon.price?.original === 'number'
      ? addon.price.original
      : typeof addon.price?.amount === 'number'
        ? addon.price.amount / 100
        : null;
    const priceDiscounted = typeof addon.price?.discounted === 'number'
      ? addon.price.discounted
      : priceOriginal;
    if (originalPriceEl) {
      originalPriceEl.textContent = priceOriginal !== null
        ? formatPriceHalfKrone(roundToHalfKrone(priceOriginal))
        : '—';
    }
    if (discountedPriceEl) {
      discountedPriceEl.textContent = priceDiscounted !== null
        ? formatPriceHalfKrone(roundToHalfKrone(priceDiscounted))
        : '—';
    }
    if (descriptionEl) descriptionEl.textContent = addon.description;
    if (featuresEl && Array.isArray(addon.features)) {
      featuresEl.innerHTML = '';
      addon.features.forEach((feature) => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresEl.appendChild(li);
      });
    }
    if (buttonEl) {
      buttonEl.dataset.addonId = addon.id;
      buttonEl.textContent = addon.cta ?? 'Select Add-on';
    }

    card.addEventListener('click', () => centerPlanCard(card));

    DOM.addonPlans.appendChild(card);
  });

  updateAddonSkipButton();
}

function handleCategoryToggle(category) {
  // Update category item states
  const categoryItems = document.querySelectorAll('.category-item');
  categoryItems.forEach(item => {
    const isSelected = item.dataset.category === category;
    item.classList.toggle('selected', isSelected);
    
    // Only toggle expanded if this is the selected category
    if (isSelected) {
      const wasExpanded = item.classList.contains('expanded');
      item.classList.toggle('expanded');
      
      // Focus the expanded category item
      if (!wasExpanded && item.classList.contains('expanded')) {
        setTimeout(() => {
          item.setAttribute('tabindex', '-1');
          item.focus();
          item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    } else {
      item.classList.remove('expanded');
    }
  });

  // Update plan sections visibility based on expanded state
  const singlePlans = document.getElementById('singleChoiceMode');
  const quantityPlans = document.getElementById('quantityMode');
  
  const singleCategory = document.querySelector('.category-item[data-category="single"]');
  const quantityCategory = document.querySelector('.category-item[data-category="quantity"]');
  
  if (singleCategory && singleCategory.classList.contains('expanded')) {
    if (singlePlans) singlePlans.style.display = 'block';
    if (quantityPlans) quantityPlans.style.display = 'none';
  } else if (quantityCategory && quantityCategory.classList.contains('expanded')) {
    if (singlePlans) singlePlans.style.display = 'none';
    if (quantityPlans) quantityPlans.style.display = 'block';
  } else {
    // If no category is expanded, hide both
    if (singlePlans) singlePlans.style.display = 'none';
    if (quantityPlans) quantityPlans.style.display = 'none';
  }
}

function getProductPriceDKK(product) {
  if (!product) return 0;
  if (product.price?.amount) return product.price.amount / 100;
  if (product.amount) return product.amount / 100;
  if (product.priceWithInterval?.price?.amount) return product.priceWithInterval.price.amount / 100;
  if (typeof product.price === 'number') return product.price;
  return 0;
}

function parsePriceFromCard(card) {
  const priceEl = card?.querySelector('.price-amount');
  if (!priceEl) return 0;
  const text = priceEl.textContent || '';
  const normalized = text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

function trackSelectItemEvent({ product, productId, category, type, card }) {
  if (!window.GTM || !window.GTM.trackSelectItem) return;

  const nameFromCard = card?.querySelector('.plan-type')?.textContent?.trim();
  const productData = {
    id: productId,
    name: product?.name || nameFromCard || 'Unknown Product',
    amount: product ? getProductPriceDKK(product) : parsePriceFromCard(card),
    type: type || 'membership',
    quantity: 1
  };

  try {
    window.GTM.trackSelectItem(productData, category, category);
  } catch (error) {
    console.warn('[GTM] Error tracking select_item:', error);
  }
}

function handlePlanSelection(selectedCard) {
  // Remove selected class from all plan cards in the same category
  const category = selectedCard.closest('.category-item').dataset.category;
  const allCardsInCategory = selectedCard.closest('.category-item').querySelectorAll('.plan-card');
  
  allCardsInCategory.forEach(card => {
    card.classList.remove('selected');
  });
  
  // Add selected class to clicked card
  selectedCard.classList.add('selected');
  
  // Step 5: Store the selected plan and product details
  const planId = selectedCard.dataset.plan;
  const productId = selectedCard.dataset.productId || planId; // Use API product ID if available
  const isMembership = category === 'campaign' || category === 'membership' || category === '15daypass';
  
  state.membershipPlanId = planId; // Keep for backward compatibility
  state.selectedProductId = productId; // Store API product ID
  state.selectedProductType = isMembership ? 'membership' : 'punch-card';
  
  console.log('Selected plan:', planId, 'Product ID:', productId, 'Type:', state.selectedProductType);
  
  // GTM: Track select_item event
  trackSelectItemEvent({
    product,
    productId,
    category,
    type: isMembership ? 'membership' : 'punch-card',
    card: selectedCard
  });
  
  // Step 5: If membership is selected, fetch add-ons immediately
  if (isMembership && productId) {
    loadSubscriptionAdditions(productId);
  } else {
    // Clear add-ons if punch card is selected
    state.subscriptionAdditions = [];
    state.selectedAddonIds = [];
  }
  
  // Update access heads-up display
  updateAccessHeadsUp(selectedCard);

  // Reevaluate Boost visibility based on plan type
  applyConditionalSteps();
  
  // Update cart to reflect selection
  updateCartSummary();
  
  // Auto-advance to next step after a short delay
  setTimeout(() => {
    nextStep();
  }, 500);
}

function setupNewAccessStep() {
  const categoryItems = document.querySelectorAll('.category-item');
  const footerText = document.getElementById('footerText');
  
  if (categoryItems.length === 0) {
    console.warn('No category items found - setupNewAccessStep called too early or categories not in DOM');
    return;
  }
  
  const footerTexts = {
    campaign: 'Special promotional offers and limited-time campaigns. Take advantage of these exclusive deals while they last. By purchasing a campaign offer, you accept <a href="#">terms and Conditions</a>.',
    membership: 'Membership is an ongoing subscription with automatic renewal. No signup or cancellation fees. Notice period is the rest of the month + 1 month. By signing up you accept <a href="#">terms and Conditions</a>.',
    '15daypass': 'Get 15 days of unlimited access to all gyms. Perfect for trying out climbing or a short-term visit. By purchasing a 15 Day Pass, you accept <a href="#">terms and Conditions</a>.',
    punchcard: 'You can buy 1 type of value card at a time. Each entry uses one clip on your value card. Card is valid for 5 years and does not include membership benefits. Refill within 14 days after your last clip and get 100 kr off at the gym. By purchasing a value card, you accept <a href="#">terms and Conditions</a>.'
  };

  let currentCategory = null;
  let selectedPlan = null;

  // Category expansion/collapse
  categoryItems.forEach(category => {
    const header = category.querySelector('.category-header');
    
    if (!header) {
      console.warn('Category header not found for category:', category);
      return;
    }
    
    
    // Remove existing listeners by cloning (simpler than tracking and removing)
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);
    const freshHeader = category.querySelector('.category-header');
    
    if (!freshHeader) {
      console.error('Failed to get fresh header after clone');
      return;
    }
    
    freshHeader.style.cursor = 'pointer'; // Ensure it's clickable
    freshHeader.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Category header clicked:', category.dataset.category, e);
      const categoryType = category.dataset.category;
      const wasExpanded = category.classList.contains('expanded');

      // Collapse all categories
      categoryItems.forEach(item => {
        item.classList.remove('expanded', 'selected');
      });

      // Expand clicked category if it wasn't already expanded
      if (!wasExpanded) {
        category.classList.add('expanded', 'selected');
        currentCategory = categoryType;
        if (footerText) {
          footerText.innerHTML = footerTexts[categoryType];
        }
        
        // Focus the expanded category item for accessibility
        setTimeout(() => {
          category.setAttribute('tabindex', '-1');
          category.focus();
          // Scroll into view smoothly
          category.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100); // Small delay to ensure expansion animation has started
      } else {
        currentCategory = null;
        if (footerText) {
          footerText.innerHTML = 'Select a category above to view available plans.';
        }
      }

      // Clear selected plan when switching categories
      selectedPlan = null;
      state.membershipPlanId = null;
      
      // Clear all punch card quantities when switching categories
      state.valueCardQuantities.clear();
      
      document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected', 'has-quantity', 'disabled');
      });
      
      // Hide all quantity panels
      document.querySelectorAll('.quantity-panel').forEach(panel => {
        panel.classList.remove('show');
        panel.style.display = 'none';
      });
      
      // Hide continue buttons when switching categories
      document.querySelectorAll('.continue-btn').forEach(btn => {
        btn.style.display = 'none';
      });
    });
  });

  // Plan selection
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't handle clicks on quantity controls - let them handle their own events
      if (e.target.closest('.quantity-selector')) {
        return;
      }
      
      e.stopPropagation();
      
      const planId = card.dataset.plan;
      const categoryItem = card.closest('.category-item');
      const category = categoryItem.dataset.category;
      
      // Check if this card is already selected
      const isAlreadySelected = card.classList.contains('selected');
      
      // Clear ALL selections across ALL categories first
      document.querySelectorAll('.plan-card').forEach(c => {
        c.classList.remove('selected', 'has-quantity', 'disabled');
      });
      
      // Clear all punch card quantities when making a new selection
      state.valueCardQuantities.clear();
      
      // Hide all quantity panels
      document.querySelectorAll('.quantity-panel').forEach(panel => {
        panel.classList.remove('show');
        panel.style.display = 'none';
      });
      
      // Hide continue buttons initially
      document.querySelectorAll('.continue-btn').forEach(btn => {
        btn.style.display = 'none';
      });
      
      // Clear state
      state.membershipPlanId = null;
      
      // If clicking the same card that was already selected, deselect it
      if (isAlreadySelected) {
        selectedPlan = null;
        return;
      }
      
      // Select clicked card
      card.classList.add('selected');
      selectedPlan = planId;
      
      // Step 5: Store the selected plan and product details
      const productId = card.dataset.productId || planId; // Use API product ID if available
      state.membershipPlanId = planId; // Keep for backward compatibility
      state.selectedProductId = productId; // Store API product ID
      // Determine product type based on category
      if (category === 'campaign' || category === 'membership' || category === '15daypass') {
        state.selectedProductType = 'membership'; // All are subscription products
      } else {
        state.selectedProductType = 'punch-card';
      }

      // GTM: Track select_item for API-driven plan cards
      const productPoolByCategory = {
        campaign: state.campaignSubscriptions || [],
        membership: state.subscriptions || [],
        '15daypass': state.dayPassSubscriptions || [],
        punchcard: state.valueCards || []
      };
      const productPool = productPoolByCategory[category] || [];
      const selectedProduct = productPool.find((item) => String(item.id) === String(productId));
      trackSelectItemEvent({
        product: selectedProduct,
        productId,
        category,
        type: category === 'punchcard' ? 'punch-card' : 'membership',
        card
      });
      
      // Step 5: If campaign, membership, or 15 Day Pass is selected, fetch add-ons immediately
      if ((category === 'campaign' || category === 'membership' || category === '15daypass') && productId) {
        loadSubscriptionAdditions(productId);
      } else {
        // Clear add-ons if punch card is selected
        state.subscriptionAdditions = [];
        state.selectedAddonIds = [];
      }
      
      // Handle punch cards differently - show quantity selector
      if (category === 'punchcard') {
          // Initialize quantity to 1 for this specific punch card type
          if (!state.valueCardQuantities.has(planId)) {
            state.valueCardQuantities.set(planId, 1);
          }
          
          // Clear quantity for the other punch card type when switching
          const otherPunchCardId = planId === 'adult-punch' ? 'junior-punch' : 'adult-punch';
          if (state.valueCardQuantities.has(otherPunchCardId)) {
            state.valueCardQuantities.delete(otherPunchCardId);
          }
          
          // Show quantity panel (now a sibling element)
          card.classList.add('has-quantity');
          const panel = card.nextElementSibling;
          if (panel && panel.classList.contains('quantity-panel')) {
            panel.classList.add('show');
            panel.style.display = 'block';
            syncPunchCardQuantityUI(card, planId);
            
            // Auto-scroll removed - will be revisited later
          }
          
          // Grey out the other punch card type
          const otherPunchCard = document.querySelector(`[data-plan="${otherPunchCardId}"]`);
          if (otherPunchCard) {
            otherPunchCard.classList.add('disabled');
          }
          
          // Update access heads-up
          updateAccessHeadsUp(card);
          
          // Update cart to reflect selection
          updateCartSummary();
          
          // Clear any pending punchcard navigation timeout to prevent double-clicks
          if (pendingNavigationTimeouts.punchcard) {
            clearTimeout(pendingNavigationTimeouts.punchcard);
            pendingNavigationTimeouts.punchcard = null;
          }
          
          // Auto-advance to next step after a short delay
          pendingNavigationTimeouts.punchcard = setTimeout(() => {
            // Clear timeout reference before navigation
            pendingNavigationTimeouts.punchcard = null;
            // Only navigate if we're still on step 2 (prevent stale state navigation)
            if (state.currentStep === 2) {
              nextStep();
            }
          }, 500);
        } else {
          // Membership - update access heads-up
          updateAccessHeadsUp(card);
          
          // Add subtle visual cue on selected card
          card.style.transition = 'all 0.3s ease';
          card.style.transform = 'scale(1.02)';
          card.style.boxShadow = '0 8px 25px rgba(240, 0, 240, 0.3)';
          
          // Update cart to reflect selection
          updateCartSummary();
          
          // Clear any pending membership navigation timeout to prevent double-clicks
          if (pendingNavigationTimeouts.membership) {
            clearTimeout(pendingNavigationTimeouts.membership);
            pendingNavigationTimeouts.membership = null;
          }
          
          // Reset card animation and auto-advance to next step
          pendingNavigationTimeouts.membership = setTimeout(() => {
            // Clear timeout reference before navigation
            pendingNavigationTimeouts.membership = null;
            card.style.transform = 'scale(1)';
            card.style.boxShadow = '';
            // Only navigate if we're still on step 2 (prevent stale state navigation)
            if (state.currentStep === 2) {
              nextStep();
            }
          }, 500);
        }
    });
  });

  // Punch card continue arrows (now within each card)
  document.querySelectorAll('.continue-arrow').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      nextStep();
    });
  });

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Initialize auth mode toggle
function initAuthModeToggle() {
  const loginSection = document.querySelector('[data-auth-section="login"]');
  const createSection = document.querySelector('[data-auth-section="create"]');
  
  // Set initial state - if user is logged in, select login tab, otherwise create account
  const isAuthenticated = isUserAuthenticated();
  
  // Hide toggle buttons if user is already authenticated
  const switchBtns = document.querySelectorAll('.auth-mode-switch-btn');
  switchBtns.forEach(btn => {
    btn.style.display = isAuthenticated ? 'none' : '';
  });
  
  // On desktop, default to login form; on mobile, also show login form by default
  const isDesktop = window.innerWidth >= 768;
  
  if (!isAuthenticated) {
    // Always show login form by default (both desktop and mobile)
    switchAuthMode('login');
    if (loginSection) {
      loginSection.style.display = 'block';
      // Ensure it's visible
      loginSection.style.visibility = 'visible';
      loginSection.style.opacity = '1';
    }
    if (createSection) {
      createSection.style.display = 'none';
    }
  } else {
    // Authenticated: show login section with status
    if (loginSection) {
      loginSection.style.display = 'block';
    }
    if (createSection) {
      createSection.style.display = 'none';
    }
  }
}

// Switch between auth modes
function switchAuthMode(mode, email = null) {
  const loginSection = document.querySelector('[data-auth-section="login"]');
  const createSection = document.querySelector('[data-auth-section="create"]');
  const switchBtns = document.querySelectorAll('.auth-mode-switch-btn');
  
  // Store current mode
  state.currentAuthMode = mode;
  
  // Update button text and mode based on current section
  switchBtns.forEach(btn => {
    if (mode === 'login') {
      btn.dataset.mode = 'create';
      const textSpan = btn.querySelector('.auth-mode-switch-text');
      if (textSpan) textSpan.textContent = t('form.authSwitch.createAccount');
      // Update icon to account icon
      btn.innerHTML = `
        <span class="auth-mode-switch-text">${t('form.authSwitch.createAccount')}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path>
        </svg>
      `;
    } else {
      btn.dataset.mode = 'login';
      const textSpan = btn.querySelector('.auth-mode-switch-text');
      if (textSpan) textSpan.textContent = t('form.authSwitch.login');
      // Update icon to login icon
      btn.innerHTML = `
        <span class="auth-mode-switch-text">${t('form.authSwitch.login')}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
      `;
    }
  });
  
  // Hide buttons if user is authenticated
  const isAuthenticated = isUserAuthenticated();
  switchBtns.forEach(btn => {
    btn.style.display = isAuthenticated ? 'none' : '';
  });
  
  // Show/hide sections with fade
  if (mode === 'login') {
    createSection.style.display = 'none';
    loginSection.style.display = 'block';
    
    // If email is provided, populate the login email field
    if (email && DOM.loginEmail) {
      DOM.loginEmail.value = email;
      // Focus on password field after a short delay for better UX
      setTimeout(() => {
        if (DOM.loginPassword) {
          DOM.loginPassword.focus();
        }
      }, 100);
    }
  } else {
    loginSection.style.display = 'none';
    createSection.style.display = 'block';
    // Clear any error states when switching to create account mode
    clearErrorStates();
    // Check button state when switching to create account mode
    setTimeout(() => checkSaveAccountButtonState(), 100);
  }
}

function setupSaveAccountButtonValidation() {
  // Check initial state
  setTimeout(() => checkSaveAccountButtonState(), 100);
  
  // Add listeners to all registration form fields
  const registrationForm = document.querySelector('.registration-form');
  if (registrationForm) {
    const fields = registrationForm.querySelectorAll('input, select');
    fields.forEach(field => {
      field.addEventListener('input', checkSaveAccountButtonState);
      field.addEventListener('change', checkSaveAccountButtonState);
    });
  }
}

function handleGlobalClick(event) {
  const actionable = event.target.closest('[data-action]');
  if (!actionable) return;

  const action = actionable.dataset.action;
  
  // Debug: Log edit-gym button clicks
  if (action === 'edit-gym') {
    console.log('[Edit Gym Click] Button clicked:', {
      target: event.target,
      actionable: actionable,
      action: action,
      buttonId: actionable.id,
      buttonElement: document.getElementById('selectedGymLink')
    });
  }

  switch (action) {
    case 'select-membership': {
      const planId = actionable.dataset.planId;
      if (planId) selectMembershipPlan(planId);
      break;
    }
    case 'toggle-addon': {
      const addonId = actionable.dataset.addonId;
      if (addonId) toggleAddon(addonId, actionable);
      break;
    }
    case 'increment-quantity': {
      event.stopPropagation();
      const planId = actionable.dataset.planId;
      if (planId && planId.includes('punch')) {
        // Find the card that contains this quantity panel
        const panel = actionable.closest('.quantity-panel');
        const card = panel ? panel.previousElementSibling : null;
        if (card && card.classList.contains('plan-card') && card.classList.contains('selected')) {
          const current = state.valueCardQuantities.get(planId) || 1;
          if (current < 5) { // Max 5 punch cards of the same type
            state.valueCardQuantities.set(planId, current + 1);
            syncPunchCardQuantityUI(card, planId);
          }
        }
      } else if (planId) {
        adjustValueCardQuantity(planId, 1);
        centerPlanCard(actionable.closest('.plan-card'));
      }
      break;
    }
    case 'decrement-quantity': {
      event.stopPropagation();
      const planId = actionable.dataset.planId;
      if (planId && planId.includes('punch')) {
        // Find the card that contains this quantity panel
        const panel = actionable.closest('.quantity-panel');
        const card = panel ? panel.previousElementSibling : null;
        if (card && card.classList.contains('plan-card') && card.classList.contains('selected')) {
          const current = state.valueCardQuantities.get(planId) || 1;
          if (current > 1) { // Min 1 punch card
            state.valueCardQuantities.set(planId, current - 1);
            syncPunchCardQuantityUI(card, planId);
          }
        }
      } else if (planId) {
        adjustValueCardQuantity(planId, -1);
        centerPlanCard(actionable.closest('.plan-card'));
      }
      break;
    }
    case 'continue-punch-card': {
      event.stopPropagation();
      nextStep();
      break;
    }
    case 'switch-auth-mode': {
      const mode = actionable.dataset.mode;
      // Toggle mode: if currently on login, switch to create, and vice versa
      const currentMode = state.currentAuthMode || (document.querySelector('[data-auth-section="login"]')?.style.display !== 'none' ? 'login' : 'create');
      const newMode = mode || (currentMode === 'login' ? 'create' : 'login');
      switchAuthMode(newMode);
      break;
    }
    case 'submit-checkout': {
      event.preventDefault();
      handleCheckout();
      break;
    }
    case 'continue-value-cards': {
      event.preventDefault();
      handleValueCardContinue();
      break;
    }
    case 'edit-cart': {
      event.preventDefault();
      handleEditCart();
      break;
    }
    case 'show-detailed-receipt': {
      showDetailedReceipt();
      break;
    }
    case 'close-detailed-receipt': {
      closeDetailedReceipt();
      break;
    }
    case 'open-login': {
      showToast('Login flow handled by backend integration.', 'info');
      break;
    }
    case 'logout': {
      event.preventDefault();
      showLogoutConfirmation();
      break;
    }
    case 'save-account': {
      event.preventDefault();
      handleSaveAccount();
      break;
    }
    case 'edit-gym': {
      event.preventDefault();
      handleBackToGym();
      break;
    }
    case 'toggle-addons-step': {
      event.preventDefault();
      handleAddonContinue();
      break;
    }
    case 'go-back-step': {
      event.preventDefault();
      prevStep();
      break;
    }
    default:
      break;
  }
}

function handleGlobalInput(event) {
  const field = event.target;
  if (!(field instanceof HTMLElement)) return;
  if (field.classList.contains('quantity-btn')) return;

  // Check save account button state when registration form fields change
  const registrationForm = field.closest('.registration-form');
  if (registrationForm) {
    checkSaveAccountButtonState();
  }

  if (field.closest('.form-group')) {
    field.closest('.form-group').classList.remove('error');
  }

  if (field.dataset.apiField === 'payment.method') {
    updateCheckoutButton();
  }
}

function selectMembershipPlan(planId) {
  state.membershipPlanId = planId;
  state.subscriptionAttachedOrderId = null;
  const selectedPlan = findMembershipPlan(planId);

  if (DOM.membershipPlans) {
    DOM.membershipPlans.querySelectorAll('.plan-card').forEach((card) => {
      const isSelected = card.dataset.planId === planId;
      card.classList.toggle('selected', isSelected);
      const btn = card.querySelector('[data-action="select-membership"]');
      if (btn) {
        const plan = findMembershipPlan(card.dataset.planId ?? '');
        btn.textContent = isSelected
          ? 'Selected'
          : plan?.cta ?? 'Select Plan';
        const timeoutId = buttonGlareTimeouts.get(btn);
        if (timeoutId) {
          clearTimeout(timeoutId);
          buttonGlareTimeouts.delete(btn);
        }
        btn.classList.remove('attention-glare');
      }
      if (isSelected) {
        centerPlanCard(card);
      }
    });
  }

  updateCartSummary();
  updateCheckoutButton();
  if (state.currentStep === 2) {
    setTimeout(() => nextStep(), 300);
  }
  showToast(`${selectedPlan?.name ?? 'Membership'} selected.`, 'success');
  autoEnsureOrderIfReady('membership-select');

  // GTM: Track select_item for legacy membership plan cards
  if (selectedPlan) {
    trackSelectItemEvent({
      product: {
        id: planId,
        name: selectedPlan.name,
        price: selectedPlan.price
      },
      productId: planId,
      category: 'membership',
      type: 'membership'
    });
  }
}

function toggleAddon(addonId, checkCircle) {
  if (state.addonIds.has(addonId)) {
    state.addonIds.delete(addonId);
  } else {
    state.addonIds.add(addonId);
  }

  const card = checkCircle.closest('.plan-card');
  if (card) {
    const isSelected = state.addonIds.has(addonId);
    card.classList.toggle('selected', isSelected);
    centerPlanCard(card);
  }

  updateCartSummary();
  updateAddonSkipButton();
  updateAddonActionButton();
}

function updateAddonActionButton() {
  const actionButton = document.querySelector('.addons-action-btn');
  if (!actionButton) return;
  
  const hasSelectedAddons = state.addonIds.size > 0;
  
  if (hasSelectedAddons) {
    actionButton.textContent = 'Continue';
    actionButton.className = 'addons-action-btn addons-continue';
  } else {
    actionButton.textContent = 'Skip';
    actionButton.className = 'addons-action-btn addons-skip';
  }
}

function handleAddonAction() {
  const hasSelectedAddons = state.addonIds.size > 0;
  
  if (hasSelectedAddons) {
    // If addons are selected, proceed directly
    proceedAfterAddons();
  } else {
    // If no addons selected, show confirmation dialog
    showSkipConfirmation();
  }
}

function showSkipConfirmation() {
  // Create confirmation modal
  const confirmationOverlay = document.createElement('div');
  confirmationOverlay.className = 'confirmation-overlay';
  confirmationOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  `;
  
  const confirmationDialog = document.createElement('div');
  confirmationDialog.className = 'confirmation-dialog';
  confirmationDialog.style.cssText = `
    background: var(--color-surface-dark);
    border: 2px solid var(--color-item-border);
    border-radius: 16px;
    padding: 24px;
    max-width: 400px;
    text-align: center;
    color: var(--color-text-secondary);
  `;
  
  confirmationDialog.innerHTML = `
    <h3 style="margin: 0 0 16px 0; color: var(--color-text-secondary); font-size: 18px;">Are you sure?</h3>
    <p style="margin: 0 0 24px 0; color: var(--color-text-muted); line-height: 1.5;">
      You're missing out on essential gear that could enhance your climbing experience. 
      These add-ons are specially selected and offer great value!
    </p>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button class="confirmation-btn confirmation-cancel" style="
        padding: 10px 20px;
        border: 1px solid var(--color-item-border);
        border-radius: 8px;
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        font-weight: 600;
      ">Go Back</button>
      <button class="confirmation-btn confirmation-skip" style="
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        background: var(--color-brand-accent);
        color: var(--color-button-primary);
        cursor: pointer;
        font-weight: 600;
      ">Skip Anyway</button>
    </div>
  `;
  
  confirmationOverlay.appendChild(confirmationDialog);
  document.body.appendChild(confirmationOverlay);
  
  // Add event listeners
  confirmationOverlay.querySelector('.confirmation-cancel').addEventListener('click', () => {
    document.body.removeChild(confirmationOverlay);
  });
  
  confirmationOverlay.querySelector('.confirmation-skip').addEventListener('click', () => {
    document.body.removeChild(confirmationOverlay);
    proceedAfterAddons();
  });
  
  // Close on overlay click
  confirmationOverlay.addEventListener('click', (e) => {
    if (e.target === confirmationOverlay) {
      document.body.removeChild(confirmationOverlay);
    }
  });
}

function adjustValueCardQuantity(planId, delta) {
  const plan = findValueCard(planId);
  if (!plan) return;

  const current = state.valueCardQuantities.get(planId) ?? plan.min ?? 0;
  const max = Number.isFinite(plan.max) ? plan.max : current + delta;
  const min = plan.min ?? 0;
  const next = Math.max(min, Math.min(max, current + delta));

  state.valueCardQuantities.set(planId, next);
  syncValueCardUI(planId);
  enforceValueCardAvailability();
  updateCartSummary();
  updateValueCardSummary();
}

function syncValueCardUI(planId) {
  const plan = findValueCard(planId);
  if (!plan || !DOM.valuePlans) return;

  const card = DOM.valuePlans.querySelector(`[data-plan-id="${planId}"]`);
  if (!card) return;

  const selector = card.querySelector('.quantity-selector');
  const valueEl = card.querySelector('[data-element="quantityValue"]');
  const totalEl = card.querySelector('[data-element="quantityTotal"]');
  const decrementBtn = card.querySelector('[data-action="decrement-quantity"]');
  const incrementBtn = card.querySelector('[data-action="increment-quantity"]');

  const quantity = state.valueCardQuantities.get(planId) ?? plan.min ?? 0;
  const total = plan.price * quantity;

  if (valueEl) valueEl.textContent = quantity;
  if (totalEl) totalEl.textContent = formatPriceHalfKrone(roundToHalfKrone(total));
  if (selector) selector.dataset.current = String(quantity);

  if (decrementBtn) decrementBtn.disabled = quantity <= (plan.min ?? 0);
  if (incrementBtn) {
    if (Number.isFinite(plan.max)) {
      incrementBtn.disabled = quantity >= plan.max;
    } else {
      incrementBtn.disabled = false;
    }
  }

  card.classList.toggle('selected', quantity > (plan.min ?? 0));
}

function enforceValueCardAvailability() {
  if (!DOM.valuePlans) return;
  const activeId = Array.from(state.valueCardQuantities.entries()).find(([, qty]) => qty > 0)?.[0] ?? null;

  DOM.valuePlans.querySelectorAll('.plan-card').forEach((card) => {
    const selector = card.querySelector('.quantity-selector');
    if (!selector) return;
    const planId = card.dataset.planId;
    const decrementBtn = card.querySelector('[data-action="decrement-quantity"]');
    const incrementBtn = card.querySelector('[data-action="increment-quantity"]');

    const disable = Boolean(activeId && planId !== activeId);
    card.classList.toggle('disabled', disable);

    if (disable) {
      decrementBtn?.setAttribute('disabled', 'true');
      incrementBtn?.setAttribute('disabled', 'true');
    } else {
      decrementBtn?.removeAttribute('disabled');
      incrementBtn?.removeAttribute('disabled');
      syncValueCardUI(planId ?? '');
    }
  });
}

function updateValueCardSummary() {
  if (!DOM.valueCardPunches || !DOM.valueCardContinueBtn) return;

  const totalQuantity = Array.from(state.valueCardQuantities.values()).reduce(
    (sum, qty) => sum + qty,
    0,
  );
  const totalPunches = totalQuantity * VALUE_CARD_PUNCH_MULTIPLIER;
  const entryLabel = totalPunches === 1 ? 'entry' : 'entries';

  DOM.valueCardPunches.textContent = totalPunches.toString();
  DOM.valueCardContinueBtn.disabled = totalQuantity <= 0;
  if (DOM.valueCardEntryLabel) {
    DOM.valueCardEntryLabel.textContent = entryLabel;
  }
  DOM.valueCardContinueBtn.setAttribute('aria-label', `Continue with ${totalPunches} ${entryLabel}`);
}

function handleValueCardContinue() {
  const hasSelection = Array.from(state.valueCardQuantities.values()).some((qty) => qty > 0);

  if (!hasSelection) {
    showToast('Select a value card quantity before continuing.', 'error');
    return;
  }

  nextStep();
}

function updateAddonSkipButton() {
  if (!DOM.skipAddonsBtn) return;

  const hasAddonsSelected = state.addonIds.size > 0;
  DOM.skipAddonsBtn.textContent = hasAddonsSelected ? 'Continue' : 'Skip';
}

function handleAddonContinue() {
  // Whether skipping or continuing after picking add-ons, we proceed to step 4
  nextStep();
}

function handleEditCart() {
  // Jump back to step 2 (plan selection)
  state.currentStep = 2;
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();
}

function handlePaymentChange(event) {
  const selected = event.target;
  state.paymentMethod = selected.value;
  updateCheckoutButton();

  DOM.paymentOptions.forEach((option) => {
    const parent = option.closest('.payment-option');
    if (parent) parent.classList.toggle('selected', option.checked);
  });

  // Card payment form should NEVER be shown - users are redirected to payment provider
  // Hide the form if it exists (it shouldn't be used)
  if (DOM.cardPaymentForm) {
    DOM.cardPaymentForm.style.display = 'none';
  }
}

function toggleDiscountForm() {
  if (!DOM.discountForm) return;
  const isVisible = DOM.discountForm.style.display !== 'none';
  DOM.discountForm.style.display = isVisible ? 'none' : 'flex';
  DOM.discountToggle?.classList.toggle('active', !isVisible);
  
  // Focus on input field when form is shown
  if (!isVisible && DOM.discountInput) {
    // Use setTimeout to ensure the form is visible before focusing
    setTimeout(() => {
      DOM.discountInput.focus();
    }, 0);
  }
}

// Postal code auto-fill functionality
let postalCodeLookupTimers = {
  customer: null,
  parent: null,
};

function setupPostalCodeAutoFill() {
  const referenceAPI = new ReferenceDataAPI();
  
  // Setup for customer postal code field
  if (DOM.postalCode && DOM.city) {
    DOM.postalCode.addEventListener('input', (e) => {
      const postalCode = e.target.value.trim();
      
      // Clear existing timer
      if (postalCodeLookupTimers.customer) {
        clearTimeout(postalCodeLookupTimers.customer);
      }
      
      // Clear city field if postal code is empty and revert to readonly
      if (!postalCode || postalCode.length === 0) {
        if (DOM.city) {
          DOM.city.value = '';
          DOM.city.setAttribute('readonly', 'readonly');
          DOM.city.removeAttribute('placeholder');
          DOM.city.style.opacity = '1';
          DOM.city.style.cursor = 'default';
        }
        return;
      }
      
      // Debounce: wait 500ms after user stops typing
      postalCodeLookupTimers.customer = setTimeout(async () => {
        // Check if postal code is valid format (4 digits for Danish postal codes)
        if (/^\d{4}$/.test(postalCode)) {
          try {
            // Show loading state
            if (DOM.city) {
              DOM.city.value = 'Loading...';
              DOM.city.style.opacity = '0.6';
            }
            
            const result = await referenceAPI.lookupCityByPostalCode(postalCode);
            
            if (result && typeof result === 'object' && result.unavailable) {
              // API endpoint not available - make city field editable
              if (DOM.city) {
                DOM.city.removeAttribute('readonly');
                DOM.city.placeholder = 'Enter city name';
                DOM.city.value = '';
                DOM.city.style.opacity = '1';
                DOM.city.style.cursor = 'text';
                console.log('[PostalCode] API unavailable - city field is now editable');
              }
            } else if (result && typeof result === 'string') {
              // City found - auto-fill and set readonly
              if (DOM.city) {
                DOM.city.value = result;
                DOM.city.setAttribute('readonly', 'readonly');
                DOM.city.removeAttribute('placeholder');
                DOM.city.style.opacity = '1';
                DOM.city.style.cursor = 'default';
                console.log('[PostalCode] Auto-filled city:', result, 'for postal code:', postalCode);
              }
            } else {
              // City not found - make field editable so user can enter city manually
              if (DOM.city) {
                DOM.city.value = '';
                DOM.city.removeAttribute('readonly');
                DOM.city.placeholder = 'Enter city name';
                DOM.city.style.opacity = '1';
                DOM.city.style.cursor = 'text';
                console.log('[PostalCode] No city found for postal code:', postalCode, '- city field is now editable');
              }
            }
          } catch (error) {
            console.error('[PostalCode] Error looking up city:', error);
            if (DOM.city) {
              DOM.city.value = '';
              DOM.city.setAttribute('readonly', 'readonly');
              DOM.city.removeAttribute('placeholder');
              DOM.city.style.opacity = '1';
              DOM.city.style.cursor = 'default';
            }
          }
        } else {
          // Invalid format - clear city field and revert to readonly
          if (DOM.city) {
            DOM.city.value = '';
            DOM.city.setAttribute('readonly', 'readonly');
            DOM.city.removeAttribute('placeholder');
            DOM.city.style.opacity = '1';
            DOM.city.style.cursor = 'default';
          }
        }
      }, 500);
    });
    
    // Also handle blur event for immediate lookup when user leaves field
    DOM.postalCode.addEventListener('blur', async (e) => {
      const postalCode = e.target.value.trim();
      
      // Clear any pending timer
      if (postalCodeLookupTimers.customer) {
        clearTimeout(postalCodeLookupTimers.customer);
        postalCodeLookupTimers.customer = null;
      }
      
      // Only lookup if postal code is valid and city is empty
      if (postalCode && /^\d{4}$/.test(postalCode) && (!DOM.city || !DOM.city.value || DOM.city.value === 'Loading...')) {
        try {
          if (DOM.city) {
            DOM.city.value = 'Loading...';
            DOM.city.style.opacity = '0.6';
          }
          
          const result = await referenceAPI.lookupCityByPostalCode(postalCode);
          
          if (result && typeof result === 'object' && result.unavailable) {
            // API endpoint not available - make city field editable
            if (DOM.city) {
              DOM.city.removeAttribute('readonly');
              DOM.city.placeholder = 'Enter city name';
              DOM.city.value = '';
              DOM.city.style.opacity = '1';
              DOM.city.style.cursor = 'text';
            }
          } else if (result && typeof result === 'string') {
            // City found - auto-fill
            if (DOM.city) {
              DOM.city.value = result;
              DOM.city.style.opacity = '1';
            }
          } else if (DOM.city) {
            DOM.city.value = '';
            DOM.city.style.opacity = '1';
          }
        } catch (error) {
          console.error('[PostalCode] Error looking up city on blur:', error);
          if (DOM.city) {
            DOM.city.value = '';
            DOM.city.style.opacity = '1';
          }
        }
      }
    });
  }
  
  // Setup for parent/guardian postal code field
  if (DOM.parentPostalCode && DOM.parentCity) {
    DOM.parentPostalCode.addEventListener('input', (e) => {
      const postalCode = e.target.value.trim();
      
      // Clear existing timer
      if (postalCodeLookupTimers.parent) {
        clearTimeout(postalCodeLookupTimers.parent);
      }
      
      // Clear city field if postal code is empty and revert to readonly
      if (!postalCode || postalCode.length === 0) {
        if (DOM.parentCity) {
          DOM.parentCity.value = '';
          DOM.parentCity.setAttribute('readonly', 'readonly');
          DOM.parentCity.removeAttribute('placeholder');
          DOM.parentCity.style.opacity = '1';
          DOM.parentCity.style.cursor = 'default';
        }
        return;
      }
      
      // Debounce: wait 500ms after user stops typing
      postalCodeLookupTimers.parent = setTimeout(async () => {
        // Check if postal code is valid format (4 digits for Danish postal codes)
        if (/^\d{4}$/.test(postalCode)) {
          try {
            // Show loading state
            if (DOM.parentCity) {
              DOM.parentCity.value = 'Loading...';
              DOM.parentCity.style.opacity = '0.6';
            }
            
            const result = await referenceAPI.lookupCityByPostalCode(postalCode);
            
            if (result && typeof result === 'object' && result.unavailable) {
              // API endpoint not available - make city field editable
              if (DOM.parentCity) {
                DOM.parentCity.removeAttribute('readonly');
                DOM.parentCity.placeholder = 'Enter city name';
                DOM.parentCity.value = '';
                DOM.parentCity.style.opacity = '1';
                DOM.parentCity.style.cursor = 'text';
                console.log('[PostalCode] API unavailable - parent city field is now editable');
              }
            } else if (result && typeof result === 'string') {
              // City found - auto-fill and set readonly
              if (DOM.parentCity) {
                DOM.parentCity.value = result;
                DOM.parentCity.setAttribute('readonly', 'readonly');
                DOM.parentCity.removeAttribute('placeholder');
                DOM.parentCity.style.opacity = '1';
                DOM.parentCity.style.cursor = 'default';
                console.log('[PostalCode] Auto-filled parent city:', result, 'for postal code:', postalCode);
              }
            } else {
              // City not found - make field editable so user can enter city manually
              if (DOM.parentCity) {
                DOM.parentCity.value = '';
                DOM.parentCity.removeAttribute('readonly');
                DOM.parentCity.placeholder = 'Enter city name';
                DOM.parentCity.style.opacity = '1';
                DOM.parentCity.style.cursor = 'text';
                console.log('[PostalCode] No city found for parent postal code:', postalCode, '- city field is now editable');
              }
            }
          } catch (error) {
            console.error('[PostalCode] Error looking up parent city:', error);
            if (DOM.parentCity) {
              DOM.parentCity.value = '';
              DOM.parentCity.setAttribute('readonly', 'readonly');
              DOM.parentCity.removeAttribute('placeholder');
              DOM.parentCity.style.opacity = '1';
              DOM.parentCity.style.cursor = 'default';
            }
          }
        } else {
          // Invalid format - clear city field and revert to readonly
          if (DOM.parentCity) {
            DOM.parentCity.value = '';
            DOM.parentCity.setAttribute('readonly', 'readonly');
            DOM.parentCity.removeAttribute('placeholder');
            DOM.parentCity.style.opacity = '1';
            DOM.parentCity.style.cursor = 'default';
          }
        }
      }, 500);
    });
    
    // Also handle blur event for immediate lookup when user leaves field
    DOM.parentPostalCode.addEventListener('blur', async (e) => {
      const postalCode = e.target.value.trim();
      
      // Clear any pending timer
      if (postalCodeLookupTimers.parent) {
        clearTimeout(postalCodeLookupTimers.parent);
        postalCodeLookupTimers.parent = null;
      }
      
      // Only lookup if postal code is valid and city is empty
      if (postalCode && /^\d{4}$/.test(postalCode) && (!DOM.parentCity || !DOM.parentCity.value || DOM.parentCity.value === 'Loading...')) {
        try {
          if (DOM.parentCity) {
            DOM.parentCity.value = 'Loading...';
            DOM.parentCity.style.opacity = '0.6';
          }
          
          const result = await referenceAPI.lookupCityByPostalCode(postalCode);
          
          if (result && typeof result === 'object' && result.unavailable) {
            // API endpoint not available - make city field editable
            if (DOM.parentCity) {
              DOM.parentCity.removeAttribute('readonly');
              DOM.parentCity.placeholder = 'Enter city name';
              DOM.parentCity.value = '';
              DOM.parentCity.style.opacity = '1';
              DOM.parentCity.style.cursor = 'text';
            }
          } else if (result && typeof result === 'string') {
            // City found - auto-fill and set readonly
            if (DOM.parentCity) {
              DOM.parentCity.value = result;
              DOM.parentCity.setAttribute('readonly', 'readonly');
              DOM.parentCity.removeAttribute('placeholder');
              DOM.parentCity.style.opacity = '1';
              DOM.parentCity.style.cursor = 'default';
            }
          } else {
            // City not found - make field editable so user can enter city manually
            if (DOM.parentCity) {
              DOM.parentCity.value = '';
              DOM.parentCity.removeAttribute('readonly');
              DOM.parentCity.placeholder = 'Enter city name';
              DOM.parentCity.style.opacity = '1';
              DOM.parentCity.style.cursor = 'text';
            }
          }
        } catch (error) {
          console.error('[PostalCode] Error looking up parent city on blur:', error);
          if (DOM.parentCity) {
            DOM.parentCity.value = '';
            DOM.parentCity.style.opacity = '1';
          }
        }
      }
    });
  }
}

async function handleApplyDiscount() {
  if (!DOM.discountInput) return;
  
  const discountCode = DOM.discountInput.value.trim().toUpperCase();
  
  if (!discountCode) {
    showDiscountMessage('Please enter a coupon code', 'error');
    return;
  }
  
  // Prevent duplicate requests
  if (DOM.applyDiscountBtn.disabled) return;
  
  // If order doesn't exist yet, try to create one so we can apply the coupon immediately
  // This allows the price to update right away when Apply is clicked
  // BUT: If we have fullOrder data, we might have an order ID we can use
  const existingOrderId = state.orderId || state.fullOrder?.id;
  
  if (!existingOrderId) {
    // Check if user has items selected (membership or value cards)
    const hasItems = state.membershipPlanId || (state.valueCardQuantities && Array.from(state.valueCardQuantities.values()).some(qty => qty > 0));
    
    if (hasItems) {
      // User has items - create order first, then apply coupon
      console.log('[Discount] No order exists, creating order to apply coupon...');
      DOM.applyDiscountBtn.disabled = true;
      DOM.applyDiscountBtn.textContent = 'Creating order...';
      clearDiscountMessage();
      
      try {
        // Check prerequisites before creating order
        if (!state.customerId) {
          throw new Error('Please log in or create an account to apply a discount');
        }
        if (!state.selectedBusinessUnit) {
          throw new Error('Please select a gym location first');
        }
        
        // Create order first
        const ensuredOrderId = await ensureOrderCreated('discount-application');
        if (!ensuredOrderId) {
          // Provide more specific error message
          let errorMsg = 'Failed to create order for coupon application';
          if (!state.customerId) {
            errorMsg = 'Please log in or create an account to apply a discount';
          } else if (!state.selectedBusinessUnit) {
            errorMsg = 'Please select a gym location first';
          }
          throw new Error(errorMsg);
        }
        state.orderId = ensuredOrderId;
        console.log('[Discount] Order created:', state.orderId);
        
        // Now add product to order before applying coupon
        // Check if this is a membership (not a punch card)
        const isMembership = state.membershipPlanId && 
          (state.selectedProductType === 'membership' || 
           (typeof state.membershipPlanId === 'string' && state.membershipPlanId.startsWith('membership-')));
        
        if (isMembership) {
          try {
            await ensureSubscriptionAttached('discount-application');
            console.log('[Discount] Membership ensured on order');
            
            // Refresh fullOrder data after subscription is attached
            try {
              const updatedOrder = await orderAPI.getOrder(state.orderId);
              state.fullOrder = updatedOrder;
            } catch (fetchError) {
              console.warn('[Discount] Could not refresh order data:', fetchError);
            }
          } catch (subError) {
            console.warn('[Discount] Could not attach membership to order:', subError);
            throw subError; // Don't continue if membership attachment fails
          }
        } else if (state.selectedProductType === 'punch-card' && state.valueCardQuantities && state.valueCardQuantities.size > 0) {
          // Add punch cards to order before applying coupon
          console.log('[Discount] Adding punch cards to order before applying coupon...');
          const orderAPI = new OrderAPI();
          
          for (const [planId, quantity] of state.valueCardQuantities.entries()) {
            if (quantity > 0) {
              try {
                // Extract numeric product ID from "punch-43" format
                const numericProductId = typeof planId === 'string' && planId.startsWith('punch-')
                  ? parseInt(planId.replace('punch-', ''), 10)
                  : planId;
                
                // API doesn't accept quantity in payload - call API once per quantity
                for (let i = 0; i < quantity; i++) {
                  await orderAPI.addValueCardItem(state.orderId, numericProductId, 1);
                  console.log(`[Discount] ✅ Value card added: ${planId} (productId: ${numericProductId}) [${i + 1}/${quantity}]`);
                }
              } catch (error) {
                console.error(`[Discount] ❌ Failed to add value card ${planId}:`, error);
                throw new Error(`Failed to add punch card to order: ${error.message}`);
              }
            }
          }
          
          // Refresh fullOrder data after punch cards are added
          try {
            const updatedOrder = await orderAPI.getOrder(state.orderId);
            state.fullOrder = updatedOrder;
            console.log('[Discount] Order refreshed after adding punch cards');
          } catch (fetchError) {
            console.warn('[Discount] Could not refresh order data:', fetchError);
          }
        }
        
        // Continue to apply coupon below (don't return)
        DOM.applyDiscountBtn.textContent = 'Applying...';
      } catch (orderError) {
        console.error('[Discount] Failed to create order for coupon:', orderError);
        // Show specific error message
        const errorMsg = orderError.message || 'Failed to create order. Please try again.';
        
        // Check if it's a prerequisite issue
        let displayMsg = errorMsg;
        if (errorMsg.includes('log in') || errorMsg.includes('account')) {
          displayMsg = '✗ Please log in or create an account to apply a discount code';
        } else if (errorMsg.includes('gym location') || errorMsg.includes('business unit')) {
          displayMsg = '✗ Please select a gym location first';
        } else {
          displayMsg = `✗ ${errorMsg}`;
        }
        
        showDiscountMessage(displayMsg, 'error');
        DOM.discountInput.style.borderColor = '#EF4444';
        DOM.discountInput.style.backgroundColor = '#FEF2F2';
        DOM.applyDiscountBtn.disabled = false;
        DOM.applyDiscountBtn.textContent = 'Apply';
        
        // Clear error styling after delay
        setTimeout(() => {
          if (DOM.discountInput && !state.discountApplied) {
            DOM.discountInput.style.borderColor = '';
            DOM.discountInput.style.backgroundColor = '';
          }
        }, 5000);
        return;
      }
    } else {
      // No items selected - show error message
      showDiscountMessage('✗ Please select a membership or punch card first', 'error');
      DOM.discountInput.style.borderColor = '#EF4444';
      DOM.discountInput.style.backgroundColor = '#FEF2F2';
      setTimeout(() => {
        if (DOM.discountInput && !state.discountApplied) {
          DOM.discountInput.style.borderColor = '';
          DOM.discountInput.style.backgroundColor = '';
        }
      }, 5000);
      return;
    }
  }
  
  // Order exists - apply coupon immediately
  // Use existingOrderId if state.orderId wasn't set but fullOrder has an ID
  let orderIdToUse = state.orderId || existingOrderId;
  
  if (!orderIdToUse) {
    console.error('[Discount] No order ID available for discount application');
    showDiscountMessage('✗ No order found. Please refresh the page and try again.', 'error');
    DOM.applyDiscountBtn.disabled = false;
    DOM.applyDiscountBtn.textContent = 'Apply';
    return;
  }
  
  // Set loading state
  DOM.applyDiscountBtn.disabled = true;
  DOM.applyDiscountBtn.textContent = 'Applying...';
  clearDiscountMessage();
  
  // Ensure state.orderId is set for consistency
  if (!state.orderId && orderIdToUse) {
    state.orderId = orderIdToUse;
  }
  
  try {
    const orderAPI = new OrderAPI();

    // Ensure the order has the selected items before applying coupon
    if (!state.customerId) {
      throw new Error('Please log in or create an account to apply a discount');
    }

    let orderSnapshot = state.fullOrder;
    if (!orderSnapshot || String(orderSnapshot.id) !== String(orderIdToUse)) {
      try {
        orderSnapshot = await orderAPI.getOrder(orderIdToUse);
        state.fullOrder = orderSnapshot;
      } catch (orderFetchError) {
        if (orderFetchError?.status === 403 || orderFetchError?.status === 404) {
          console.warn('[Discount] Existing order is not accessible. Creating a new order.');
          state.orderId = null;
          state.subscriptionAttachedOrderId = null;
          const ensuredOrderId = await ensureOrderCreated('discount-application');
          if (!ensuredOrderId) {
            throw new Error('Failed to create order for coupon application');
          }
          orderIdToUse = ensuredOrderId;
          orderSnapshot = await orderAPI.getOrder(orderIdToUse);
          state.fullOrder = orderSnapshot;
        } else {
          throw orderFetchError;
        }
      }
    }

    const isMembership = state.membershipPlanId &&
      (state.selectedProductType === 'membership' ||
       (typeof state.membershipPlanId === 'string' && state.membershipPlanId.startsWith('membership-')));

    if (isMembership) {
      const subscriptionItems = orderSnapshot?.subscriptionItems || [];
      if (!subscriptionItems.length || state.subscriptionAttachedOrderId !== orderIdToUse) {
        await ensureSubscriptionAttached('discount-application');
        orderSnapshot = await orderAPI.getOrder(orderIdToUse);
        state.fullOrder = orderSnapshot;
      }
    } else if (state.selectedProductType === 'punch-card' && state.valueCardQuantities && state.valueCardQuantities.size > 0) {
      const existingValueCardItems = orderSnapshot?.valueCardItems || [];
      for (const [planId, quantity] of state.valueCardQuantities.entries()) {
        if (quantity > 0) {
          const numericProductId = typeof planId === 'string' && planId.startsWith('punch-')
            ? parseInt(planId.replace('punch-', ''), 10)
            : planId;
          const existingCount = existingValueCardItems.filter(item => item.product?.id === numericProductId).length;
          const toAdd = Math.max(0, quantity - existingCount);
          for (let i = 0; i < toAdd; i += 1) {
            await orderAPI.addValueCardItem(orderIdToUse, numericProductId, 1);
          }
        }
      }
      orderSnapshot = await orderAPI.getOrder(orderIdToUse);
      state.fullOrder = orderSnapshot;
    }

    console.log('[Discount] Applying discount code:', discountCode, 'to order:', orderIdToUse);
    const response = await orderAPI.applyDiscountCode(orderIdToUse, discountCode);
    console.log('[Discount] API response received:', response);
    
    // Extract discount information from response
    // API returns Order object with couponDiscount field
    // couponDiscount can be an object { amount, currency } or a number
    const couponDiscount = response?.couponDiscount || response?.price?.couponDiscount;
    let discountAmount = 0;
    
    console.log('[Discount] Extracting discount from response:', {
      couponDiscount,
      couponDiscountType: typeof couponDiscount,
      responseKeys: Object.keys(response || {}),
    });
    
    if (couponDiscount) {
      if (typeof couponDiscount === 'object') {
        // Avoid 'total' field as it might be order total, not discount
        discountAmount = couponDiscount.amount || couponDiscount.value || couponDiscount.discount || 0;
        
        // If amount is in cents, convert to DKK
        if (discountAmount > 10000) {
          console.log('[Discount] Large discountAmount detected, converting from cents:', discountAmount);
          discountAmount = discountAmount / 100;
        }
      } else if (typeof couponDiscount === 'number') {
        discountAmount = couponDiscount;
        
        // If amount is in cents, convert to DKK
        if (discountAmount > 10000) {
          console.log('[Discount] Large discountAmount detected, converting from cents:', discountAmount);
          discountAmount = discountAmount / 100;
        }
      }
    }
    
    // Also check if discountAmount was already extracted by the API method
    if (!discountAmount && response?.discountAmount) {
      discountAmount = response.discountAmount;
      
      // If amount is in cents, convert to DKK
      if (discountAmount > 10000) {
        console.log('[Discount] Large discountAmount from response, converting from cents:', discountAmount);
        discountAmount = discountAmount / 100;
      }
    }
    
    // Calculate discount from price difference if needed
    if (!discountAmount && response?.price) {
      const originalTotal = state.totals.subtotal || state.totals.cartTotal || 0;
      let newTotal = response.price.total || response.price.leftToPay || 0;
      
      // Convert to DKK if in cents
      if (newTotal > 10000) {
        newTotal = newTotal / 100;
      }
      
      if (newTotal < originalTotal && originalTotal > 0) {
        discountAmount = originalTotal - newTotal;
        console.log('[Discount] Calculated discount from price difference:', discountAmount, '(original:', originalTotal, 'new:', newTotal, ')');
      }
    }
    
    // Ensure subtotal is calculated before validating discount
    if (!state.totals.subtotal || state.totals.subtotal === 0) {
      updateCartSummary(); // This will calculate subtotal using API data
    }
    
    // Validate discount amount - ensure it doesn't exceed subtotal
    const subtotal = state.totals.subtotal || state.totals.cartTotal || 0;
    if (discountAmount > subtotal && subtotal > 0) {
      console.warn('[Discount] Discount amount exceeds subtotal, capping at subtotal:', discountAmount, '->', subtotal);
      discountAmount = subtotal;
    }
    
    if (discountAmount > 0) {
      // Success - apply discount
      state.discountCode = discountCode;
      state.discountApplied = true;
      state.totals.discountAmount = roundToHalfKrone(discountAmount);
      
      // CRITICAL: Update fullOrder with discounted prices from API response
      // This ensures payment overview shows the discounted prices
      if (response && !state.fullOrder) {
        state.fullOrder = response;
      } else if (response && state.fullOrder) {
        // Merge updated price data into existing fullOrder
        state.fullOrder.price = response.price || state.fullOrder.price;
        state.fullOrder.couponDiscount = response.couponDiscount || state.fullOrder.couponDiscount;
        if (response.subscriptionItems && response.subscriptionItems.length > 0) {
          state.fullOrder.subscriptionItems = response.subscriptionItems;
        }
      }
      
      console.log('[Discount] Applying discount:', {
        discountCode,
        discountAmount,
        subtotal,
        finalTotal: subtotal - discountAmount,
        orderPrice: state.fullOrder?.price,
      });
      
      // CRITICAL: Update cart totals using API-based function - this recalculates everything
      // updateCartSummary() will calculate subtotal and cart total, and render the UI
      updateCartSummary();
      
      // Cart total element removed - payment overview shows calculated prices instead
      
      // Force update discount display
      updateDiscountDisplay();
      
      // CRITICAL: Update payment overview to show discounted prices
      updatePaymentOverview();
      
      // Calculate new total for display
      const newTotal = state.totals.cartTotal || (subtotal - discountAmount);
      
      // Update all cart total elements and highlight them
      const allCartTotals = document.querySelectorAll('[data-summary-field="cart-total"], .cart-total .total-amount, .total-amount[data-summary-field="cart-total"], [data-summary-field="order-total"], [data-summary-field="pay-now"], [data-summary-field="monthly-payment"]');
      allCartTotals.forEach(el => {
        // Only update text for cart total elements, payment overview is handled by updatePaymentOverview
        if (el.hasAttribute('data-summary-field') && 
            (el.getAttribute('data-summary-field') === 'cart-total' || 
             el.getAttribute('data-summary-field') === 'order-total')) {
          const expectedTotal = formatCurrencyHalfKrone(state.totals.cartTotal);
          el.textContent = expectedTotal;
        }
        // Highlight the new price
        el.classList.add('price-updated');
        setTimeout(() => {
          el.classList.remove('price-updated');
        }, 2000);
      });
      
      // Double-check the display was updated
      if (DOM.cartTotal) {
        const displayedTotal = DOM.cartTotal.textContent;
        const expectedTotal = formatCurrencyHalfKrone(state.totals.cartTotal);
        console.log('[Discount] Cart total display check:', {
          displayed: displayedTotal,
          expected: expectedTotal,
          match: displayedTotal === expectedTotal,
          subtotal: state.totals.subtotal,
          discountAmount: state.totals.discountAmount,
          cartTotal: state.totals.cartTotal,
        });
        if (displayedTotal !== expectedTotal) {
          console.warn('[Discount] Cart total mismatch, forcing update');
          DOM.cartTotal.textContent = expectedTotal;
          DOM.cartTotal.classList.add('price-updated');
          setTimeout(() => {
            DOM.cartTotal.classList.remove('price-updated');
          }, 2000);
        }
      } else {
        console.error('[Discount] DOM.cartTotal element not found after applying discount!');
      }
      
      // Get updated payment amounts for success message
      const payNowElement = document.querySelector('[data-summary-field="pay-now"]');
      const monthlyPaymentElement = document.querySelector('[data-summary-field="monthly-payment"]');
      const payNowText = payNowElement ? payNowElement.textContent : '';
      const monthlyPaymentText = monthlyPaymentElement ? monthlyPaymentElement.textContent : '';
      
      // Show succinct success message
      showDiscountMessage(t('cart.discount.applied', 'Discount code applied successfully!'), 'success');
      
      // Force a visual update by triggering a reflow
      if (DOM.cartTotal) {
        DOM.cartTotal.offsetHeight; // Trigger reflow
      }
      
      // Disable input and button after successful application
      DOM.discountInput.disabled = true;
      DOM.discountInput.style.opacity = '0.6';
      DOM.discountInput.style.borderColor = '#10B981';
      DOM.discountInput.style.backgroundColor = '#F0FDF4'; // Light green background
    } else {
      // Check if coupon was actually applied to the order (even if discountAmount is 0)
      // The API might return success but with 0 discount (e.g., for future use coupons)
      const couponDiscount = response?.couponDiscount || response?.price?.couponDiscount;
      if (couponDiscount !== undefined && couponDiscount !== null) {
        // Coupon was applied, even if discount is 0
        state.discountCode = discountCode;
        state.discountApplied = true;
        state.totals.discountAmount = 0; // Set to 0 if that's what the API returned
        
        // Update fullOrder with response to ensure payment overview uses latest data
        if (response && !state.fullOrder) {
          state.fullOrder = response;
        } else if (response && state.fullOrder) {
          state.fullOrder.price = response.price || state.fullOrder.price;
          state.fullOrder.couponDiscount = response.couponDiscount || state.fullOrder.couponDiscount;
        }
        
        updateCartSummary(); // updateCartSummary() already calls renderCartTotal()
        updatePaymentOverview(); // Update payment overview with discounted prices
        
        const newTotal = state.totals.cartTotal || state.totals.subtotal || 0;
        showDiscountMessage(t('cart.discount.applied', 'Discount code applied successfully!'), 'success');
        
        // Highlight the new price in cart total elements and payment overview
        const cartTotalElements = document.querySelectorAll('[data-summary-field="cart-total"], .cart-total .total-amount, .total-amount[data-summary-field="cart-total"], [data-summary-field="order-total"], [data-summary-field="pay-now"], [data-summary-field="monthly-payment"]');
        cartTotalElements.forEach(el => {
          el.classList.add('price-updated');
          setTimeout(() => {
            el.classList.remove('price-updated');
          }, 2000);
        });
        
        DOM.discountInput.disabled = true;
        DOM.discountInput.style.opacity = '0.6';
        DOM.discountInput.style.borderColor = '#10B981';
        DOM.discountInput.style.backgroundColor = '#F0FDF4'; // Light green background
      } else {
        throw new Error('Invalid coupon code or no discount applied');
      }
    }
  } catch (error) {
    console.error('[Discount] Error applying coupon:', error);
    
    // Check if this is a stack overflow or recursion error - don't reset state in that case
    const errorMessage = error.message || String(error);
    if (errorMessage.includes('Maximum call stack') || errorMessage.includes('stack size exceeded')) {
      console.error('[Discount] Stack overflow detected - this is a code bug, not a coupon error');
      // Don't reset discount state - coupon might have been applied
      // Just show a generic error
      showDiscountMessage('An error occurred while applying the coupon. Please refresh the page.', 'error');
      DOM.applyDiscountBtn.disabled = false;
      DOM.applyDiscountBtn.textContent = 'Apply';
      return; // Exit early to avoid resetting state
    }
    
    // Reset discount state on actual error
    state.discountCode = null;
    state.discountApplied = false;
    state.totals.discountAmount = 0;
    updateCartSummary(); // Update cart using API-based function
    updateDiscountDisplay(); // Clear discount display
    
    // Parse error message to extract error code
    let errorMessageText = 'Failed to apply coupon. Please try again.';
    const errorText = errorMessage;
    
    // Check for specific error codes in the response
    if (errorText.includes('COUPON_NOT_APPLICABLE')) {
      errorMessageText = '✗ This coupon is not applicable to your current order. It may have restrictions on products, minimum order amount, or other conditions.';
    } else if (errorText.includes('COUPON_NOT_FOUND') || errorText.includes('404')) {
      errorMessageText = '✗ Coupon code not found. Please check the code and try again.';
    } else if (errorText.includes('COUPON_EXPIRED') || errorText.includes('expired')) {
      errorMessageText = '✗ This coupon has expired and is no longer valid.';
    } else if (errorText.includes('COUPON_ALREADY_USED')) {
      errorMessageText = '✗ This coupon has already been used and cannot be applied again.';
    } else if (errorText.includes('403') || errorText.includes('Forbidden')) {
      errorMessageText = '✗ This coupon cannot be applied. It may have restrictions or is not valid for your order.';
    } else if (errorText.includes('400') || errorText.includes('invalid')) {
      errorMessageText = '✗ Invalid coupon code. Please check the code and try again.';
    } else if (errorText.includes('405')) {
      errorMessageText = '✗ Coupon application method not supported. Please contact support.';
    } else {
      errorMessageText = '✗ ' + errorMessageText;
    }
    
    showDiscountMessage(errorMessageText, 'error');
    
    // Reset input styling on error
    DOM.discountInput.style.borderColor = '#EF4444'; // Red border on error
    DOM.discountInput.style.backgroundColor = '#FEF2F2'; // Light red background
    DOM.discountInput.focus(); // Focus input so user can try again
    
    // Clear error styling after a delay
    setTimeout(() => {
      if (DOM.discountInput && !state.discountApplied) {
        DOM.discountInput.style.borderColor = '';
        DOM.discountInput.style.backgroundColor = '';
      }
    }, 5000);
  } finally {
    // Reset button state
    DOM.applyDiscountBtn.disabled = false;
    DOM.applyDiscountBtn.textContent = 'Apply';
  }
}

function showDiscountMessage(message, type = 'info') {
  // Remove existing message if any
  clearDiscountMessage();
  
  // Create message element
  const messageEl = document.createElement('div');
  messageEl.className = `discount-message discount-message-${type}`;
  messageEl.textContent = message;
  
  // Insert after discount form
  if (DOM.discountForm) {
    DOM.discountForm.insertAdjacentElement('afterend', messageEl);
  }
  
  // Auto-remove success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      messageEl.remove();
    }, 5000);
  }
}

function clearDiscountMessage() {
  const existingMessage = document.querySelector('.discount-message');
  if (existingMessage) {
    existingMessage.remove();
  }
}

function handleSameAddressToggle(event) {
  if (event.target.checked) {
    copyAddressAndContactInfo();
  } else {
    clearParentFormFields();
  }
}

function handleParentGuardianToggle(event) {
  if (!DOM.parentGuardianForm) return;
  const isChecked = event.target.checked;

  DOM.parentGuardianForm.style.display = isChecked ? 'block' : 'none';
  if (DOM.parentGuardianReminder) {
    DOM.parentGuardianReminder.hidden = !isChecked;
  }

  clearParentFormFields();
}

function copyAddressAndContactInfo() {
  const mappings = [
    ['streetAddress', 'parentStreetAddress'],
    ['postalCode', 'parentPostalCode'],
    ['city', 'parentCity'],
    ['email', 'parentEmail'],
    ['countryCode', 'parentCountryCode'],
    ['phoneNumber', 'parentPhoneNumber'],
  ];

  mappings.forEach(([sourceId, targetId]) => {
    const source = document.getElementById(sourceId);
    const target = document.getElementById(targetId);
    if (!source || !target) return;
    target.value = source.value;
    target.readOnly = true;
    if (target.tagName === 'SELECT') {
      target.value = source.value;
      target.disabled = true;
    }
    target.classList.add('readonly-field');
  });
}

function clearParentFormFields() {
  const parentFields = [
    'parentStreetAddress',
    'parentPostalCode',
    'parentCity',
    'parentEmail',
    'parentCountryCode',
    'parentPhoneNumber',
  ];

  parentFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.value = '';
    field.readOnly = false;
    field.disabled = false;
    field.classList.remove('readonly-field');
  });
}

function updateCartSummary() {
  const items = [];
  state.totals.membershipMonthly = 0;

  // Step 5: Use API data for cart items
  // Handle membership selection
  if (state.selectedProductType === 'membership' && state.selectedProductId) {
    // Try to find membership by ID - handle both numeric and string comparisons
    const productIdNum = typeof state.selectedProductId === 'string' 
      ? parseInt(state.selectedProductId) 
      : state.selectedProductId;
    
    // Check all subscription types: campaign, membership, and 15 Day Pass
    const allSubscriptions = [
      ...(state.campaignSubscriptions || []),
      ...(state.subscriptions || []),
      ...(state.dayPassSubscriptions || [])
    ];
    const membership = allSubscriptions.find(p => 
      p.id === state.selectedProductId || 
      p.id === productIdNum ||
      String(p.id) === String(state.selectedProductId)
    );
    
    if (membership) {
      // Extract price from API structure (cents to DKK)
      // The API uses priceWithInterval, not price directly
      // priceWithInterval contains: { interval: { numberOf: 1, unit: "MONTH" }, price: { amount: 46900, currency: "DKK" } }
      const priceInCents = membership.priceWithInterval?.price?.amount || 
                           membership.price?.amount || 
                           membership.amount || 
                           membership.monthlyPrice ||
                           0;
      const price = priceInCents > 0 ? priceInCents / 100 : 0;
      
      // Get imageBanner text if available
      const bannerText = membership.imageBanner?.text || '';
      const displayName = bannerText 
        ? `${membership.name || 'Membership'} - ${bannerText}`
        : membership.name || 'Membership';
      
      items.push({
        id: membership.id,
        name: displayName,
        amount: price,
        type: 'membership',
        productId: membership.id, // Store API product ID for order creation
        imageBannerText: bannerText, // Store separately for rendering
        productName: membership.name || 'Membership', // Store original name
      });
      state.totals.membershipMonthly = price;
    } else {
      console.warn('Cart: Membership not found', {
        selectedProductId: state.selectedProductId,
        selectedProductType: state.selectedProductType,
        availableSubscriptions: allSubscriptions.map(s => ({ id: s.id, name: s.name }))
      });
    }
  }

  // Handle punch card selection
  if (state.selectedProductType === 'punch-card' && state.selectedProductId) {
    state.valueCardQuantities.forEach((quantity, planId) => {
      if (quantity <= 0) return;
      
      // Find the product by ID - check both the stored productId and planId format
      const productId = state.selectedProductId || planId.replace('punch-', '');
      const valueCard = state.valueCards.find(p => 
        p.id === productId || 
        p.id === parseInt(productId) ||
        planId.includes(String(p.id))
      );
      
      if (valueCard) {
        // Extract price from API structure (cents to DKK)
        const priceInCents = valueCard.price?.amount || valueCard.amount || 0;
        const price = priceInCents / 100;
        
        items.push({
          id: valueCard.id,
          name: `${valueCard.name || 'Punch Card'} ×${quantity}`,
          amount: roundToHalfKrone(price * quantity),
          type: 'value-card',
          quantity: quantity,
          productId: valueCard.id, // Store API product ID for order creation
        });
      }
    });
  }

  // Handle add-ons (if any were selected - currently disabled but keeping for future)
  state.addonIds.forEach((addonId) => {
    const addon = findAddon(addonId);
    if (!addon) return;
    items.push({
      id: addon.id,
      name: addon.name,
      amount: roundToHalfKrone(addon.price.discounted),
      type: 'addon',
    });
  });

  // GTM: Track add_to_cart event when items are added
  const previousCartItemCount = state.cartItems?.length || 0;
  const newCartItemCount = items.length;
  
  state.cartItems = items;
  
  // Calculate subtotal (before discount) - round to half krone
  state.totals.subtotal = roundToHalfKrone(items.reduce((total, item) => total + item.amount, 0));
  
  // Calculate cart total (subtotal - discount) - round to half krone
  state.totals.cartTotal = roundToHalfKrone(Math.max(0, state.totals.subtotal - (state.totals.discountAmount || 0)));

  // Track add_to_cart if items were added (not just updated)
  if (newCartItemCount > previousCartItemCount && window.GTM && window.GTM.trackAddToCart) {
    try {
      // Only track newly added items
      const newItems = items.slice(previousCartItemCount);
      if (newItems.length > 0) {
        window.GTM.trackAddToCart(newItems, state.totals.cartTotal, 'DKK');
      }
    } catch (error) {
      console.warn('[GTM] Error tracking add_to_cart:', error);
    }
  }

  renderCartItems();
  renderCartTotal();
  
  // If we're on step 4 and have order data, ensure payment overview is updated
  if (state.currentStep === 4 && state.orderId && !state.fullOrder) {
    // Order exists but fullOrder not loaded - fetch it
    orderAPI.getOrder(state.orderId)
      .then(order => {
        state.fullOrder = order;
        updatePaymentOverview();
        console.log('[Cart Summary] Order data fetched and payment overview updated');
      })
      .catch(error => {
        console.warn('[Cart Summary] Could not fetch order data:', error);
      });
  } else if (state.currentStep === 4 && state.fullOrder) {
    // Full order data available - ensure payment overview is updated
    updatePaymentOverview();
  }
}

function updateCartTotals() {
  // Recalculate totals including discount
  const items = [];
  
  // Add membership
  if (state.membershipPlanId) {
    const plan = findMembershipPlan(state.membershipPlanId);
    if (plan) {
    items.push({
      id: plan.id,
      name: plan.name,
      amount: roundToHalfKrone(plan.price),
      type: 'membership',
    });
    }
  }
  
  // Add value cards
  state.valueCardQuantities.forEach((quantity, planId) => {
    if (quantity > 0) {
      const plan = findValueCard(planId);
      if (plan) {
        items.push({
          id: plan.id,
          name: plan.name,
          amount: roundToHalfKrone(plan.price * quantity),
          type: 'value-card',
          quantity,
        });
      }
    }
  });
  
  // Add add-ons
  state.addonIds.forEach((addonId) => {
    const addon = findAddon(addonId);
    if (!addon) return;
    items.push({
      id: addon.id,
      name: addon.name,
      amount: roundToHalfKrone(addon.price.discounted),
      type: 'addon',
    });
  });

  state.cartItems = items;
  
  // Calculate subtotal (before discount) - round to half krone
  state.totals.subtotal = roundToHalfKrone(items.reduce((total, item) => total + item.amount, 0));
  
  // Calculate cart total (subtotal - discount) - round to half krone
  state.totals.cartTotal = roundToHalfKrone(Math.max(0, state.totals.subtotal - (state.totals.discountAmount || 0)));

  renderCartItems();
  renderCartTotal();
}

function renderCartItems() {
  if (!templates.cartItem || !DOM.cartItems) return;
  DOM.cartItems.innerHTML = '';

  if (!state.cartItems.length) {
    // Only show empty message if there's no gym selected either
    if (!state.selectedGymId && !state.selectedBusinessUnit) {
      const empty = document.createElement('div');
      empty.className = 'cart-empty';
      empty.textContent = t('cart.empty');
      DOM.cartItems.appendChild(empty);
    }
    return;
  }

  // Helper function to create Home Gym info element
  function createHomeGymInfo(selectedGym) {
    const gymInfoContainer = document.createElement('div');
    gymInfoContainer.className = 'home-gym-info';
    
    const gymInfoText = document.createElement('span');
    gymInfoText.className = 'home-gym-text';
    gymInfoText.textContent = `${t('homeGym.label')} ${selectedGym.name}`;
    
    // Create info icon
    const infoIcon = document.createElement('span');
    infoIcon.className = 'home-gym-info-icon';
    infoIcon.setAttribute('aria-label', 'Information about home gym');
    infoIcon.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `;
    
    // Create wrapper for info icon and tooltip
    const infoWrapper = document.createElement('span');
    infoWrapper.className = 'home-gym-info-wrapper';
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'home-gym-tooltip';
    tooltip.innerHTML = `
      <div class="tooltip-content">
        <p><strong>${t('homeGym.tooltip.title')}</strong></p>
        <p>${t('homeGym.tooltip.desc')}</p>
      </div>
    `;
    
    // Add click handler to toggle tooltip
    infoIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other tooltips
      document.querySelectorAll('.home-gym-tooltip').forEach(t => {
        if (t !== tooltip) t.classList.remove('show');
      });
      const wasVisible = tooltip.classList.contains('show');
      tooltip.classList.toggle('show');
      
      // If tooltip is now visible, set up outside click handler
      if (!wasVisible && tooltip.classList.contains('show')) {
        setTimeout(() => {
          const outsideClickHandler = (e) => {
            if (!infoWrapper.contains(e.target)) {
              tooltip.classList.remove('show');
              document.removeEventListener('click', outsideClickHandler);
            }
          };
          document.addEventListener('click', outsideClickHandler, { once: true });
        }, 0);
      }
    });
    
    infoWrapper.appendChild(infoIcon);
    infoWrapper.appendChild(tooltip);
    gymInfoContainer.appendChild(gymInfoText);
    gymInfoContainer.appendChild(infoWrapper);
    
    return gymInfoContainer;
  }

  // Get selected gym info
  let selectedGym = null;
  if (state.selectedGymId || state.selectedBusinessUnit) {
    const gymId = state.selectedGymId || state.selectedBusinessUnit;
    selectedGym = gymsWithDistances.find(gym => 
      String(gym.id) === String(gymId)
    );
  }

  state.cartItems.forEach((item, index) => {
    const cartItem = templates.cartItem.content.firstElementChild.cloneNode(true);
    const nameEl = cartItem.querySelector('[data-element="name"]');
    const priceEl = cartItem.querySelector('[data-element="price"]');

    if (nameEl) {
      // For membership items with imageBanner text, display name and banner text separately
      if (item.type === 'membership' && item.imageBannerText) {
        // Clear any existing content
        nameEl.innerHTML = '';
        
        const nameContainer = document.createElement('div');
        nameContainer.style.display = 'flex';
        nameContainer.style.flexDirection = 'column';
        nameContainer.style.gap = '4px';
        
        const productNameSpan = document.createElement('span');
        productNameSpan.textContent = item.productName || item.name;
        productNameSpan.style.fontWeight = '500';
        
        const bannerTextSpan = document.createElement('span');
        // Preserve line breaks from backend - replace newlines with <br> tags
        const bannerTextWithBreaks = item.imageBannerText.replace(/\n/g, '<br>');
        bannerTextSpan.innerHTML = bannerTextWithBreaks;
        bannerTextSpan.style.fontSize = 'var(--font-size-sm)';
        bannerTextSpan.style.color = 'var(--color-text-muted)';
        bannerTextSpan.style.whiteSpace = 'pre-line'; // Preserve line breaks and wrap text
        
        nameContainer.appendChild(productNameSpan);
        nameContainer.appendChild(bannerTextSpan);
        nameEl.appendChild(nameContainer);
        
        // Add Home Gym info below the name container for first item
        if (index === 0 && selectedGym) {
          const gymInfo = createHomeGymInfo(selectedGym);
          nameEl.appendChild(gymInfo);
        }
      } else {
        nameEl.textContent = item.name;
        
        // Add Home Gym info below the first item's name
        if (index === 0 && selectedGym) {
          const gymInfo = createHomeGymInfo(selectedGym);
          nameEl.appendChild(gymInfo);
        }
      }
    }
    
    // Hide price for membership items (price already shown in Monthly fee section)
    if (priceEl) {
      if (item.type === 'membership') {
        priceEl.style.display = 'none';
      } else {
        // Calculate discounted price for this item
        let displayPrice = item.amount;
        let originalPrice = item.amount;
        
        // If discount is applied, calculate discounted price proportionally
        if (state.discountApplied && state.totals.discountAmount > 0 && state.totals.subtotal > 0) {
          // Calculate discount ratio
          const discountRatio = state.totals.discountAmount / state.totals.subtotal;
          // Apply discount proportionally to this item
          const itemDiscount = item.amount * discountRatio;
          displayPrice = Math.max(0, item.amount - itemDiscount);
          
          // If discount is 100% or more, show 0
          if (state.totals.discountAmount >= state.totals.subtotal) {
            displayPrice = 0;
          }
        }
        
        // Display price - show discounted price if different from original
        if (displayPrice !== originalPrice && state.discountApplied) {
          // Show original price with strikethrough and discounted price
          const originalText = formatPriceHalfKrone(roundToHalfKrone(originalPrice));
          const discountedText = formatPriceHalfKrone(roundToHalfKrone(displayPrice));
          priceEl.innerHTML = `<span style="text-decoration: line-through; opacity: 0.6; margin-right: 8px;">${originalText} kr</span><span style="color: #10B981; font-weight: 600;">${discountedText} kr</span>`;
        } else {
          priceEl.textContent = displayPrice
            ? `${formatPriceHalfKrone(roundToHalfKrone(displayPrice))} kr`
            : '';
        }
      }
    }

    DOM.cartItems.appendChild(cartItem);
  });
}

function renderCartAddons() {
  if (!templates.cartItem || !DOM.cartAddons) return;
  DOM.cartAddons.innerHTML = '';

  // Filter to only non-membership items (addons, boost products, etc.)
  const addonItems = state.cartItems.filter(item => item.type !== 'membership');

  if (!addonItems.length) {
    DOM.cartAddons.style.display = 'none';
    return;
  }

  DOM.cartAddons.style.display = 'block';

  addonItems.forEach((item) => {
    const cartItem = templates.cartItem.content.firstElementChild.cloneNode(true);
    const nameEl = cartItem.querySelector('[data-element="name"]');
    const priceEl = cartItem.querySelector('[data-element="price"]');

    if (nameEl) {
      nameEl.textContent = item.name;
    }
    
    if (priceEl) {
      // Calculate discounted price for this item
      let displayPrice = item.amount;
      let originalPrice = item.amount;
      
      // If discount is applied, calculate discounted price proportionally
      if (state.discountApplied && state.totals.discountAmount > 0 && state.totals.subtotal > 0) {
        // Calculate discount ratio
        const discountRatio = state.totals.discountAmount / state.totals.subtotal;
        // Apply discount proportionally to this item
        const itemDiscount = item.amount * discountRatio;
        displayPrice = Math.max(0, item.amount - itemDiscount);
        
        // If discount is 100% or more, show 0
        if (state.totals.discountAmount >= state.totals.subtotal) {
          displayPrice = 0;
        }
      }
      
      // Round prices to half krone
      const roundedOriginalPrice = roundToHalfKrone(originalPrice);
      const roundedDisplayPrice = roundToHalfKrone(displayPrice);
      
      // Display price - show discounted price if different from original
      if (roundedDisplayPrice !== roundedOriginalPrice && state.discountApplied) {
        // Show original price with strikethrough and discounted price
        priceEl.innerHTML = `<span style="text-decoration: line-through; opacity: 0.6; margin-right: 8px;">${formatPriceHalfKrone(roundedOriginalPrice)} kr</span><span style="color: #10B981; font-weight: 600;">${formatPriceHalfKrone(roundedDisplayPrice)} kr</span>`;
      } else {
        // Always show price, including "0 kr" for free items
        priceEl.textContent = formatPriceHalfKrone(roundedDisplayPrice) + ' kr';
      }
    }

    DOM.cartAddons.appendChild(cartItem);
  });
}

function renderCartTotal() {
  // Cart total is no longer displayed - payment overview shows calculated prices instead
  // Just update payment overview which shows the correct calculated prices
  
  // Update payment overview (shows "Betales nu" and "Månedlig betaling herefter")
  updatePaymentOverview();
  
  // Update cart total display
  const cartTotalEl = document.querySelector('[data-summary-field="cart-total"]');
  const cartTotalContainer = document.querySelector('.cart-total');
  
  if (cartTotalEl) {
    // Calculate total as: Pay now amount + addon items
    // Get addon items total (non-membership items)
    const addonItems = state.cartItems.filter(item => item.type !== 'membership');
    const addonTotal = addonItems.reduce((sum, item) => sum + item.amount, 0);
    
    // Get "Pay now" amount from state (calculated by updatePaymentOverview)
    const payNowAmount = state.totals.payNowAmount || 0;
    
    // Total = Pay now + Addons (both already rounded to half krone)
    let total = (state.totals.payNowAmount || 0) + addonTotal;
    
    // Apply discount if applicable (discount should be applied to the total)
    if (state.discountApplied && state.totals.discountAmount > 0) {
      total = Math.max(0, total - state.totals.discountAmount);
    }
    
    // Round total to half krone and format
    // Format: "569,00 kr" or "569,50 kr" (no dot, consistent with cart items)
    const roundedTotal = roundToHalfKrone(total);
    cartTotalEl.textContent = formatPriceHalfKrone(roundedTotal) + ' kr';
  }
  
  // Show/hide cart total container based on whether there are items
  if (cartTotalContainer) {
    const hasItems = state.cartItems && state.cartItems.length > 0;
    // Only show if there are non-membership items (membership price is shown in payment overview)
    const hasNonMembershipItems = state.cartItems && state.cartItems.some(item => item.type !== 'membership');
    cartTotalContainer.style.display = hasNonMembershipItems ? 'block' : 'none';
  }
  
  // Update discount display if discount is applied
  updateDiscountDisplay();
  
  console.log('[Cart] Updated cart display (subtotal:', state.totals.subtotal, 'discount:', state.totals.discountAmount, ')');
}

/**
 * Updates the payment overview section in the cart summary.
 * 
 * Displays:
 * - "Betales nu:" (Pay now) - The initial payment amount with billing period
 * - "Månedlig betaling herefter:" (Monthly payment thereafter) - The recurring monthly fee
 * 
 * Based on OpenAPI 3.0.1 documentation:
 * - Order.price.amount: Total price of the order (CurrencyOut)
 * - SubscriptionItem.initialPaymentPeriod: First payment period (DayRange with start/end)
 * - SubscriptionItem.payRecurring.price.amount: Recurring monthly price after promotional period (CurrencyOut)
 * 
 * @see docs/brp-api3-openapi.yaml - OrderOut, SubscriptionItemOut schemas
 */
function updatePaymentOverview() {
  // Only show payment overview if there's a membership (subscription) in the cart
  const hasMembership = state.selectedProductType === 'membership' && state.selectedProductId;
  
  // Initialize DOM references
  if (!DOM.paymentOverview) {
    DOM.paymentOverview = document.querySelector('.payment-overview');
  }
  if (!DOM.payNow) {
    DOM.payNow = document.querySelector('[data-summary-field="pay-now"]');
  }
  if (!DOM.monthlyPayment) {
    DOM.monthlyPayment = document.querySelector('[data-summary-field="monthly-payment"]');
  }
  if (!DOM.paymentBillingPeriod) {
    DOM.paymentBillingPeriod = document.querySelector('[data-summary-field="payment-billing-period"]');
  }
  if (!DOM.paymentBoundUntil) {
    DOM.paymentBoundUntil = document.querySelector('[data-summary-field="payment-bound-until"]');
  }
  
  if (!DOM.paymentOverview || !DOM.payNow || !DOM.monthlyPayment) {
    return;
  }
  
  if (!hasMembership) {
    // Hide payment overview if no membership
    DOM.paymentOverview.style.display = 'none';
    return;
  }
  
  // Show payment overview - don't wait for order data, show prices from product data immediately
  DOM.paymentOverview.style.display = 'block';
  
  console.log('[Payment Overview] ===== UPDATING PAYMENT OVERVIEW =====');
  console.log('[Payment Overview] Order data:', {
    hasFullOrder: !!state.fullOrder,
    orderId: state.fullOrder?.id,
    orderNumber: state.fullOrder?.number,
    orderPrice: state.fullOrder?.price,
    hasSubscriptionItems: !!(state.fullOrder?.subscriptionItems && state.fullOrder.subscriptionItems.length > 0),
    subscriptionItemsCount: state.fullOrder?.subscriptionItems?.length || 0
  });
  
  // Get subscription item from order if available (per OpenAPI: OrderOut.subscriptionItems[0])
  // If not available, we'll use product data instead
  const subscriptionItem = state.fullOrder?.subscriptionItems?.[0];
  const hasOrderData = !!subscriptionItem;
  
  // Check if this is a 15-day pass with shoes (one-time payment product)
  // Check both order data and product data
  const allSubscriptions = [
    ...(state.campaignSubscriptions || []),
    ...(state.subscriptions || []),
    ...(state.dayPassSubscriptions || [])
  ];
  const productIdNum = typeof state.selectedProductId === 'string' 
    ? parseInt(state.selectedProductId) 
    : state.selectedProductId;
  const currentProduct = allSubscriptions.find(p => 
    p.id === state.selectedProductId || 
    p.id === productIdNum ||
    String(p.id) === String(state.selectedProductId)
  );
  
  // Check product name from order data first, then fall back to product data
  const productFromOrder = subscriptionItem?.product;
  const productName = productFromOrder?.name || currentProduct?.name || '';
  const productLabels = currentProduct?.productLabels || currentProduct?.labels || [];
  const has15DayPassLabel = Array.isArray(productLabels) && productLabels.some(
    label => label?.name && label.name.toLowerCase() === '15 day pass'
  );
  const is15DayPass =
    state.selectedProductType === '15daypass' ||
    has15DayPassLabel ||
    (productName && (
      productName.toLowerCase().includes('15 day pass') ||
      productName.toLowerCase().includes('15 dages')
    ));
  
  // ============================================================================
  // CALCULATE "BETALES NU" (PAY NOW)
  // ============================================================================
  // CRITICAL: Use the EXACT same price that backend sends to payment window
  // Payment link API reads order.price.amount from backend, so we must use the same value
  // This ensures "Betales nu" matches the price shown in payment window
  // 
  // Per OpenAPI: OrderOut.price (CurrencyOut) - The total price of the order
  // If order data is not available, calculate from product data
  let payNowAmount = 0;
  let billingPeriod = null;
  
  if (hasOrderData && state.fullOrder?.price?.amount !== undefined) {
    // CRITICAL: Use API price from order - this is the authoritative source
    // This ensures "Pay now" matches exactly what backend sends to payment window
    // Extract price amount (CurrencyOut can be object with .amount or direct number)
    const orderPriceAmount = state.fullOrder.price.amount;
    const orderPriceDKK = typeof orderPriceAmount === 'object' 
      ? orderPriceAmount.amount / 100 
      : orderPriceAmount / 100;
    
    console.log('[Payment Overview] ✅ Using API price from order (fullOrder.price.amount):', orderPriceDKK, 'DKK');
    
    if (is15DayPass) {
      // For 15-day pass: always use full price (one-time payment)
      payNowAmount = orderPriceDKK;
      
      // Set valid until date (15 days from today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const validUntil = new Date(today);
      validUntil.setDate(validUntil.getDate() + 15);
      
      billingPeriod = {
        start: today,
        end: validUntil,
        is15DayPass: true
      };
      
      console.log('[Payment Overview] ✅ 15-day pass: Full price (one-time payment):', payNowAmount, 'DKK');
    } else {
      // Regular membership: Get initialPaymentPeriod (per OpenAPI: SubscriptionItemOut.initialPaymentPeriod - DayRange)
      const initialPaymentPeriod = subscriptionItem.initialPaymentPeriod;
      const payRecurring = subscriptionItem.payRecurring;
      const recurringPriceAmount = payRecurring?.price?.amount || 0;
      
      // Verify backend pricing is correct using robust verification method
      const productId = subscriptionItem?.product?.id || state.selectedProductId;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDateStr = today.toISOString().split('T')[0];
      const expectedPrice = orderAPI._calculateExpectedPartialMonthPrice(productId, startDateStr);
      
      if (initialPaymentPeriod?.start) {
        const backendStartDate = new Date(initialPaymentPeriod.start);
        const backendEndDate = new Date(initialPaymentPeriod.end);
        
        // Use verification method to check if pricing is correct
        const verification = orderAPI._verifySubscriptionPricing(
          state.fullOrder,
          productId,
          expectedPrice,
          today
        );
        
        if (verification.isCorrect || (verification.priceDifference !== null && verification.priceDifference <= 100)) {
          // Backend calculated correctly - use backend's price
          payNowAmount = orderPriceDKK;
          billingPeriod = {
            start: backendStartDate,
            end: backendEndDate
          };
          console.log('[Payment Overview] ✅ Backend pricing accepted:', payNowAmount, 'DKK');
        } else {
          // Backend pricing is incorrect - calculate correct price client-side
          console.warn('[Payment Overview] ⚠️ Backend pricing is incorrect!');
          console.warn('[Payment Overview] ⚠️ Backend shows:', orderPriceDKK, 'DKK');
          console.warn('[Payment Overview] ⚠️ Expected:', expectedPrice?.amountInDKK || 'N/A', 'DKK');
          console.warn('[Payment Overview] ⚠️ Verification:', verification);
          
          if (expectedPrice) {
            // Use calculated correct price
            payNowAmount = expectedPrice.amountInDKK;
            
            // Set billing period to today - end of month
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
            billingPeriod = {
              start: today,
              end: lastDayOfMonth
            };
            console.log('[Payment Overview] ✅ Using client-calculated correct price:', payNowAmount, 'DKK');
            console.warn('[Payment Overview] ⚠️ NOTE: Payment window may show different price if backend bug persists');
          } else {
            // Can't calculate expected price - use backend price as fallback
            payNowAmount = orderPriceDKK;
            billingPeriod = {
              start: backendStartDate,
              end: backendEndDate
            };
            console.warn('[Payment Overview] ⚠️ Cannot calculate expected price - using backend price as fallback');
          }
        }
      } else {
        // No initialPaymentPeriod - use order price as-is
        payNowAmount = orderPriceDKK;
        console.log('[Payment Overview] ✅ Pay now from fullOrder.price.amount:', payNowAmount, 'DKK (no initialPaymentPeriod)');
      }
    }
  } else {
    // No order data yet - calculate price from product data
    // This allows prices to be shown before login/account creation
    if (state.selectedProductId && state.subscriptions) {
      const productIdNum = typeof state.selectedProductId === 'string' 
        ? parseInt(state.selectedProductId) 
        : state.selectedProductId;
      
      // Check all subscription types: campaign, membership, and 15 Day Pass
      const allSubscriptions = [
        ...(state.campaignSubscriptions || []),
        ...(state.subscriptions || []),
        ...(state.dayPassSubscriptions || [])
      ];
      const membership = allSubscriptions.find(p => 
        p.id === state.selectedProductId || 
        p.id === productIdNum ||
        String(p.id) === String(state.selectedProductId)
      );
      
      if (membership) {
        const membershipLabels = membership.productLabels || membership.labels || [];
        const isMembership15DayPass =
          state.selectedProductType === '15daypass' ||
          (Array.isArray(membershipLabels) && membershipLabels.some(
            label => label?.name && label.name.toLowerCase() === '15 day pass'
          )) ||
          (membership.name && (
            membership.name.toLowerCase().includes('15 day pass') ||
            membership.name.toLowerCase().includes('15 dages')
          ));
        
        if (isMembership15DayPass) {
          // For 15-day pass: always use full price (one-time payment)
          const priceInCents = membership.priceWithInterval?.price?.amount || 0;
          payNowAmount = priceInCents / 100;
          
          // Set valid until date (15 days from today)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const validUntil = new Date(today);
          validUntil.setDate(validUntil.getDate() + 15);
          
          billingPeriod = {
            start: today,
            end: validUntil,
            is15DayPass: true
          };
          
          console.log('[Payment Overview] ✅ 15-day pass: Full price (one-time payment):', payNowAmount, 'DKK');
        } else {
          // Regular membership: Calculate partial month price client-side
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const startDateStr = today.toISOString().split('T')[0];
          
          // Try to use the helper function if available
          if (orderAPI && orderAPI._calculateExpectedPartialMonthPrice) {
            const expectedPrice = orderAPI._calculateExpectedPartialMonthPrice(membership.id, startDateStr);
            if (expectedPrice) {
              payNowAmount = expectedPrice.amountInDKK;
              
              // Set billing period to today - end of month
              const currentMonth = today.getMonth();
              const currentYear = today.getFullYear();
              const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
              billingPeriod = {
                start: today,
                end: lastDayOfMonth
              };
              console.log('[Payment Overview] ✅ Pay now calculated from product data (partial month):', payNowAmount, 'DKK');
            } else {
              // Fallback to full month price
              const priceInCents = membership.priceWithInterval?.price?.amount || 0;
              payNowAmount = priceInCents / 100;
              console.log('[Payment Overview] ⚠️ Pay now from product data (full month - fallback):', payNowAmount, 'DKK');
            }
          } else {
            // Calculate partial month price manually
            const priceInCents = membership.priceWithInterval?.price?.amount || 0;
            const monthlyPrice = priceInCents / 100;
            
            // Calculate days until end of month
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
            const daysInMonth = lastDayOfMonth.getDate();
            const daysRemaining = lastDayOfMonth.getDate() - today.getDate() + 1;
            
            // Calculate partial month price
            payNowAmount = (monthlyPrice / daysInMonth) * daysRemaining;
            
            billingPeriod = {
              start: today,
              end: lastDayOfMonth
            };
            
            console.log('[Payment Overview] ✅ Pay now calculated from product data (partial month, manual calc):', payNowAmount, 'DKK');
          }
        }
      } else {
        // Fallback: Use cart total
        payNowAmount = state.totals.cartTotal || 0;
        console.log('[Payment Overview] ⚠️ Pay now from cartTotal (fallback):', payNowAmount, 'DKK - product not found');
      }
    } else {
      // Fallback: Use cart total if product data not available
      payNowAmount = state.totals.cartTotal || 0;
      console.log('[Payment Overview] ⚠️ Pay now from cartTotal (fallback):', payNowAmount, 'DKK - product data not available');
    }
  }
  
  // ============================================================================
  // CALCULATE "MÅNEDLIG BETALING HEREFTER" (MONTHLY PAYMENT THEREAFTER)
  // ============================================================================
  // Skip monthly payment calculation for 15-day pass (one-time payment)
  let monthlyPaymentAmount = 0;
  
  if (!is15DayPass) {
    // Per OpenAPI: SubscriptionItemOut.payRecurring.price.amount
    // This is ALWAYS the regular monthly price after any promotional period
    // Even if there's an initialPaymentPeriod, payRecurring shows the price after promotion ends
    
    // CRITICAL: Always prioritize API data from order
    // Per OpenAPI: SubscriptionItemOut.payRecurring.price.amount is the recurring price AFTER promotional period
    // For products with promotions, this shows the regular price after discount period ends
    if (hasOrderData && subscriptionItem.payRecurring?.price?.amount !== undefined) {
      // Use API price from order - this is the authoritative source
      const recurringPriceAmount = subscriptionItem.payRecurring.price.amount;
      monthlyPaymentAmount = typeof recurringPriceAmount === 'object' 
        ? recurringPriceAmount.amount / 100 
        : recurringPriceAmount / 100;
      console.log('[Payment Overview] ✅ Monthly payment from API (payRecurring.price.amount):', monthlyPaymentAmount, 'DKK');
    } else if (hasOrderData && subscriptionItem?.product?.priceWithInterval?.price?.amount !== undefined) {
      // Fallback: Use product price from order if payRecurring not available
      const productPriceAmount = subscriptionItem.product.priceWithInterval.price.amount;
      monthlyPaymentAmount = typeof productPriceAmount === 'object' 
        ? productPriceAmount.amount / 100 
        : productPriceAmount / 100;
      console.log('[Payment Overview] ⚠️ Monthly payment from API (product.priceWithInterval - fallback):', monthlyPaymentAmount, 'DKK');
    } else {
      // No order data yet - use product data from API response
      // Check all subscription types: campaign, membership, and 15 Day Pass
      const allSubscriptionsForMonthly = [
        ...(state.campaignSubscriptions || []),
        ...(state.subscriptions || []),
        ...(state.dayPassSubscriptions || [])
      ];
      if (state.selectedProductId && allSubscriptionsForMonthly.length > 0) {
        const productIdNum = typeof state.selectedProductId === 'string' 
          ? parseInt(state.selectedProductId) 
          : state.selectedProductId;
        
        const membership = allSubscriptionsForMonthly.find(p => 
          p.id === state.selectedProductId || 
          p.id === productIdNum ||
          String(p.id) === String(state.selectedProductId)
        );
        
        if (membership?.priceWithInterval?.price?.amount !== undefined) {
          // Use price from API product data
          monthlyPaymentAmount = membership.priceWithInterval.price.amount / 100;
          console.log('[Payment Overview] Monthly payment from API product data (priceWithInterval):', monthlyPaymentAmount, 'DKK');
        } else {
          monthlyPaymentAmount = state.totals.membershipMonthly || 0;
          console.log('[Payment Overview] ⚠️ Monthly payment from state.totals.membershipMonthly (fallback):', monthlyPaymentAmount, 'DKK');
        }
      } else {
        monthlyPaymentAmount = state.totals.membershipMonthly || 0;
        console.log('[Payment Overview] ⚠️ Monthly payment from state.totals.membershipMonthly (fallback):', monthlyPaymentAmount, 'DKK');
      }
    }
  } else {
    console.log('[Payment Overview] ⏭️ Skipping monthly payment calculation (15-day pass - one-time payment)');
  }
  
  // ============================================================================
  // UPDATE DOM ELEMENTS
  // ============================================================================
  
  // Prepare billing period text
  let billingPeriodText = '';
  if (is15DayPass && billingPeriod?.is15DayPass) {
    // For 15-day pass: show "Valid until [date 15 days in future]"
    billingPeriodText = `${t('cart.validUntil')} ${formatDateDMY(billingPeriod.end)}`;
  } else if (billingPeriod) {
    // Regular membership: show billing period dates only
    billingPeriodText = `${formatDateDMY(billingPeriod.start)} - ${formatDateDMY(billingPeriod.end)}`;
  } else if (hasOrderData && subscriptionItem?.boundUntil) {
    // No initialPaymentPeriod, but there's a boundUntil date
    const boundUntilDate = new Date(subscriptionItem.boundUntil);
    billingPeriodText = `${t('cart.boundUntil').charAt(0).toUpperCase() + t('cart.boundUntil').slice(1)} ${formatDateDMY(boundUntilDate)}`;
  }
  
  // Fallback to state.billingPeriod if available
  if (!billingPeriodText && state.billingPeriod) {
    billingPeriodText = state.billingPeriod;
  }
  
  // If still no billing period, show default message
  if (!billingPeriodText) {
    billingPeriodText = t('cart.billingPeriodConfirmed');
  }
  
  // If discount is applied but order price isn't available yet, reflect discount in pay-now
  if (state.discountApplied && state.totals.discountAmount > 0 && !state.fullOrder?.price?.amount) {
    const adjustedPayNow = Math.max(0, payNowAmount - state.totals.discountAmount);
    if (adjustedPayNow !== payNowAmount) {
      console.log('[Payment Overview] Applying discount to pay-now fallback:', {
        original: payNowAmount,
        discount: state.totals.discountAmount,
        adjusted: adjustedPayNow
      });
      payNowAmount = adjustedPayNow;
    }
  }

  // Round payNowAmount to half krone and store in state for use in cart total calculation
  state.totals.payNowAmount = roundToHalfKrone(payNowAmount);
  
  if (DOM.payNow) {
    const amountText = formatCurrencyHalfKrone(state.totals.payNowAmount);
    DOM.payNow.textContent = amountText;
    
    // Add period after "Pay now" label but before amount
    const payNowRow = DOM.payNow.closest('.payment-overview-paynow-row');
    if (payNowRow && billingPeriodText) {
      let periodElement = payNowRow.querySelector('.payment-label-period');
      if (!periodElement) {
        // Create period element if it doesn't exist
        periodElement = document.createElement('span');
        periodElement.className = 'payment-label-period payment-period';
        // Insert after the label, before the amount
        const label = payNowRow.querySelector('.payment-label');
        if (label && label.nextSibling) {
          label.parentNode.insertBefore(periodElement, label.nextSibling);
        } else if (label) {
          label.parentNode.insertBefore(periodElement, DOM.payNow);
        }
      }
      periodElement.textContent = `(${billingPeriodText})`;
    } else if (payNowRow) {
      // Hide period element if no billing period text
      const periodElement = payNowRow.querySelector('.payment-label-period');
      if (periodElement) {
        periodElement.textContent = '';
      }
    }
    
    // Verify this matches payment window price (only if order data is available)
    if (hasOrderData && state.fullOrder?.price?.amount !== undefined) {
      const orderPriceForPayment = state.fullOrder.price.amount;
      const orderPriceDKK = typeof orderPriceForPayment === 'object' 
        ? orderPriceForPayment.amount / 100 
        : orderPriceForPayment / 100;
      const pricesMatch = Math.abs(payNowAmount - orderPriceDKK) < 0.01; // Allow small rounding differences
      
      console.log('[Payment Overview] 🔍 "Betales nu" price:', payNowAmount, 'DKK');
      console.log('[Payment Overview] 🔍 Order price (sent to payment window):', orderPriceDKK, 'DKK');
      console.log('[Payment Overview] 🔍 Prices match:', pricesMatch ? '✅ YES' : '❌ NO - MISMATCH!');
      
      if (!pricesMatch) {
        const productId = subscriptionItem?.product?.id || state.selectedProductId;
        console.warn('[Payment Overview] ⚠️ PRICE MISMATCH DETECTED!');
        console.warn('[Payment Overview] ⚠️ UI shows:', payNowAmount, 'DKK');
        console.warn('[Payment Overview] ⚠️ Payment window will show:', orderPriceDKK, 'DKK');
        console.warn('[Payment Overview] ⚠️ Product ID:', productId);
      }
    } else {
      console.log('[Payment Overview] 🔍 "Betales nu" price (from product data):', payNowAmount, 'DKK');
      console.log('[Payment Overview] ℹ️ Order data not available yet - price will be verified when order is created');
    }
  }
  
  // Update "Månedlig betaling herefter" (Monthly payment thereafter)
  // Hide monthly payment for 15-day pass (one-time payment)
  if (DOM.monthlyPayment) {
    if (is15DayPass) {
      // Hide monthly payment section for one-time payment products
      const monthlyPaymentItem = DOM.monthlyPayment.closest('.payment-overview-item');
      if (monthlyPaymentItem) {
        monthlyPaymentItem.style.display = 'none';
      }
    } else {
      // Show monthly payment for regular memberships
      const monthlyPaymentItem = DOM.monthlyPayment.closest('.payment-overview-item');
      if (monthlyPaymentItem) {
        monthlyPaymentItem.style.display = '';
      }
      if (monthlyPaymentAmount > 0) {
        const roundedMonthly = roundToHalfKrone(monthlyPaymentAmount);
        DOM.monthlyPayment.textContent = `${formatCurrencyHalfKrone(roundedMonthly)}/md`;
      } else {
        DOM.monthlyPayment.textContent = '—';
      }
    }
  }

  // Show discount row in payment overview when discount is applied
  if (DOM.paymentDiscount) {
    const discountRow = DOM.paymentDiscount.closest('.payment-overview-discount');
    if (state.discountApplied && state.totals.discountAmount > 0) {
      DOM.paymentDiscount.textContent = `-${formatCurrencyHalfKrone(state.totals.discountAmount)}`;
      if (discountRow) {
        discountRow.style.display = 'flex';
      }
    } else if (discountRow) {
      discountRow.style.display = 'none';
    }
  }
  
  // Display boundUntil date separately if available (for memberships with promotional periods)
  if (DOM.paymentBoundUntil) {
    if (hasOrderData && subscriptionItem?.boundUntil && !is15DayPass) {
      const boundUntilDate = new Date(subscriptionItem.boundUntil);
      const boundUntilText = `${t('cart.boundUntil').charAt(0).toUpperCase() + t('cart.boundUntil').slice(1)} ${formatDateDMY(boundUntilDate)}`;
      DOM.paymentBoundUntil.textContent = boundUntilText;
      DOM.paymentBoundUntil.style.display = 'block';
    } else {
      DOM.paymentBoundUntil.style.display = 'none';
    }
  }
  
  console.log('[Payment Overview] ✅ Updated:', {
    payNow: payNowAmount,
    monthlyPayment: monthlyPaymentAmount,
    billingPeriod: DOM.paymentBillingPeriod?.textContent || 'N/A'
  });
}

function updateDiscountDisplay() {
  // Find or create discount display element
  let discountDisplay = DOM.discountDisplay || document.querySelector('[data-discount-display]') || document.querySelector('.discount-display');
  
  // Show discount display if discount is applied OR if discount code is stored (pending application)
  // BUT: Don't show pending message if we're currently applying a discount (button is disabled)
  const isApplyingDiscount = DOM.applyDiscountBtn && DOM.applyDiscountBtn.disabled && DOM.applyDiscountBtn.textContent.includes('Applying');
  const shouldShowPending = state.discountCode && !state.discountApplied && !isApplyingDiscount;
  
  if (state.discountApplied || shouldShowPending) {
    // Ensure subtotal is calculated - but don't call updateCartTotals() to avoid recursion
    // Instead, just recalculate subtotal if needed
    if (!state.totals.subtotal || state.totals.subtotal === 0) {
      const items = [];
      if (state.membershipPlanId) {
        const plan = findMembershipPlan(state.membershipPlanId);
        if (plan) items.push({ amount: plan.price });
      }
      state.valueCardQuantities.forEach((quantity, planId) => {
        if (quantity > 0) {
          const plan = findValueCard(planId);
          if (plan) items.push({ amount: plan.price * quantity });
        }
      });
      state.addonIds.forEach((addonId) => {
        const addon = findAddon(addonId);
        if (addon) items.push({ amount: addon.price.discounted });
      });
      state.totals.subtotal = roundToHalfKrone(items.reduce((total, item) => total + item.amount, 0));
    }
    
    if (!discountDisplay) {
      // Create discount display element
      discountDisplay = document.createElement('div');
      discountDisplay.className = 'discount-display';

      // Prefer placing under the discount form
      if (DOM.discountForm) {
        DOM.discountForm.insertAdjacentElement('afterend', discountDisplay);
      } else {
        // Fallback: insert before cart total
        const cartTotalEl = document.querySelector('.cart-total');
        if (cartTotalEl) {
          cartTotalEl.insertAdjacentElement('beforebegin', discountDisplay);
        } else {
          // Fallback: try to find cart total by data attribute
          const cartTotalByAttr = document.querySelector('[data-summary-field="cart-total"]');
          if (cartTotalByAttr && cartTotalByAttr.parentElement) {
            cartTotalByAttr.parentElement.insertBefore(discountDisplay, cartTotalByAttr);
          }
        }
      }
      DOM.discountDisplay = discountDisplay;
    }
    
    // Build discount display HTML - show subtotal, discount, and final total
    if (state.discountApplied) {
      // Discount is applied - show actual discount amount
      const discountValue = state.totals.discountAmount > 0
        ? `-${formatCurrencyHalfKrone(state.totals.discountAmount)}`
        : formatCurrencyHalfKrone(0);
      discountDisplay.innerHTML = `
        <div class="discount-row">
          <span class="discount-label">Subtotal:</span>
          <span class="discount-value">${formatCurrencyHalfKrone(state.totals.subtotal)}</span>
        </div>
        <div class="discount-row discount-applied">
          <span class="discount-label">Discount (${state.discountCode}):</span>
          <span class="discount-value">${discountValue}</span>
        </div>
        <div class="discount-row discount-total" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
          <span class="discount-label" style="font-weight: bold;">Total:</span>
          <span class="discount-value" style="font-weight: bold;">${formatCurrencyHalfKrone(state.totals.cartTotal)}</span>
        </div>
      `;
    } else if (state.discountCode && !state.discountApplied) {
      // Discount code entered but not yet applied (pending) - show subtotal only
      discountDisplay.innerHTML = `
        <div class="discount-row">
          <span class="discount-label">Subtotal:</span>
          <span class="discount-value">${formatCurrencyHalfKrone(state.totals.subtotal)}</span>
        </div>
        <div class="discount-row discount-pending" style="opacity: 0.7; font-style: italic;">
          <span class="discount-label">Discount code (${state.discountCode}):</span>
          <span class="discount-value">Will be applied at checkout</span>
        </div>
        <div class="discount-row discount-total" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
          <span class="discount-label" style="font-weight: bold;">Total:</span>
          <span class="discount-value" style="font-weight: bold;">${formatCurrencyHalfKrone(state.totals.cartTotal)}</span>
        </div>
      `;
    }
    discountDisplay.style.display = 'block';
  } else if (discountDisplay) {
    discountDisplay.style.display = 'none';
  }
}

function persistOrderSnapshot(orderId) {
  if (!orderId) return;
  try {
    sessionStorage.setItem('boulders_checkout_order', JSON.stringify({
      orderId,
      membershipPlanId: state.membershipPlanId,
      cartItems: state.cartItems || [],
      totals: state.totals,
      selectedBusinessUnit: state.selectedBusinessUnit,
      selectedProductType: state.selectedProductType, // Store product type for restoration
      selectedProductId: state.selectedProductId, // Store product ID for restoration
    }));
  } catch (e) {
    console.warn('[checkout] Could not save order to sessionStorage:', e);
  }
}

function clearStoredOrderData(reason = 'manual') {
  console.log(`[checkout] Clearing stored order data (${reason})`);
  state.order = null;
  state.orderId = null;
  state.subscriptionAttachedOrderId = null;
  state.paymentLink = null;
  state.paymentLinkGenerated = false;
  state.checkoutInProgress = false;
  state.cartItems = [];
  state.totals = {
    cartTotal: 0,
    membershipMonthly: 0,
  };

  try {
    sessionStorage.removeItem('boulders_checkout_order');
  } catch (error) {
    console.warn('[checkout] Could not clear order session data:', error);
  }
}

async function ensureOrderCreated(context = 'auto') {
  if (state.orderId) {
    console.log(`[checkout] Reusing existing order ${state.orderId} (${context})`);
    persistOrderSnapshot(state.orderId);
    return state.orderId;
  }

  if (orderCreationPromise) {
    console.log(`[checkout] Awaiting existing order creation (${context})`);
    return orderCreationPromise;
  }

  if (!state.customerId) {
    console.warn(`[checkout] Cannot create order (${context}) - customerId missing`);
    return null;
  }

  if (!state.selectedBusinessUnit) {
    console.warn(`[checkout] Cannot create order (${context}) - business unit missing`);
    return null;
  }

  const orderData = {
    customer: Number(state.customerId),
    businessUnit: state.selectedBusinessUnit,
  };

  orderCreationPromise = (async () => {
    console.log(`[checkout] Creating order (context: ${context})...`);
    const order = await orderAPI.createOrder(orderData);
    state.orderId = order.id || order.orderId;
    state.subscriptionAttachedOrderId = null;
    
    // Store full order object for payment overview
    // Note: This order might not have subscriptionItems yet, but we'll update it later
    state.fullOrder = order;
    
    // Update payment overview if we're on step 4
    if (state.currentStep === 4) {
      updatePaymentOverview();
    }
    
    persistOrderSnapshot(state.orderId);
    console.log(`[checkout] Order ready: ${state.orderId} (${context})`);
    return state.orderId;
  })();

  try {
    return await orderCreationPromise;
  } finally {
    orderCreationPromise = null;
  }
}

async function ensureSubscriptionAttached(context = 'auto') {
  // Check if this is actually a membership (not a punch card)
  // Punch cards have membershipPlanId like "punch-43" but selectedProductType is "punch-card"
  const isMembership = state.membershipPlanId && 
    (state.selectedProductType === 'membership' || 
     (typeof state.membershipPlanId === 'string' && state.membershipPlanId.startsWith('membership-')));
  
  if (!state.membershipPlanId || !isMembership) {
    if (state.membershipPlanId && !isMembership) {
      console.log(`[checkout] Skipping subscription attach (${context}) - this is a punch card, not a membership`);
      console.log(`[checkout] membershipPlanId: ${state.membershipPlanId}, selectedProductType: ${state.selectedProductType}`);
    } else {
      console.warn(`[checkout] Cannot attach subscription (${context}) - no membership selected`);
    }
    return null;
  }

  const orderId = await ensureOrderCreated(`${context}-subscription`);
  if (!orderId) {
    console.warn(`[checkout] Cannot attach subscription (${context}) - order missing`);
    return null;
  }

  if (state.subscriptionAttachedOrderId === orderId) {
    console.log(`[checkout] Subscription already attached to order ${orderId} (${context})`);
    return orderId;
  }

  if (subscriptionAttachPromise) {
    console.log(`[checkout] Awaiting existing subscription attach (${context})`);
    return subscriptionAttachPromise;
  }

  subscriptionAttachPromise = (async () => {
    console.log(`[checkout] Attaching membership ${state.membershipPlanId} to order ${orderId} (${context})...`);
    
    // Add subscription item - this may return updated order if startDate was fixed by re-adding
    const subscriptionResponse = await orderAPI.addSubscriptionItem(orderId, state.membershipPlanId);
    state.subscriptionAttachedOrderId = orderId;
    
    // CRITICAL: Use the order from addSubscriptionItem response if available (has correct price after re-add)
    // Otherwise fetch updated order with subscriptionItems for payment overview
    let updatedOrder = subscriptionResponse;
    if (!updatedOrder || !updatedOrder.subscriptionItems) {
      try {
        updatedOrder = await orderAPI.getOrder(orderId);
      } catch (error) {
        console.warn(`[checkout] Could not fetch order for payment overview:`, error);
        return orderId;
      }
    }
    
    // Store full order for payment overview - this now has the correct price
    state.fullOrder = updatedOrder;
    state.order = updatedOrder; // Also update state.order for backward compatibility
    
    // Log the order price to verify it matches what will be sent to payment window
    const orderPriceDKK = updatedOrder?.price?.amount ? updatedOrder.price.amount / 100 : 0;
    const subscriptionItem = updatedOrder?.subscriptionItems?.[0];
    const initialPeriodStart = subscriptionItem?.initialPaymentPeriod?.start;
    console.log('[ensureSubscriptionAttached] ✅ Order data after subscription add:', {
      orderId,
      orderPrice: orderPriceDKK,
      initialPeriodStart,
      hasSubscriptionItems: !!subscriptionItem,
      productId: subscriptionItem?.product?.id,
    });
    
    updatePaymentOverview();
    console.log(`[checkout] Order updated with subscriptionItems for payment overview`);
    
    persistOrderSnapshot(orderId);
    console.log(`[checkout] Membership attached to order ${orderId} (${context})`);
    return orderId;
  })();

  try {
    return await subscriptionAttachPromise;
  } catch (error) {
    console.error(`[checkout] Failed to attach subscription (${context}):`, error);
    throw error;
  } finally {
    subscriptionAttachPromise = null;
  }
}

async function autoEnsureOrderIfReady(context = 'auto') {
  if (!isUserAuthenticated()) {
    return;
  }
  
  // Check if this is actually a membership (not a punch card)
  // Punch cards have membershipPlanId like "punch-43" but selectedProductType is "punch-card"
  const isMembership = state.membershipPlanId && 
    (state.selectedProductType === 'membership' || 
     (typeof state.membershipPlanId === 'string' && state.membershipPlanId.startsWith('membership-')));
  
  if (!state.membershipPlanId || !isMembership) {
    if (state.membershipPlanId && !isMembership) {
      console.log(`[checkout] Skipping auto ensure order (${context}) - this is a punch card, not a membership`);
    }
    return;
  }
  if (!state.selectedBusinessUnit) {
    return;
  }
  try {
    await ensureOrderCreated(`${context}-order`);
    await ensureSubscriptionAttached(`${context}-subscription`);
  } catch (error) {
    console.warn(`[checkout] Auto ensure order failed (${context}):`, error);
  }
}

function isRateLimitError(error) {
  if (!error) return false;
  if (error.status === 429) return true;
  const message = typeof error.message === 'string' ? error.message : '';
  return message.includes('429') || message.toLowerCase().includes('too many requests');
}

function getRetryDelayFromError(error, defaultMs = 120000) {
  // Default to 2 minutes (120 seconds) if we can't extract retryAfter
  const message = typeof error?.message === 'string' ? error.message : '';
  
  // Try to extract retryAfter from JSON in error message
  try {
    const jsonMatch = message.match(/\{[\s\S]*"retryAfter"[\s\S]*\}/);
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[0]);
      if (jsonData.retryAfter) {
        const seconds = parseInt(jsonData.retryAfter, 10);
        if (!isNaN(seconds) && seconds > 0) {
          // Use the actual retryAfter time from API (no cap)
          // Convert seconds to milliseconds
          return Math.max(seconds * 1000, 1000);
        }
      }
    }
  } catch (e) {
    // JSON parse failed, try regex fallback
  }
  
  // Fallback: regex extraction
  const match = message.match(/"retryAfter":\s*(\d+)/i);
  if (match) {
    const seconds = parseInt(match[1], 10);
    if (!isNaN(seconds) && seconds > 0) {
      // Use the actual retryAfter time from API (no cap)
      return Math.max(seconds * 1000, 1000);
    }
  }
  
  return defaultMs;
}

async function handleCheckout() {
  // Prevent multiple simultaneous checkout attempts
  if (state.checkoutInProgress) {
    console.log('[checkout] Checkout already in progress, ignoring duplicate request');
    return;
  }
  
  // Validation (existing)
  if (!validateForm(true)) {
    showToast('Please review the highlighted fields.', 'error');
    // Animate checkout button with red flash
    if (DOM.checkoutBtn) {
      DOM.checkoutBtn.classList.remove('error-flash');
      // Trigger reflow to restart animation
      void DOM.checkoutBtn.offsetWidth;
      DOM.checkoutBtn.classList.add('error-flash');
      setTimeout(() => {
        DOM.checkoutBtn.classList.remove('error-flash');
      }, 600);
    }
    return;
  }

  // Allow checkout if either membership OR punch cards are selected
  const hasMembership = !!state.membershipPlanId;
  const hasPunchCards = state.valueCardQuantities && 
    Array.from(state.valueCardQuantities.values()).some(qty => qty > 0);
  const hasAddons = state.addonIds && state.addonIds.size > 0;

  if (!hasMembership && !hasPunchCards && !hasAddons) {
    showToast('Select a membership, punch card, or add-on to continue.', 'error');
    // Animate checkout button with red flash
    if (DOM.checkoutBtn) {
      DOM.checkoutBtn.classList.remove('error-flash');
      void DOM.checkoutBtn.offsetWidth;
      DOM.checkoutBtn.classList.add('error-flash');
      setTimeout(() => {
        DOM.checkoutBtn.classList.remove('error-flash');
      }, 600);
    }
    return;
  }
  
  // Mark checkout as in progress to prevent state resets
  state.checkoutInProgress = true;

  // GTM: Track begin_checkout event
  if (window.GTM && window.GTM.trackBeginCheckout && state.cartItems && state.cartItems.length > 0) {
    try {
      window.GTM.trackBeginCheckout(state.cartItems, state.totals.cartTotal, 'DKK');
    } catch (error) {
      console.warn('[GTM] Error tracking begin_checkout:', error);
    }
  }

  if (!state.paymentMethod) {
    showToast('Choose a payment method to continue.', 'error');
    // Animate checkout button with red flash
    if (DOM.checkoutBtn) {
      DOM.checkoutBtn.classList.remove('error-flash');
      void DOM.checkoutBtn.offsetWidth;
      DOM.checkoutBtn.classList.add('error-flash');
      setTimeout(() => {
        DOM.checkoutBtn.classList.remove('error-flash');
      }, 600);
    }
    state.checkoutInProgress = false; // Reset on validation error
    return;
  }

  // Set loading state
  setCheckoutLoadingState(true);

  try {
    const payload = buildCheckoutPayload();
    state.forms = payload;
    const customerEmail = payload.customer?.email || state.authenticatedEmail || null;

    // Step 1: Create or authenticate customer
    let customer = null;
    let customerId = state.customerId ?? null;
    
    // Check if user is already logged in
    const accessToken = typeof window.getAccessToken === 'function' ? window.getAccessToken() : null;
    if (accessToken && !customerId) {
      const metadata = getTokenMetadata();
      const metadataId = metadata?.username || metadata?.userName;
      if (metadataId) {
        customerId = String(metadataId);
        state.customerId = customerId;
      }
    }
    
    if (!accessToken) {
      // Create new customer
      try {
        console.log('[checkout] Creating customer...');
        console.log('[checkout] Full payload:', JSON.stringify(payload, null, 2));
        console.log('[checkout] Customer payload:', JSON.stringify(payload.customer, null, 2));
        
        // Build customer data matching API expectations
        // The API expects fields at the top level, not nested under "customer"
        
        // Get phone number and country code
        const phoneNumber = payload.customer?.phone?.number || payload.customer?.phone;
        const phoneCountryCode = payload.customer?.phone?.countryCode || '+45';
        
        // Build mobilePhone object if we have phone number (API expects mobilePhone)
        let mobilePhone = null;
        if (phoneNumber) {
          mobilePhone = {
            countryCode: phoneCountryCode,
            number: phoneNumber
          };
        }
        
        // Get date of birth (API expects birthDate)
        const birthDate = payload.customer?.dateOfBirth;
        
        // Get address fields
        const streetAddress = payload.customer?.address?.street || payload.customer?.address;
        const city = payload.customer?.address?.city || payload.customer?.city;
        const postalCode = payload.customer?.address?.postalCode || payload.customer?.postalCode;
        // Country is always Denmark (DK) for this application
        const country = 'DK';
        
        // Build shippingAddress object if we have address data (API expects shippingAddress)
        let shippingAddress = null;
        if (streetAddress || city || postalCode) {
          shippingAddress = {};
          if (streetAddress) shippingAddress.street = streetAddress;
          if (city) shippingAddress.city = city;
          if (postalCode) shippingAddress.postalCode = postalCode;
          shippingAddress.country = country; // Always DK
        }
        
        const customerData = {
          email: payload.customer?.email,
          firstName: payload.customer?.firstName,
          lastName: payload.customer?.lastName,
          mobilePhone: mobilePhone, // API expects mobilePhone object with countryCode and number
          birthDate: birthDate, // API expects birthDate (not dateOfBirth)
          shippingAddress: shippingAddress, // API expects shippingAddress object
          address: streetAddress, // Keep for backward compatibility
          city: city, // Keep for backward compatibility
          postalCode: postalCode, // Keep for backward compatibility - ensure it's always included
          country: country, // Country from form or default to Denmark
          primaryGym: payload.customer?.primaryGym,
          password: payload.customer?.password,
          customerType: 1, // Required by API - numeric ID (typically 1 = Individual customer type)
          // Include marketing email consent - API field: allowMassSendEmail
          ...(payload.consent?.marketing !== undefined && { allowMassSendEmail: payload.consent.marketing }),
        };
        
        // Also include phone and phoneCountryCode for backward compatibility
        if (phoneNumber) {
          customerData.phone = phoneNumber;
          customerData.phoneCountryCode = phoneCountryCode;
        }
        
        // Also include dateOfBirth for backward compatibility
        if (birthDate) {
          customerData.dateOfBirth = birthDate;
        }
        
        console.log('[checkout] Customer data before cleanup:', JSON.stringify(customerData, null, 2));
        if (customerData.allowMassSendEmail !== undefined) {
          console.log('[checkout] Marketing consent (allowMassSendEmail):', customerData.allowMassSendEmail);
        }
        
        // Remove undefined/null values (but keep empty strings for now to debug)
        Object.keys(customerData).forEach(key => {
          if (customerData[key] === undefined || customerData[key] === null) {
            delete customerData[key];
          }
        });
        
        console.log('[checkout] Customer data prepared:', JSON.stringify(customerData, null, 2));
        // Pre-check: Don't create account if user is already logged in with this email
        const email = customerData.email?.toLowerCase().trim();
        if (email) {
          const authenticatedEmail = state.authenticatedEmail || 
            (typeof window.getTokenMetadata === 'function' && window.getTokenMetadata()?.email);
          if (authenticatedEmail && authenticatedEmail.toLowerCase() === email) {
            console.log('[checkout] User already logged in with this email, skipping account creation');
            const metadata = getTokenMetadata();
            customerId = metadata?.username || metadata?.userName || state.customerId;
            if (customerId) {
              state.customerId = String(customerId);
            }
            // Skip account creation and proceed
          } else {
            // Check if email was already used to create an account
            if (state.createdEmails.has(email)) {
              throw new Error('An account with this email address has already been created. Please log in instead.');
            }
            
            // Check localStorage
            try {
              const storedEmails = JSON.parse(localStorage.getItem('boulders_created_emails') || '[]');
              if (storedEmails.includes(email)) {
                throw new Error('An account with this email address already exists. Please log in instead.');
              }
            } catch (e) {
              console.warn('[checkout] Could not check localStorage:', e);
            }
            
            // Note: We don't check via login because the API returns INVALID_CREDENTIALS 
            // for both "account doesn't exist" and "wrong password" for security reasons.
            // We rely on:
            // 1. Session tracking (state.createdEmails)
            // 2. localStorage tracking
            // 3. API duplicate detection (which will catch it during account creation)
            console.log('[checkout] Proceeding with account creation. Duplicate detection will be handled by API.');
            
            customer = await authAPI.createCustomer(customerData);
            
            // Track this email as used
            state.createdEmails.add(email);
            try {
              const storedEmails = JSON.parse(localStorage.getItem('boulders_created_emails') || '[]');
              if (!storedEmails.includes(email)) {
                storedEmails.push(email);
                localStorage.setItem('boulders_created_emails', JSON.stringify(storedEmails));
              }
            } catch (e) {
              console.warn('[checkout] Could not store email in localStorage:', e);
            }
          }
        } else {
          customer = await authAPI.createCustomer(customerData);
        }
        
        // Extract customer ID from response - API returns {success: true, data: {id: ...}}
        if (customer) {
          customerId = customer?.data?.id || customer?.id || customer?.customerId || customer?.data?.customerId;
        }
        // Store customer ID in state for later use (e.g., in order summary)
        state.customerId = customerId;
        // Store customer data in sessionStorage for payment return
        try {
          sessionStorage.setItem('boulders_checkout_customer', JSON.stringify({
            id: customerId,
            firstName: payload.customer?.firstName,
            lastName: payload.customer?.lastName,
            email: payload.customer?.email,
            primaryGym: payload.customer?.primaryGym,
          }));
        } catch (e) {
          console.warn('[checkout] Could not save customer to sessionStorage:', e);
        }
        console.log('[checkout] Customer response:', customer);
        console.log('[checkout] Extracted customer ID:', customerId);
        
        // Save tokens if provided in customer creation response
        let hasTokens = false;
        if (customer?.accessToken && customer?.refreshToken) {
          if (typeof window.saveTokens === 'function') {
            const metadata = {
              username: customer?.username || customerEmail,
              email: customerEmail,
              roles: customer?.roles,
            };
            window.saveTokens(customer.accessToken, customer.refreshToken, undefined, metadata);
            syncAuthenticatedCustomerState(metadata.username, metadata.email);
            hasTokens = true;
            console.log('[checkout] ✅ Tokens saved from customer creation response');
            
            // Dispatch event to notify React components
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('auth-state-changed'));
            }
          }
        } else if (customer?.data?.accessToken && customer?.data?.refreshToken) {
          // Check if tokens are nested in data object
          if (typeof window.saveTokens === 'function') {
            const metadata = {
              username: customer?.data?.username || customerEmail,
              email: customerEmail,
              roles: customer?.data?.roles,
            };
            window.saveTokens(customer.data.accessToken, customer.data.refreshToken, undefined, metadata);
            syncAuthenticatedCustomerState(metadata.username, metadata.email);
            hasTokens = true;
            console.log('[checkout] ✅ Tokens saved from customer creation response (nested in data)');
            
            // Dispatch event to notify React components
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('auth-state-changed'));
            }
          }
        }
        
        // Check if we already have valid tokens before attempting login
        const existingAccessToken = typeof window.getAccessToken === 'function' ? window.getAccessToken() : null;
        const existingRefreshToken = typeof window.getRefreshToken === 'function' ? window.getRefreshToken() : null;
        const isTokenExpired = typeof window.isTokenExpired === 'function' ? window.isTokenExpired() : false;
        const hasValidTokens = existingAccessToken && existingRefreshToken && !isTokenExpired;
        
        // If no tokens from customer creation, try to use existing tokens or login
        if (!hasTokens && payload.customer?.email && payload.customer?.password) {
          if (hasValidTokens) {
            console.log('[checkout] Using existing valid authentication tokens (skipping login to avoid rate limits)');
            // Tokens already exist and are valid, no need to login again
          } else if (existingAccessToken && existingRefreshToken && isTokenExpired) {
            console.log('[checkout] Existing tokens expired, attempting to refresh...');
            try {
              await authAPI.refreshToken();
              console.log('[checkout] ✅ Token refreshed successfully');
            } catch (refreshError) {
              console.warn('[checkout] ⚠️ Token refresh failed, will attempt login:', refreshError);
              // Fall through to login attempt
            }
          }
          
          // Only attempt login if we don't have valid tokens
          if (!hasValidTokens && (!existingAccessToken || !existingRefreshToken || isTokenExpired)) {
            console.log('[checkout] No tokens available, attempting login...');
            try {
              const loginResponse = await authAPI.login(payload.customer.email, payload.customer.password);
              
              // Save tokens from login response (handle nested data structure)
              const loginPayload = loginResponse?.data ?? loginResponse;
              const loginAccessToken = loginPayload?.accessToken || loginPayload?.access_token;
              const loginRefreshToken = loginPayload?.refreshToken || loginPayload?.refresh_token;
              let loginExpiresAt = loginPayload?.expiresAt || loginPayload?.expires_at;
              const loginExpiresIn = loginPayload?.expiresIn || loginPayload?.expires_in;
              if (!loginExpiresAt && loginExpiresIn) {
                const expiresInMs = Number(loginExpiresIn) * 1000;
                loginExpiresAt = Date.now() + (Number.isFinite(expiresInMs) ? expiresInMs : 0);
              }
              
              if (loginAccessToken && loginRefreshToken && typeof window.saveTokens === 'function') {
                const loginMetadata = {
                  username: loginPayload?.username || payload.customer?.email,
                  email: loginPayload?.email || payload.customer?.email,
                  roles: loginPayload?.roles,
                  tokenType: loginPayload?.tokenType || loginPayload?.token_type,
                  expiresIn: loginPayload?.expiresIn || loginPayload?.expires_in,
                };
                window.saveTokens(loginAccessToken, loginRefreshToken, loginExpiresAt, loginMetadata);
                syncAuthenticatedCustomerState(loginMetadata.username, loginMetadata.email);
                console.log('[checkout] ✅ Login successful, tokens saved from login response');
              } else {
                console.warn('[checkout] ⚠️ Login succeeded but no tokens found in response');
              }
            } catch (loginError) {
              // Handle rate limit errors specifically
              const errorMessage = loginError.message || String(loginError);
              if (errorMessage.includes('429') || errorMessage.includes('Rate limit') || errorMessage.includes('Too many requests')) {
                // Extract retryAfter from error message (it's in seconds)
                let retryAfterSeconds = 60; // Default 1 minute (60 seconds) - more reasonable
                const retryAfterMatch = errorMessage.match(/retryAfter["\s:]*(\d+)/i);
                if (retryAfterMatch) {
                  retryAfterSeconds = parseInt(retryAfterMatch[1], 10);
                  // Cap at 2 minutes (120 seconds) for better UX - API might say 15 minutes but that's too long
                  retryAfterSeconds = Math.min(retryAfterSeconds, 120);
                }
                
                const retryMinutes = Math.ceil(retryAfterSeconds / 60);
                const retrySeconds = retryAfterSeconds % 60;
                const retryMessage = retryMinutes > 0 
                  ? `${retryMinutes} minute${retryMinutes !== 1 ? 's' : ''}${retrySeconds > 0 ? ` and ${retrySeconds} second${retrySeconds !== 1 ? 's' : ''}` : ''}`
                  : `${retryAfterSeconds} second${retryAfterSeconds !== 1 ? 's' : ''}`;
                
                console.error(`[checkout] ⚠️ Rate limit exceeded. Please wait ${retryMessage} before trying again.`);
                showToast(`Rate limit exceeded. Please wait ${retryMessage} before trying again.`, 'error');
                
                // If we have existing tokens, try to use them
                if (existingAccessToken && existingRefreshToken) {
                  console.log('[checkout] Attempting to use existing tokens despite rate limit...');
                  // Tokens might still be valid, continue with checkout
                } else {
                  setCheckoutLoadingState(false);
                  state.checkoutInProgress = false;
                  throw new Error(`Rate limit exceeded. Please wait ${retryMessage} before trying again.`);
                }
              } else {
                console.warn('[checkout] ⚠️ Login after customer creation failed:', loginError);
                // If we have existing tokens, try to use them
                if (existingAccessToken && existingRefreshToken) {
                  console.log('[checkout] Login failed but existing tokens available, continuing with checkout...');
                } else {
                  console.warn('[checkout] Payment link generation might fail without authentication token');
                }
              }
            }
          }
        }
        
        console.log('[checkout] Customer created:', customerId);
        try {
          await ensureOrderCreated('profile-create');
          await ensureSubscriptionAttached('profile-create');
        } catch (orderError) {
          console.warn('[checkout] Could not auto-attach membership after profile creation:', orderError);
        }
      } catch (error) {
        console.error('[checkout] Customer creation failed:', error);
        
        // Handle duplicate email error specifically
        if (error.isDuplicateEmail || (error.message && error.message.includes('already exists'))) {
          const email = payload.customer?.email?.trim() || '';
          const duplicateMessage = `An account with this email address${email ? ` (${email})` : ''} already exists. Please log in instead.`;
          showToast(duplicateMessage, 'error');
          
          // Highlight the email field
          const emailInput = document.getElementById('email');
          if (emailInput) {
            emailInput.closest('.form-group')?.classList.add('error');
          }
          
          // Switch to login view and populate email field
          if (email) {
            switchAuthMode('login', email);
          } else {
            switchAuthMode('login');
          }
          
          setCheckoutLoadingState(false);
          state.checkoutInProgress = false;
          return;
        }
        
        showToast(getErrorMessage(error, 'Customer creation'), 'error');
        setCheckoutLoadingState(false);
        state.checkoutInProgress = false;
        return;
      }
    } else {
      // User is logged in, get customer ID from token or state
      // For now, we'll proceed with order creation
      console.log('[checkout] User is authenticated');
    }

    // Step 2: Ensure order exists (create if needed)
    try {
      console.log('[checkout] Ensuring order exists before adding items...');
      const ensuredOrderId = await ensureOrderCreated('checkout-flow');
      if (!ensuredOrderId) {
        throw new Error('Order ID missing after ensureOrderCreated');
      }
      state.orderId = ensuredOrderId;
      
      // Store order and cart data in sessionStorage for payment return
      try {
        sessionStorage.setItem('boulders_checkout_order', JSON.stringify({
          orderId: state.orderId,
          membershipPlanId: state.membershipPlanId,
          cartItems: state.cartItems || [],
          totals: state.totals,
          selectedBusinessUnit: state.selectedBusinessUnit, // Store for primaryGym lookup
          selectedProductType: state.selectedProductType, // Store product type for restoration
          selectedProductId: state.selectedProductId, // Store product ID for restoration
        }));
      } catch (e) {
        console.warn('[checkout] Could not save order to sessionStorage:', e);
      }
    } catch (error) {
      console.error('[checkout] Order creation failed:', error);
      showToast(getErrorMessage(error, 'Order creation'), 'error');
      setCheckoutLoadingState(false);
      state.checkoutInProgress = false;
      return;
    }

    // Step 3: Add items to order and generate payment link
    // Backend requirement: Generate Payment Link Card immediately after subscription is added to cart
    let paymentLink = null;
    
    try {
      console.log('[checkout] Adding items to order...');
      
      // Check if this is a membership (not a punch card)
      // Punch cards have membershipPlanId like "punch-43" but selectedProductType is "punch-card"
      const isMembership = state.membershipPlanId && 
        (state.selectedProductType === 'membership' || 
         (typeof state.membershipPlanId === 'string' && state.membershipPlanId.startsWith('membership-')));
      
      // Add membership/subscription FIRST (only if it's actually a membership)
      if (isMembership) {
	        try {
	          await ensureSubscriptionAttached('checkout-flow');
	          console.log('[checkout] Membership ensured on order');
	          
	          // Ensure payment overview is updated after subscription is attached
	          // ensureSubscriptionAttached already fetches order and calls updatePaymentOverview(),
	          // but let's make sure it's called here too
	          if (state.order) {
	            updatePaymentOverview();
	          }
          
          // CRITICAL: Apply coupon BEFORE generating payment link
          // This ensures the payment portal shows the discounted price
          const discountCodeToApply = (DOM.discountInput && DOM.discountInput.value.trim()) 
            ? DOM.discountInput.value.trim().toUpperCase()
            : state.discountCode;
          
          // Apply discount if we have a code and an order, even if already marked as applied
          // We need to ensure it's actually on the order before generating payment link
          if (discountCodeToApply && state.orderId) {
            try {
              // First, check if discount is already on the order
              console.log('[checkout] ===== CHECKING/APPLYING COUPON BEFORE PAYMENT LINK =====');
              console.log('[checkout] Coupon code:', discountCodeToApply);
              console.log('[checkout] Order ID:', state.orderId);
              console.log('[checkout] Current state - discountApplied:', state.discountApplied, 'discountAmount:', state.totals.discountAmount);
              
              // Check current order state first
              let orderCheck = null;
              try {
                orderCheck = await orderAPI.getOrder(state.orderId);
                
                // Store full order object for payment overview
                state.fullOrder = orderCheck;
                updatePaymentOverview();
                
                const existingCouponDiscount = orderCheck?.couponDiscount || orderCheck?.price?.couponDiscount;
                if (existingCouponDiscount) {
                  console.log('[checkout] ✅ Discount already exists on order, verifying amount...');
                  // Discount already exists, verify it matches our expected amount
                  let existingDiscountAmount = 0;
                  if (typeof existingCouponDiscount === 'object') {
                    existingDiscountAmount = existingCouponDiscount.amount || existingCouponDiscount.value || existingCouponDiscount.discount || 0;
                    if (existingDiscountAmount > 10000) existingDiscountAmount = existingDiscountAmount / 100;
                  } else if (typeof existingCouponDiscount === 'number') {
                    existingDiscountAmount = existingCouponDiscount;
                    if (existingDiscountAmount > 10000) existingDiscountAmount = existingDiscountAmount / 100;
                  }
                  
                  // Use the discount amount from the order if it exists
                  // Also get the actual order total to ensure we have the correct price
                  let orderTotalFromAPI = 0;
                  const orderPrice = orderCheck?.price;
                  if (orderPrice) {
                    orderTotalFromAPI = orderPrice.total?.amount || orderPrice.total || orderPrice.leftToPay?.amount || orderPrice.leftToPay || 0;
                    if (orderTotalFromAPI > 10000) orderTotalFromAPI = orderTotalFromAPI / 100;
                  }
                  
                  if (existingDiscountAmount > 0 || orderTotalFromAPI > 0) {
                    console.log('[checkout] Using existing discount amount from order:', existingDiscountAmount);
                    console.log('[checkout] Order total from API:', orderTotalFromAPI);
                    state.discountCode = discountCodeToApply;
                    state.discountApplied = true;
                    state.totals.discountAmount = existingDiscountAmount;
                    // Update cart total to match order total from API if available
                    if (orderTotalFromAPI > 0) {
                      state.totals.cartTotal = orderTotalFromAPI;
                      console.log('[checkout] Updated cart total to match order total from API:', orderTotalFromAPI);
                    }
                    updateCartSummary();
                    // Skip applying discount again - it's already on the order
                    // Continue to payment link generation
                    console.log('[checkout] ✅ Discount verified on order, proceeding to payment link');
                  }
                }
              } catch (checkError) {
                console.warn('[checkout] Could not check order before applying discount:', checkError);
              }
              
              // Only apply discount if it's not already on the order
              if (!orderCheck || !(orderCheck?.couponDiscount || orderCheck?.price?.couponDiscount)) {
                console.log('[checkout] Discount not found on order, applying now...');
                const discountResponse = await orderAPI.applyDiscountCode(state.orderId, discountCodeToApply);
                console.log('[checkout] Coupon API response:', JSON.stringify(discountResponse, null, 2));
              
                // Extract discount from couponDiscount field
                const couponDiscount = discountResponse?.couponDiscount || discountResponse?.price?.couponDiscount;
                let discountAmount = 0;
              
              if (couponDiscount) {
                if (typeof couponDiscount === 'object') {
                  discountAmount = couponDiscount.amount || couponDiscount.value || couponDiscount.discount || 0;
                  if (discountAmount > 10000) discountAmount = discountAmount / 100;
                } else if (typeof couponDiscount === 'number') {
                  discountAmount = couponDiscount;
                  if (discountAmount > 10000) discountAmount = discountAmount / 100;
                }
              }
              
              if (!discountAmount && discountResponse?.discountAmount) {
                discountAmount = discountResponse.discountAmount;
                if (discountAmount > 10000) discountAmount = discountAmount / 100;
              }
              
              // Calculate from price difference if needed
              if (!discountAmount && discountResponse?.price) {
                const originalTotal = state.totals.subtotal || state.totals.cartTotal || 0;
                let newTotal = discountResponse.price.total || discountResponse.price.leftToPay || 0;
                if (newTotal > 10000) newTotal = newTotal / 100;
                if (newTotal < originalTotal && originalTotal > 0) {
                  discountAmount = originalTotal - newTotal;
                }
              }
              
              // Cap discount at subtotal
              const subtotal = state.totals.subtotal || state.totals.cartTotal || 0;
              if (discountAmount > subtotal && subtotal > 0) {
                discountAmount = subtotal;
              }
              
              if (discountAmount > 0) {
                state.discountCode = discountCodeToApply;
                state.discountApplied = true;
                state.totals.discountAmount = roundToHalfKrone(discountAmount);
                updateCartSummary(); // Use API-based cart update function
                console.log('[checkout] ✅ Coupon applied before payment link:', discountCodeToApply, 'Amount:', discountAmount);
                
                // CRITICAL: Fetch updated order multiple times to ensure backend has processed the coupon
                // Payment link generation reads order total from the order, so we need to ensure it's updated
                let orderUpdated = false;
                let attempts = 0;
                const maxAttempts = 5;
                
                  // Ensure subtotal is calculated before checking order
                  if (!state.totals.subtotal || state.totals.subtotal === 0) {
                    updateCartSummary(); // Use API-based cart update function
                  }
                  
                  while (!orderUpdated && attempts < maxAttempts) {
                  attempts++;
                  try {
                    console.log(`[checkout] Fetching updated order (attempt ${attempts}/${maxAttempts}) to verify discount...`);
                    const updatedOrder = await orderAPI.getOrder(state.orderId);
                    
                    console.log('[checkout] Full order response:', JSON.stringify(updatedOrder, null, 2));
                    
                    // Store full order object for payment overview
                    state.fullOrder = updatedOrder;
                    updatePaymentOverview();
                    
                    // Check if order has the discount applied
                    const orderCouponDiscount = updatedOrder?.couponDiscount || updatedOrder?.price?.couponDiscount;
                    
                    // Try multiple ways to get order total
                    let orderTotal = updatedOrder?.price?.total?.amount || updatedOrder?.price?.total;
                    if (!orderTotal) orderTotal = updatedOrder?.price?.leftToPay?.amount || updatedOrder?.price?.leftToPay;
                    if (!orderTotal) orderTotal = updatedOrder?.total?.amount || updatedOrder?.total;
                    if (!orderTotal) orderTotal = updatedOrder?.price?.amount;
                    
                    // Convert to DKK if in cents (or if it's an object with amount property)
                    let orderTotalDKK = 0;
                    if (orderTotal) {
                      if (typeof orderTotal === 'object' && orderTotal.amount) {
                        orderTotalDKK = orderTotal.amount;
                      } else if (typeof orderTotal === 'number') {
                        orderTotalDKK = orderTotal;
                      }
                      // Convert from cents if needed
                      if (orderTotalDKK > 10000) {
                        orderTotalDKK = orderTotalDKK / 100;
                      }
                    }
                    
                    const subtotal = state.totals.subtotal || state.totals.cartTotal || 0;
                    const expectedTotal = Math.max(0, subtotal - discountAmount);
                    
                    console.log('[checkout] Order state:', {
                      orderCouponDiscount,
                      orderTotalRaw: orderTotal,
                      orderTotalDKK,
                      expectedTotal,
                      subtotal,
                      discountAmount,
                      hasCouponDiscount: !!orderCouponDiscount,
                    });
                    
                    // Verify discount is reflected - check if couponDiscount exists OR order total matches expected
                    if (orderCouponDiscount) {
                      // Coupon discount exists in order
                      orderUpdated = true;
                      console.log('[checkout] ✅ Order has couponDiscount, proceeding to payment link generation');
                    } else if (orderTotalDKK > 0 && Math.abs(orderTotalDKK - expectedTotal) < 1) {
                      // Order total matches expected discounted total
                      orderUpdated = true;
                      console.log('[checkout] ✅ Order total matches expected discounted total, proceeding to payment link generation');
                    } else if (orderTotalDKK === 0 && expectedTotal === 0) {
                      // Both are zero (100% discount)
                      orderUpdated = true;
                      console.log('[checkout] ✅ Order total is zero (100% discount), proceeding to payment link generation');
                    } else {
                      console.log('[checkout] Order not yet updated, waiting... (orderTotal:', orderTotalDKK, 'expected:', expectedTotal, ')');
                      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
                    }
                  } catch (fetchError) {
                    console.warn(`[checkout] Could not fetch updated order (attempt ${attempts}):`, fetchError);
                    if (attempts < maxAttempts) {
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                  }
                }
                
                if (!orderUpdated) {
                  console.warn('[checkout] ⚠️ Order may not be fully updated with discount, but proceeding with payment link generation');
                }
              } // End of if (discountAmount > 0)
            } // End of if (!orderCheck || !(orderCheck?.couponDiscount || orderCheck?.price?.couponDiscount))
            } catch (couponError) {
              console.warn('[checkout] Failed to apply coupon before payment link:', couponError);
              // Don't block checkout if coupon fails, but log warning
              console.warn('[checkout] Payment link may not reflect discount if coupon application failed');
            }
          } else if (discountCodeToApply && state.discountApplied) {
            // Discount code is stored and marked as applied, but verify it's actually on the order
            try {
              console.log('[checkout] Verifying discount is on order before payment link generation...');
              const orderCheck = await orderAPI.getOrder(state.orderId);
              const orderCouponDiscount = orderCheck?.couponDiscount || orderCheck?.price?.couponDiscount;
              
              if (!orderCouponDiscount) {
                console.warn('[checkout] Discount code marked as applied but not found on order, re-applying...');
                // Re-apply the discount
                const discountResponse = await orderAPI.applyDiscountCode(state.orderId, discountCodeToApply);
                console.log('[checkout] Re-applied discount, response:', JSON.stringify(discountResponse, null, 2));
              } else {
                console.log('[checkout] ✅ Discount confirmed on order before payment link generation');
              }
            } catch (verifyError) {
              console.warn('[checkout] Could not verify discount on order:', verifyError);
            }
          }
          
          // CRITICAL: Generate Payment Link Card immediately after subscription is added AND coupon is applied
          // The order should now have the discount applied, so payment link will show discounted price
          // Backend requirement: "Generate Payment Link Card" request must be made when subscription is added to cart
          // This is what triggers the payment flow according to backend team
          console.log('[checkout] ===== GENERATE PAYMENT LINK CARD =====');
          console.log('[checkout] Generating Payment Link Card (backend requirement)');
          console.log('[checkout] Order ID:', state.orderId);
          console.log('[checkout] Payment Method:', state.paymentMethod);
          console.log('[checkout] Business Unit:', state.selectedBusinessUnit);
          
          const baseUrl = getReturnUrlBase();
          const returnUrl = `${baseUrl}${window.location.pathname}?payment=return&orderId=${state.orderId}`;
          console.log('[checkout] Return URL:', returnUrl);
          
          // API Documentation: POST /api/payment/generate-link
          // Payload: { orderId, paymentMethodId, businessUnit, returnUrl }
          if (!state.orderId) {
            throw new Error('Order ID is required to generate payment link');
          }
          
          // CRITICAL: Final verification and fix of order price before payment link generation
          // The payment link API reads order.price.amount from backend, so we MUST ensure it's correct
          // This is our last chance to fix backend pricing bugs before payment window shows wrong price
          try {
            console.log('[checkout] ===== FINAL ORDER PRICE VERIFICATION BEFORE PAYMENT LINK =====');
            // Wait a bit to ensure backend has fully processed everything
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            let orderBeforePayment = await orderAPI.getOrder(state.orderId);
            console.log('[checkout] Initial order fetch:', {
              orderId: orderBeforePayment?.id,
              orderPrice: orderBeforePayment?.price?.amount,
              orderPriceDKK: orderBeforePayment?.price?.amount ? orderBeforePayment.price.amount / 100 : null,
              hasSubscriptionItems: !!orderBeforePayment?.subscriptionItems?.length
            });
            
            // Verify pricing is correct for subscription items
            const subscriptionItem = orderBeforePayment?.subscriptionItems?.[0];
            if (subscriptionItem) {
              const product = subscriptionItem?.product;
              const productId = product?.id || state.selectedProductId;
              const productName = product?.name || '';
              const productLabels = product?.productLabels || product?.labels || [];
              const has15DayPassLabel = Array.isArray(productLabels) && productLabels.some(
                label => label?.name && label.name.toLowerCase() === '15 day pass'
              );
              const is15DayPass =
                state.selectedProductType === '15daypass' ||
                has15DayPassLabel ||
                (productName && (
                  productName.toLowerCase().includes('15 day pass') ||
                  productName.toLowerCase().includes('15 dages')
                )) ||
                (state.membershipPlanId && String(state.membershipPlanId).startsWith('15daypass-'));

              if (is15DayPass) {
                console.log('[checkout] ✅ Skipping partial-month price verification for 15 day pass');
              } else {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const startDateStr = today.toISOString().split('T')[0];
                const expectedPrice = orderAPI._calculateExpectedPartialMonthPrice(productId, startDateStr);
              
              // Use robust verification method
                const verification = orderAPI._verifySubscriptionPricing(
                  orderBeforePayment,
                  productId,
                  expectedPrice,
                  today
                );
              
                console.log('[checkout] Price verification result:', {
                  isCorrect: verification.isCorrect,
                  startDateCorrect: verification.startDateCorrect,
                  priceCorrect: verification.priceCorrect,
                  daysUntilStart: verification.daysUntilStart,
                  orderPriceDKK: verification.orderPriceDKK,
                  expectedPriceDKK: verification.expectedPriceDKK,
                  productId: productId
                });
              
              // If pricing is incorrect, try to fix it (only if we have permission)
                if (!verification.isCorrect && subscriptionItem.id && (!verification.priceDifference || verification.priceDifference > 100)) {
                  console.warn('[checkout] ⚠️ ORDER PRICE IS INCORRECT BEFORE PAYMENT LINK GENERATION!');
                  console.warn('[checkout] ⚠️ Backend shows:', verification.orderPriceDKK, 'DKK');
                  console.warn('[checkout] ⚠️ Expected:', verification.expectedPriceDKK || 'N/A', 'DKK');
                  console.warn('[checkout] ⚠️ Attempting to fix by deleting and re-adding subscription...');
                  console.warn('[checkout] ⚠️ NOTE: This may fail with 403 if order is in a state that prevents modification');
                
                // Try to fix with multiple strategies
                // Build URL for subscription endpoint
                let subscriptionUrl;
                if (orderAPI.useProxy) {
                  subscriptionUrl = `${orderAPI.baseUrl}?path=/api/ver3/orders/${state.orderId}/items/subscriptions`;
                } else {
                  subscriptionUrl = `https://boulders.brpsystems.com/apiserver/api/ver3/orders/${state.orderId}/items/subscriptions`;
                }
                
                  const fixedOrder = await orderAPI._fixBackendPricingBug(
                    state.orderId,
                    subscriptionUrl,
                    {
                      'Accept-Language': getAcceptLanguageHeader(),
                      'Content-Type': 'application/json',
                      ...(typeof window.getAccessToken === 'function' && window.getAccessToken() 
                        ? { 'Authorization': `Bearer ${window.getAccessToken()}` } 
                        : {}),
                    },
                    subscriptionItem.id,
                    {
                      subscriptionProduct: productId,
                      startDate: startDateStr,
                      ...(state.customerId ? { subscriber: Number(state.customerId) } : {}),
                      ...(getSubscriberBirthDate() ? { birthDate: getSubscriberBirthDate() } : {}),
                    },
                    productId,
                    expectedPrice,
                    typeof window.getAccessToken === 'function' ? window.getAccessToken() : null,
                    today
                  );
                
                  if (fixedOrder) {
                    // Verify the fix worked
                    const fixedVerification = orderAPI._verifySubscriptionPricing(
                      fixedOrder,
                      productId,
                      expectedPrice,
                      today
                    );
                    
                    if (fixedVerification.isCorrect) {
                      console.log('[checkout] ✅ Successfully fixed order price before payment link generation!');
                      orderBeforePayment = fixedOrder;
                    } else {
                      console.error('[checkout] ❌ Fix attempt failed - price still incorrect');
                      console.error('[checkout] ❌ This is a backend bug - payment window will show incorrect price');
                      console.error('[checkout] ❌ UI shows correct calculated price:', verification.expectedPriceDKK, 'DKK');
                      console.error('[checkout] ❌ Payment window will show backend price:', verification.orderPriceDKK, 'DKK');
                    }
                    } else {
                    console.error('[checkout] ❌ All fix strategies failed - cannot modify order (likely 403 Forbidden)');
                    console.error('[checkout] ❌ This is a backend bug - backend ignored startDate parameter');
                    console.error('[checkout] ❌ UI shows correct calculated price:', verification.expectedPriceDKK, 'DKK');
                    console.error('[checkout] ❌ Payment window will show backend price:', verification.orderPriceDKK, 'DKK');
                    console.error('[checkout] ❌ Backend needs to be fixed to respect startDate parameter for productId:', productId);
                  }
                } else if (verification.isCorrect || (verification.priceDifference !== null && verification.priceDifference <= 100)) {
                  console.log('[checkout] ✅ Order price is acceptable - no fix needed');
                }
              }
            }
            
            // Store full order object for payment overview
            state.fullOrder = orderBeforePayment;
            
            // CRITICAL: Log the exact price that will be sent to payment window
            const finalOrderPrice = orderBeforePayment?.price?.amount || 0;
            const finalOrderPriceDKK = typeof finalOrderPrice === 'object' 
              ? finalOrderPrice.amount / 100 
              : finalOrderPrice / 100;
            
            console.log('[checkout] 🔍 FINAL PRICE THAT WILL BE SENT TO PAYMENT WINDOW:', finalOrderPrice, '(in cents) =', finalOrderPriceDKK, 'DKK');
            console.log('[checkout] This is order.price.amount from backend - payment link API will use this exact value');
            
            // Update payment overview with final order data
            updatePaymentOverview();
            
            // Verify coupon discount is present
            const orderCouponDiscount = orderBeforePayment?.couponDiscount || orderBeforePayment?.price?.couponDiscount;
            if (orderCouponDiscount) {
              console.log('[checkout] ✅ Order has couponDiscount, payment link should reflect discount');
            } else {
              console.warn('[checkout] ⚠️ Order does not have couponDiscount - payment link may not reflect discount');
            }
            
            // Log comprehensive price information for debugging
            console.log('[checkout] Final order price summary:', {
              orderId: orderBeforePayment?.id,
              orderPriceAmount: finalOrderPrice,
              orderPriceDKK: finalOrderPriceDKK,
              hasPrice: !!orderBeforePayment?.price,
              priceKeys: orderBeforePayment?.price ? Object.keys(orderBeforePayment.price) : [],
              couponDiscount: orderCouponDiscount,
              subscriptionItemPrice: subscriptionItem?.price?.amount,
              recurringPrice: subscriptionItem?.payRecurring?.price?.amount,
              initialPaymentPeriod: subscriptionItem?.initialPaymentPeriod,
            });
          } catch (orderCheckError) {
            console.error('[checkout] ❌ Error during final order verification:', orderCheckError);
            console.warn('[checkout] ⚠️ Continuing with payment link generation - price may be incorrect');
            // Try to get order anyway for payment overview
            try {
              const fallbackOrder = await orderAPI.getOrder(state.orderId);
              state.fullOrder = fallbackOrder;
              updatePaymentOverview();
            } catch (fallbackError) {
              console.error('[checkout] Could not fetch order for payment overview:', fallbackError);
            }
          }
          
          const paymentData = await paymentAPI.generatePaymentLink({
            orderId: state.orderId,
            paymentMethod: state.paymentMethod,
            businessUnit: state.selectedBusinessUnit,
            returnUrl,
            receiptEmail: customerEmail,
          });
          
          // Extract payment link from response - API returns {success: true, data: {paymentLink: ...}}
          // Log full response for debugging
          console.log('[checkout] Full payment link API response:', JSON.stringify(paymentData, null, 2));
          
          // CRITICAL: Log the price that was sent to payment window
          // Check if payment response contains price information
          const paymentPrice = paymentData?.data?.amount || paymentData?.data?.price || paymentData?.amount || paymentData?.price;
          const currentPayNowDisplay = DOM.payNow?.textContent || 'N/A';
          console.log('[checkout] 🔍 Payment link generated');
          console.log('[checkout] 🔍 Price in payment response:', paymentPrice);
          console.log('[checkout] 🔍 "Betales nu" display:', currentPayNowDisplay);
          console.log('[checkout] 🔍 Order price (state.fullOrder.price.amount):', state.fullOrder?.price?.amount || 'N/A');
          
          paymentLink = paymentData?.data?.paymentLink || 
                        paymentData?.data?.link || 
                        paymentData?.data?.url ||
                        paymentData?.paymentLink || 
                        paymentData?.link || 
                        paymentData?.url;
          
          // Additional checks for nested structures
          if (!paymentLink && paymentData?.data) {
            // Try to find any URL-like field in the data object
            const dataKeys = Object.keys(paymentData.data);
            console.log('[checkout] Available keys in paymentData.data:', dataKeys);
            for (const key of dataKeys) {
              const value = paymentData.data[key];
              if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
                paymentLink = value;
                console.log('[checkout] Found URL in paymentData.data.' + key + ':', paymentLink);
                break;
              }
            }
          }
          
          state.paymentLink = paymentLink;
          state.paymentLinkGenerated = true;
          
          console.log('[checkout] Payment link extracted:', paymentLink);
          console.log('[checkout] Payment link type:', typeof paymentLink);
          console.log('[checkout] Payment link is valid URL:', paymentLink ? (paymentLink.startsWith('http://') || paymentLink.startsWith('https://')) : 'null/undefined');
          
          if (!paymentLink) {
            console.error('[checkout] ⚠️ Payment link is null/undefined!');
            console.error('[checkout] Payment API response structure:', {
              hasData: !!paymentData?.data,
              dataKeys: paymentData?.data ? Object.keys(paymentData.data) : [],
              topLevelKeys: Object.keys(paymentData || {}),
            });
          }
        } catch (error) {
          console.error('[checkout] Failed to add membership or generate payment link:', error);
          
          // Check if this is a PRODUCT_NOT_ALLOWED error (campaign eligibility restriction)
          const isProductNotAllowed = error.isProductNotAllowed || 
                                      (error.message && error.message.includes('PRODUCT_NOT_ALLOWED'));
          
          if (isProductNotAllowed) {
            // Show friendly message that this is a restriction, not an error
            showToast('This offer is not available for your account. This may be due to existing subscriptions or campaign eligibility rules.', 'info');
            throw error; // Re-throw to stop checkout flow
          }
          
          // Check if this is a payment link generation error due to backend pricing bug
          const isPaymentLinkError = error.message && error.message.includes('Generate Payment Link Card failed');
          const is403Error = error.message && error.message.includes('403');
          
          if (isPaymentLinkError && is403Error) {
            // Check if order has incorrect pricing
            const subscriptionItem = state.fullOrder?.subscriptionItems?.[0];
            if (subscriptionItem) {
              const productId = subscriptionItem?.product?.id;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const startDateStr = today.toISOString().split('T')[0];
              const expectedPrice = orderAPI._calculateExpectedPartialMonthPrice(productId, startDateStr);
              const verification = orderAPI._verifySubscriptionPricing(state.fullOrder, productId, expectedPrice, today);
              
              if (!verification.isCorrect && (!verification.priceDifference || verification.priceDifference > 100)) {
                console.error('[checkout] ❌ PAYMENT LINK GENERATION FAILED DUE TO BACKEND PRICING BUG');
                console.error('[checkout] ❌ Order has incorrect pricing - backend ignored startDate parameter');
                console.error('[checkout] ❌ This is a backend issue that needs to be fixed on backend side');
                console.error('[checkout] ❌ Product ID:', productId);
                console.error('[checkout] ❌ Backend price:', verification.orderPriceDKK, 'DKK');
                console.error('[checkout] ❌ Expected price:', verification.expectedPriceDKK || 'N/A', 'DKK');
                
                // Show user-friendly error message
                showToast(
                  'Der opstod et problem med betalingslinket på grund af en backend-fejl. Kontakt support hvis problemet fortsætter.',
                  'error'
                );
                
                throw new Error(`Payment link generation failed due to backend pricing bug. Order price: ${verification.orderPriceDKK} DKK, Expected: ${verification.expectedPriceDKK || 'N/A'} DKK. Product ID: ${productId}. Backend ignored startDate parameter.`);
              }
            }
          }
          
          throw new Error('Failed to add membership to order or generate payment link');
        }
      }
      
      // Add value cards (punch cards) - add FIRST if no membership, or AFTER payment link if membership exists
      // CRITICAL: Check if punch cards are already in the order (e.g., from discount flow) to avoid duplicates
      let valueCardAddFailed = false;
      let valueCardError = null;
      
      if (state.valueCardQuantities && state.valueCardQuantities.size > 0) {
        // Check existing valueCardItems in order to avoid duplicates
        const existingValueCardItems = state.fullOrder?.valueCardItems || [];
        const existingProductIds = new Set(existingValueCardItems.map(item => item.product?.id));
        
        for (const [planId, quantity] of state.valueCardQuantities.entries()) {
          if (quantity > 0) {
            try {
              // Extract numeric product ID from "punch-43" format
              const numericProductId = typeof planId === 'string' && planId.startsWith('punch-')
                ? parseInt(planId.replace('punch-', ''), 10)
                : planId;
              
              // Check if this product is already in the order
              const existingCount = existingValueCardItems.filter(item => item.product?.id === numericProductId).length;
              const neededCount = quantity;
              
              if (existingCount >= neededCount) {
                console.log(`[checkout] ⚠️ Value card ${planId} (productId: ${numericProductId}) already in order (${existingCount} items, need ${neededCount}) - skipping`);
                continue;
              }
              
              // Only add the difference
              const toAdd = neededCount - existingCount;
              console.log(`[checkout] Adding ${toAdd} value card(s) for ${planId} (${existingCount} already in order, need ${neededCount})`);
              
              // API doesn't accept quantity in payload - call API once per quantity needed
              for (let i = 0; i < toAdd; i++) {
                await orderAPI.addValueCardItem(state.orderId, numericProductId, 1);
                console.log(`[checkout] ✅ Value card added: ${planId} (productId: ${numericProductId}) [${existingCount + i + 1}/${neededCount}]`);
              }
            } catch (error) {
              valueCardAddFailed = true;
              valueCardError = error;
              console.error(`[checkout] ❌ Failed to add value card ${planId}:`, error);
              console.error(`[checkout] Error details:`, {
                message: error.message,
                is403: error.message.includes('403') || error.message.includes('Forbidden'),
                is401: error.message.includes('401') || error.message.includes('Unauthorized'),
                orderId: state.orderId,
                productId: numericProductId,
                quantity,
                isMembership
              });
              
              // Don't throw immediately - continue to payment link generation
              // We'll handle the error after payment link is generated
              if (isMembership) {
                console.warn(`[checkout] Continuing despite value card error - payment link already generated`);
              } else {
                console.warn(`[checkout] ⚠️ Value card add failed, but continuing to generate payment link`);
              }
            }
          }
        }
      }
      
      // Add add-ons/articles - can be added after payment link is generated
      if (state.addonIds && state.addonIds.size > 0) {
        for (const addonId of state.addonIds) {
          try {
            await orderAPI.addArticleItem(state.orderId, addonId);
            console.log(`[checkout] Add-on added: ${addonId}`);
          } catch (error) {
            console.error(`[checkout] Failed to add add-on ${addonId}:`, error);
            // Don't throw - payment link is already generated, just log the error
            console.warn(`[checkout] Continuing despite add-on error - payment link already generated`);
          }
        }
      }
      
      // CRITICAL: Generate payment link if it hasn't been generated yet
      // This handles cases where user only selected punch cards or addons (no membership)
      if (!paymentLink && state.orderId) {
        console.log('[checkout] ===== GENERATE PAYMENT LINK (no membership) =====');
        console.log('[checkout] No membership selected, generating payment link for punch cards/addons only');
        console.log('[checkout] Order ID:', state.orderId);
        console.log('[checkout] Payment Method:', state.paymentMethod);
        console.log('[checkout] Business Unit:', state.selectedBusinessUnit);
        console.log('[checkout] Product Type:', state.selectedProductType);
        console.log('[checkout] Membership Plan ID:', state.membershipPlanId);
        console.log('[checkout] Is Membership:', isMembership);
        console.log('[checkout] Has Value Cards:', state.valueCardQuantities?.size > 0);
        console.log('[checkout] Has Addons:', state.addonIds?.size > 0);
        
        try {
          const baseUrl = getReturnUrlBase();
          const returnUrl = `${baseUrl}${window.location.pathname}?payment=return&orderId=${state.orderId}`;
          
          if (!state.orderId) {
            throw new Error('Order ID is required to generate payment link');
          }
          
          const paymentData = await paymentAPI.generatePaymentLink({
            orderId: state.orderId,
            paymentMethod: state.paymentMethod,
            businessUnit: state.selectedBusinessUnit,
            returnUrl,
            receiptEmail: customerEmail,
          });
          
          console.log('[checkout] Full payment link API response:', JSON.stringify(paymentData, null, 2));
          
          paymentLink = paymentData?.data?.paymentLink || 
                        paymentData?.data?.link || 
                        paymentData?.data?.url ||
                        paymentData?.paymentLink || 
                        paymentData?.link || 
                        paymentData?.url;
          
          // Additional checks for nested structures
          if (!paymentLink && paymentData?.data) {
            const dataKeys = Object.keys(paymentData.data);
            console.log('[checkout] Available keys in paymentData.data:', dataKeys);
            for (const key of dataKeys) {
              const value = paymentData.data[key];
              if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
                paymentLink = value;
                console.log('[checkout] Found URL in paymentData.data.' + key + ':', paymentLink);
                break;
              }
            }
          }
          
          state.paymentLink = paymentLink;
          state.paymentLinkGenerated = true;
          
          console.log('[checkout] Payment link extracted:', paymentLink);
          console.log('[checkout] Payment link type:', typeof paymentLink);
          console.log('[checkout] Payment link is valid URL:', paymentLink ? (paymentLink.startsWith('http://') || paymentLink.startsWith('https://')) : 'null/undefined');
          
          if (!paymentLink) {
            console.error('[checkout] ⚠️ Payment link is null/undefined!');
            console.error('[checkout] Payment API response structure:', {
              hasData: !!paymentData?.data,
              dataKeys: paymentData?.data ? Object.keys(paymentData.data) : [],
              topLevelKeys: Object.keys(paymentData || {}),
            });
          }
        } catch (error) {
          console.error('[checkout] Failed to generate payment link for non-membership order:', error);
          throw new Error('Failed to generate payment link');
        }
      }
      
      console.log('[checkout] All items added to order');
      
      // If value card add failed for punch-card-only order, show error but don't block checkout
      if (valueCardAddFailed && !isMembership && valueCardError) {
        console.error(`[checkout] ⚠️ Value card add failed, but payment link was generated`);
        console.error(`[checkout] Error:`, valueCardError.message);
        // Show error toast but don't block checkout
        const errorMsg = valueCardError.message.includes('403') || valueCardError.message.includes('Forbidden')
          ? 'Could not add punch card to order (permission error). Payment link generated anyway.'
          : `Warning: Could not add punch card to order. Payment link generated anyway.`;
        showToast(errorMsg, 'warning');
      }
      
      // Note: Coupon should already be applied BEFORE payment link generation (see above)
      // This is a fallback in case the first attempt failed
      // Skip if coupon was already successfully applied
      if (state.discountApplied) {
        console.log('[checkout] Coupon already applied, skipping duplicate application');
      } else {
        // Fallback: Apply coupon if it wasn't applied before payment link generation
        const discountCodeToApply = (DOM.discountInput && DOM.discountInput.value.trim()) 
          ? DOM.discountInput.value.trim().toUpperCase()
          : state.discountCode;
        
        if (discountCodeToApply && state.orderId) {
          try {
            console.log('[checkout] ===== APPLYING COUPON DURING CHECKOUT =====');
            console.log('[checkout] Coupon code:', discountCodeToApply);
            console.log('[checkout] Order ID:', state.orderId);
            
            const discountResponse = await orderAPI.applyDiscountCode(state.orderId, discountCodeToApply);
            
            console.log('[checkout] Coupon API response:', JSON.stringify(discountResponse, null, 2));
            
            // Extract discount from couponDiscount field
            // API returns Order object with couponDiscount field
            const couponDiscount = discountResponse?.couponDiscount || discountResponse?.price?.couponDiscount;
            let discountAmount = 0;
            
            console.log('[checkout] Raw couponDiscount:', couponDiscount);
            console.log('[checkout] couponDiscount type:', typeof couponDiscount);
            
            if (couponDiscount) {
              if (typeof couponDiscount === 'object') {
                // Avoid 'total' field as it might be order total, not discount
                discountAmount = couponDiscount.amount || couponDiscount.value || couponDiscount.discount || 0;
                
                // If amount is in cents, convert to DKK
                if (discountAmount > 10000) {
                  console.log('[checkout] Large discountAmount detected, converting from cents:', discountAmount);
                  discountAmount = discountAmount / 100;
                }
                
                console.log('[checkout] Extracted discountAmount from object:', discountAmount);
              } else if (typeof couponDiscount === 'number') {
                discountAmount = couponDiscount;
                
                // If amount is in cents, convert to DKK
                if (discountAmount > 10000) {
                  console.log('[checkout] Large discountAmount detected, converting from cents:', discountAmount);
                  discountAmount = discountAmount / 100;
                }
                
                console.log('[checkout] Extracted discountAmount from number:', discountAmount);
              }
            }
            
            // Also check if discountAmount was already extracted by the API method
            if (!discountAmount && discountResponse?.discountAmount) {
              discountAmount = discountResponse.discountAmount;
              
              // If amount is in cents, convert to DKK
              if (discountAmount > 10000) {
                console.log('[checkout] Large discountAmount from response, converting from cents:', discountAmount);
                discountAmount = discountAmount / 100;
              }
              
              console.log('[checkout] Using discountAmount from response:', discountAmount);
            }
            
            // Check price.leftToPay or price.total as fallback
            if (!discountAmount && discountResponse?.price) {
              const originalTotal = state.totals.subtotal || state.totals.cartTotal;
              let newTotal = discountResponse.price.total || discountResponse.price.leftToPay || 0;
              
              // Convert to DKK if in cents
              if (newTotal > 10000) {
                newTotal = newTotal / 100;
              }
              
              if (newTotal < originalTotal && originalTotal > 0) {
                discountAmount = originalTotal - newTotal;
                console.log('[checkout] Calculated discount from price difference:', discountAmount, '(original:', originalTotal, 'new:', newTotal, ')');
              }
            }
            
            // Validate discount amount - ensure it doesn't exceed subtotal
            const subtotal = state.totals.subtotal || state.totals.cartTotal || 0;
            if (discountAmount > subtotal && subtotal > 0) {
              console.warn('[checkout] Discount amount exceeds subtotal, capping at subtotal:', discountAmount, '->', subtotal);
              discountAmount = subtotal;
            }
            
            console.log('[checkout] Final discountAmount:', discountAmount, '(subtotal:', subtotal, ')');
            
            // If we couldn't extract discount amount, try fetching the order to get updated totals
            if (!discountAmount || discountAmount === 0) {
              console.log('[checkout] Attempting to fetch updated order to calculate discount...');
              try {
                const updatedOrder = await orderAPI.getOrder(state.orderId);
                console.log('[checkout] Updated order:', JSON.stringify(updatedOrder, null, 2));
                
                // Try to extract discount from updated order
                const updatedCouponDiscount = updatedOrder?.couponDiscount || updatedOrder?.price?.couponDiscount;
                if (updatedCouponDiscount) {
                  if (typeof updatedCouponDiscount === 'object') {
                    discountAmount = updatedCouponDiscount.amount || updatedCouponDiscount.value || updatedCouponDiscount.total || 0;
                  } else if (typeof updatedCouponDiscount === 'number') {
                    discountAmount = updatedCouponDiscount;
                  }
                  console.log('[checkout] Extracted discount from updated order:', discountAmount);
                }
                
                // Calculate discount from price difference if still not found
                if (!discountAmount || discountAmount === 0) {
                  const originalTotal = state.totals.subtotal || state.totals.cartTotal;
                  const newTotal = updatedOrder?.price?.total || updatedOrder?.price?.leftToPay || updatedOrder?.total || 0;
                  if (newTotal < originalTotal && newTotal > 0) {
                    discountAmount = originalTotal - newTotal;
                    console.log('[checkout] Calculated discount from price difference:', discountAmount, '(original:', originalTotal, 'new:', newTotal, ')');
                  }
                }
              } catch (fetchError) {
                console.warn('[checkout] Could not fetch updated order:', fetchError);
              }
            }
            
            if (discountAmount > 0) {
              // Success - apply discount
              state.discountCode = discountCodeToApply;
              state.discountApplied = true;
              state.totals.discountAmount = roundToHalfKrone(discountAmount);
              
              console.log('[checkout] Updating cart totals with discount:', discountAmount);
              console.log('[checkout] Subtotal:', state.totals.subtotal, 'Discount:', discountAmount, 'Final Total:', state.totals.subtotal - discountAmount);
              updateCartSummary(); // Use API-based cart update function
              
              // Update UI to show coupon is applied
              if (DOM.discountInput) {
                DOM.discountInput.value = discountCodeToApply;
                DOM.discountInput.disabled = true;
                DOM.discountInput.style.opacity = '0.6';
                DOM.discountInput.style.borderColor = '#10B981';
              }
              
              // Show success message
              showDiscountMessage(`Coupon "${discountCodeToApply}" applied! Discount: ${formatCurrencyHalfKrone(discountAmount)}`, 'success');
              
              console.log('[checkout] ✅ Coupon applied successfully:', discountCodeToApply, 'Amount:', discountAmount);
            } else {
              console.warn('[checkout] ⚠️ Coupon applied but no discount amount found');
              console.warn('[checkout] Response structure:', Object.keys(discountResponse || {}));
              console.warn('[checkout] Full response:', JSON.stringify(discountResponse, null, 2));
              showDiscountMessage('Coupon applied but discount amount could not be determined. Please check the order total.', 'error');
            }
          } catch (error) {
            console.error('[checkout] ❌ Failed to apply coupon during checkout:', error);
            console.error('[checkout] Error details:', {
              message: error.message,
              stack: error.stack,
            });
            
            // Parse error message to extract error code
            let errorMessage = 'Coupon could not be applied. Checkout will continue.';
            const errorText = error.message || '';
            
            if (errorText.includes('COUPON_NOT_APPLICABLE')) {
              errorMessage = 'This coupon is not applicable to your order. Checkout will continue without discount.';
            } else if (errorText.includes('COUPON_NOT_FOUND') || errorText.includes('404')) {
              errorMessage = 'Coupon code not found. Checkout will continue without discount.';
            } else if (errorText.includes('COUPON_EXPIRED')) {
              errorMessage = 'This coupon has expired. Checkout will continue without discount.';
            } else if (errorText.includes('403') || errorText.includes('Forbidden')) {
              errorMessage = 'This coupon cannot be applied. Checkout will continue without discount.';
            }
            
            // Don't block checkout if coupon fails - just log the warning
            // Show a warning message but don't prevent checkout
            if (DOM.discountInput) {
              showDiscountMessage(errorMessage, 'error');
            }
          }
        } else {
          console.log('[checkout] Coupon application skipped:', {
            discountCodeToApply,
            discountApplied: state.discountApplied,
            orderId: state.orderId,
          });
        }
      }
      
      // Verify payment link was generated
      if (!paymentLink && state.membershipPlanId) {
        throw new Error('Payment link was not generated after adding subscription');
      }
    } catch (error) {
      console.error('[checkout] Failed to add items or generate payment link:', error);
      
      // Check if this is a PRODUCT_NOT_ALLOWED error (campaign eligibility restriction)
      const isProductNotAllowed = error.isProductNotAllowed || 
                                  (error.message && error.message.includes('PRODUCT_NOT_ALLOWED'));
      
      if (isProductNotAllowed) {
        // Show friendly message that this is a restriction, not an error
        showToast('This offer is not available for your account. This may be due to existing subscriptions or campaign eligibility rules.', 'info');
      } else {
        // Show error message for actual errors
        showToast(getErrorMessage(error, 'Adding items'), 'error');
      }
      
      setCheckoutLoadingState(false);
      return;
    }

    // Step 5: Update order summary with real data
    // IMPORTANT: Preserve full order object (state.fullOrder) for payment overview
    // buildOrderSummary creates a summary object for confirmation view, not the full API order
    const summaryOrder = state.orderId ? { id: state.orderId, orderId: state.orderId } : null;
    state.order = buildOrderSummary(payload, summaryOrder, customer);
    
    // If we don't have full order data yet, try to fetch it before redirecting
    // This ensures payment overview shows correct prices
    if (!state.fullOrder || !state.fullOrder.subscriptionItems) {
      if (state.orderId) {
        try {
          const fullOrder = await orderAPI.getOrder(state.orderId);
          state.fullOrder = fullOrder;
          updatePaymentOverview();
          console.log('[checkout] Full order data fetched and stored for payment overview');
        } catch (error) {
          console.warn('[checkout] Could not fetch full order data:', error);
        }
      }
    }
    
    // Step 6: Redirect to payment or show confirmation
    console.log('[checkout] ===== PAYMENT REDIRECT CHECK =====');
    console.log('[checkout] paymentLink value:', paymentLink);
    console.log('[checkout] paymentLink type:', typeof paymentLink);
    console.log('[checkout] paymentLink truthy?', !!paymentLink);
    console.log('[checkout] state.paymentLink:', state.paymentLink);
    
    if (paymentLink && (paymentLink.startsWith('http://') || paymentLink.startsWith('https://'))) {
      // Redirect to payment provider
      console.log('[checkout] ✅ Valid payment link found, redirecting to payment provider...');
      console.log('[checkout] Payment link URL:', paymentLink);
      showToast('Redirecting to secure payment...', 'info');
      
      // Use replace instead of href to avoid adding to browser history
      // This prevents the back button from going back to the checkout page
      setTimeout(() => {
        try {
          console.log('[checkout] Executing window.location.replace with:', paymentLink);
          window.location.replace(paymentLink);
        } catch (error) {
          console.error('[checkout] ❌ Redirect failed with replace:', error);
          // Fallback to href if replace fails
          try {
            console.log('[checkout] Falling back to window.location.href');
            window.location.href = paymentLink;
          } catch (hrefError) {
            console.error('[checkout] ❌ Redirect failed with href:', hrefError);
            showToast('Failed to redirect to payment. Please contact support.', 'error');
            state.checkoutInProgress = false;
            setCheckoutLoadingState(false);
          }
        }
      }, 500);
    } else {
      // No payment link or invalid URL
      console.error('[checkout] ❌ Payment link not available or invalid!');
      console.error('[checkout] paymentLink:', paymentLink);
      console.error('[checkout] This means the API did not return a valid payment URL');
      console.error('[checkout] The payment provider might be embedded or the API response structure changed');
      
      // Check if payment link is in state (maybe it was set elsewhere)
      if (state.paymentLink && (state.paymentLink.startsWith('http://') || state.paymentLink.startsWith('https://'))) {
        console.log('[checkout] Found payment link in state, using that instead');
        paymentLink = state.paymentLink;
        showToast('Redirecting to secure payment...', 'info');
        setTimeout(() => {
          window.location.replace(paymentLink);
        }, 500);
      } else {
        // No valid payment link - this is an error
        console.error('[checkout] ❌ CRITICAL: No valid payment link available!');
        console.error('[checkout] Order was created but payment cannot be processed');
        showToast('Payment link not available. Please contact support with order ID: ' + state.orderId, 'error');
        state.checkoutInProgress = false;
        setCheckoutLoadingState(false);
        
        // Still show confirmation but warn user
        if (state.currentStep < TOTAL_STEPS) {
          nextStep();
        } else {
          renderConfirmationView();
        }
      }
    }

  } catch (error) {
    // Catch-all for unexpected errors
    console.error('[checkout] Unexpected error:', error);
    showToast(getErrorMessage(error, 'Checkout'), 'error');
    state.checkoutInProgress = false; // Reset on error
    setCheckoutLoadingState(false);
  }
}

function buildCheckoutPayload() {
  const payload = {};
  const fields = document.querySelectorAll('[data-api-field]');

  fields.forEach((field) => {
    const path = field.dataset.apiField;
    if (!path) return;
    const value = field.type === 'checkbox' ? field.checked : field.value;
    setByPath(payload, path, value);
  });

  const valueCards = Array.from(state.valueCardQuantities.entries())
    .filter(([, qty]) => qty > 0)
    .map(([planId, quantity]) => ({ planId, quantity }));

  payload.purchase = {
    ...(payload.purchase || {}),
    membershipPlanId: state.membershipPlanId,
    valueCards,
    addons: Array.from(state.addonIds),
    totalAmount: state.totals.cartTotal,
    ...(state.discountCode ? { discountCode: state.discountCode } : {}),
  };

  payload.payment = {
    ...(payload.payment || {}),
    method: state.paymentMethod,
  };

  return payload;
}

function buildOrderSummary(payload, order = null, customer = null) {
  const now = new Date();
  
  // Try to find membership from API subscriptions first, then fall back to static plans
  let membership = null;
  const membershipPlanId = state.membershipPlanId ?? '';
  // Check both membership subscriptions and 15 Day Pass subscriptions
  const allSubscriptions = [...(state.subscriptions || []), ...(state.dayPassSubscriptions || [])];
  if (membershipPlanId && allSubscriptions.length > 0) {
    // Extract numeric ID from 'campaign-XXX', 'membership-134', or '15daypass-XXX' format
    const numericId = membershipPlanId.replace(/^(campaign|membership|15daypass)-/, '');
    const productId = parseInt(numericId, 10);
    
    // Find membership in API subscriptions (check both arrays)
    membership = allSubscriptions.find(sub => 
      sub.id === productId || 
      String(sub.id) === numericId ||
      sub.id === membershipPlanId
    );
    
    // If found, convert to format expected by the rest of the code
    if (membership) {
      membership = {
        id: membershipPlanId,
        name: membership.name || membership.productNumber || 'Membership',
        price: (membership.priceWithInterval?.price?.amount || membership.price?.amount || 0) / 100,
      };
    }
  }
  
  // Fall back to static plans if not found in API data
  if (!membership) {
    membership = findMembershipPlan(membershipPlanId);
  }

  // Use real data if available, otherwise use TBD placeholders
  // IMPORTANT: Use order.number if available (this is the display number shown in emails/receipts)
  // Fall back to order.id if number doesn't exist (for backwards compatibility)
  const orderNumber = order?.number || order?.id || order?.orderId || state.orderId || 'TBD-ORDER-ID';
  const orderId = order?.id || order?.orderId || state.orderId || 'TBD-ORDER-ID';
  // Extract membership ID from customer response - check both direct and nested data structure
  const membershipId = customer?.data?.id || 
                       customer?.data?.customerId || 
                       customer?.data?.membershipId ||
                       customer?.id || 
                       customer?.customerId || 
                       customer?.membershipId || 
                       state.customerId || // Use customer ID from checkout if available
                       'TBD-MEMBERSHIP-ID';

  // Build member name from customer data - check multiple sources
  let memberName = '';
  if (customer?.fullName) {
    memberName = customer.fullName;
  } else if (customer?.firstName && customer?.lastName) {
    memberName = `${customer.firstName} ${customer.lastName}`;
  } else if (payload.customer?.firstName && payload.customer?.lastName) {
    memberName = `${payload.customer.firstName} ${payload.customer.lastName}`;
  }
  
  // Build primary gym label - check multiple sources
  const primaryGymValue = customer?.primaryGym || customer?.primary_gym || payload.customer?.primaryGym;
  
  // Determine product type for the order summary
  let productType = 'membership'; // default
  if (state.selectedProductType === 'punch-card') {
    productType = 'punch-card';
  } else if (state.membershipPlanId && String(state.membershipPlanId).startsWith('15daypass-')) {
    productType = '15daypass';
  } else if (membershipPlanId) {
    // Check if it's a 15 day pass by checking product labels
    const allSubscriptions = [...(state.subscriptions || []), ...(state.dayPassSubscriptions || [])];
    const numericId = membershipPlanId.replace(/^(campaign|membership|15daypass)-/, '');
    const productId = parseInt(numericId, 10);
    const foundProduct = allSubscriptions.find(sub => 
      sub.id === productId || 
      String(sub.id) === numericId
    );
    if (foundProduct?.productLabels?.some(label => 
      label.name && label.name.toLowerCase() === '15 day pass'
    )) {
      productType = '15daypass';
    }
  }
  
  return {
    number: orderNumber,
    date: order?.createdAt ? new Date(order.createdAt) : (order?.created ? new Date(order.created) : now),
    items: [...state.cartItems],
    total: order?.total || order?.totalAmount || state.totals.cartTotal,
    memberName: memberName || '—',
    membershipNumber: membershipId,
    membershipType: membership?.name ?? '—',
    primaryGym: resolveGymLabel(primaryGymValue),
    membershipPrice: state.totals.membershipMonthly,
    productType: productType, // Store product type in order summary
  };
}

function resolveGymLabel(value) {
  const mapping = {
    'boulders-copenhagen': 'Boulders Copenhagen',
    'boulders-aarhus': 'Boulders Aarhus',
    'boulders-odense': 'Boulders Odense',
  };
  return value ? mapping[value] ?? value : '—';
}

// Diagnostic helper: Export diagnostic data
window.exportPaymentDiagnostics = function() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    orderId: state.orderId,
    customerId: state.customerId,
    sessionStorage: {
      customer: sessionStorage.getItem('boulders_checkout_customer'),
      order: sessionStorage.getItem('boulders_checkout_order'),
    },
    state: {
      selectedBusinessUnit: state.selectedBusinessUnit,
      membershipPlanId: state.membershipPlanId,
      order: state.order,
    },
    url: window.location.href,
  };
  
  const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payment-diagnostics-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('[Diagnostics] Exported diagnostic data:', diagnostics);
  return diagnostics;
};

/**
 * Comprehensive order price verification function for debugging.
 * Call this from console to verify order pricing is correct.
 * 
 * Usage: verifyOrderPrice(orderId)
 * 
 * @param {number} orderId - Order ID to verify (optional, uses state.orderId if not provided)
 * @returns {Promise<Object>} Verification result with detailed information
 */
window.verifyOrderPrice = async function(orderId = null) {
  const orderIdToCheck = orderId || state.orderId;
  if (!orderIdToCheck) {
    console.error('No order ID provided and state.orderId is not set');
    return null;
  }
  
  console.log('===== COMPREHENSIVE ORDER PRICE VERIFICATION =====');
  console.log('Order ID:', orderIdToCheck);
  
  try {
    const order = await orderAPI.getOrder(orderIdToCheck);
    const subscriptionItem = order?.subscriptionItems?.[0];
    
    if (!subscriptionItem) {
      console.warn('No subscription item found in order');
      return { order, hasSubscription: false };
    }
    
    const productId = subscriptionItem?.product?.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDateStr = today.toISOString().split('T')[0];
    const expectedPrice = orderAPI._calculateExpectedPartialMonthPrice(productId, startDateStr);
    const verification = orderAPI._verifySubscriptionPricing(order, productId, expectedPrice, today);
    
    const orderPriceAmount = order?.price?.amount || 0;
    const orderPriceInCents = typeof orderPriceAmount === 'object' ? orderPriceAmount.amount : orderPriceAmount;
    const orderPriceDKK = orderPriceInCents / 100;
    
    console.log('Order Price:', orderPriceDKK, 'DKK');
    console.log('Expected Price:', expectedPrice?.amountInDKK || 'N/A', 'DKK');
    console.log('Verification Result:', verification);
    console.log('Is Correct:', verification.isCorrect ? '✅ YES' : '❌ NO');
    
    if (!verification.isCorrect) {
      console.error('⚠️ ORDER PRICE IS INCORRECT!');
      console.error('Backend shows:', orderPriceDKK, 'DKK');
      console.error('Should be:', expectedPrice?.amountInDKK || 'N/A', 'DKK');
      console.error('Difference:', expectedPrice ? (orderPriceDKK - expectedPrice.amountInDKK).toFixed(2) : 'N/A', 'DKK');
    }
    
    return {
      order,
      subscriptionItem,
      productId,
      orderPriceDKK,
      expectedPriceDKK: expectedPrice?.amountInDKK || null,
      verification,
      isCorrect: verification.isCorrect
    };
  } catch (error) {
    console.error('Error verifying order price:', error);
    return { error: error.message };
  }
};

// Debug helper: Check payment overview state
window.checkPaymentOverview = function() {
  console.log('=== PAYMENT OVERVIEW DEBUG ===');
  console.log('State:', {
    orderId: state.orderId,
    hasFullOrder: !!state.fullOrder,
    fullOrderPrice: state.fullOrder?.price,
    fullOrderSubscriptionItems: state.fullOrder?.subscriptionItems?.length || 0,
    hasOrder: !!state.order,
    cartTotal: state.totals.cartTotal,
    membershipMonthly: state.totals.membershipMonthly,
    selectedProductType: state.selectedProductType,
    selectedProductId: state.selectedProductId
  });
  
  if (state.fullOrder) {
    console.log('Full Order:', JSON.stringify(state.fullOrder, null, 2));
  }
  
  if (state.orderId && !state.fullOrder) {
    console.log('⚠️ Order ID exists but fullOrder is missing - fetching...');
    orderAPI.getOrder(state.orderId)
      .then(order => {
        state.fullOrder = order;
        updatePaymentOverview();
        console.log('✅ Order fetched and payment overview updated');
      })
      .catch(error => {
        console.error('❌ Could not fetch order:', error);
      });
  } else if (state.fullOrder) {
    console.log('✅ Full order exists, updating payment overview...');
    updatePaymentOverview();
  }
  
  return {
    orderId: state.orderId,
    hasFullOrder: !!state.fullOrder,
    payNow: state.fullOrder?.price?.amount ? (typeof state.fullOrder.price.amount === 'object' ? state.fullOrder.price.amount.amount / 100 : state.fullOrder.price.amount / 100) : state.totals.cartTotal,
    monthlyPayment: state.fullOrder?.subscriptionItems?.[0]?.payRecurring?.price?.amount ? state.fullOrder.subscriptionItems[0].payRecurring.price.amount / 100 : state.totals.membershipMonthly
  };
};

// Diagnostic helper: Get current order status
window.getOrderDiagnostics = async function(orderId) {
  if (!orderId) {
    orderId = state.orderId;
  }
  if (!orderId) {
    console.error('[Diagnostics] No order ID available');
    return null;
  }
  
  try {
    const order = await orderAPI.getOrder(orderId);
    const diagnostics = {
      timestamp: new Date().toISOString(),
      orderId: orderId,
      order: {
        id: order.id,
        number: order.number,
        status: order.orderStatus?.name || order.status,
        statusId: order.orderStatus?.id,
        preliminary: order.preliminary,
        leftToPay: order.leftToPay,
        totalCost: order.totalCost,
        customer: order.customer,
        subscriptionItems: order.subscriptionItems,
        created: order.created,
        lastModified: order.lastModified,
      },
      subscriptionStatus: order.subscriptionItems?.map(item => ({
        id: item.subscription?.id,
        name: item.subscription?.name,
        users: item.subscription?.users,
        payer: item.subscription?.payer,
      })),
    };
    
    console.log('[Diagnostics] Order diagnostics:', diagnostics);
    return diagnostics;
  } catch (error) {
    console.error('[Diagnostics] Failed to get order diagnostics:', error);
    return { error: error.message };
  }
};

// Load order data when returning from payment
async function loadOrderForConfirmation(orderId) {
  // CRITICAL: Check for URL error parameters FIRST (before resetting flags)
  // If there's an error code in URL, payment definitely failed
  const urlParams = new URLSearchParams(window.location.search);
  const paymentError = urlParams.get('error');
  const paymentStatus = urlParams.get('status');
  const receiptId = urlParams.get('receiptid') || urlParams.get('receiptId');
  const receiptUuid = urlParams.get('receiptuuid') || urlParams.get('receiptUuid');
  
  const hasPaymentErrorParam = paymentError || paymentStatus === 'cancelled' || paymentStatus === 'canceled';
  const hasReceiptParam = Boolean(receiptId || receiptUuid);
  let failureReason = null;
  if (hasPaymentErrorParam) {
    console.warn('[Payment Return] ⚠️ Error detected in URL parameters - will verify payment status before failing');
    console.warn('[Payment Return] Error details:', { paymentError, paymentStatus });

    if (paymentError) {
      const errorCode = parseInt(paymentError, 10);
      if (!isNaN(errorCode)) {
        switch (errorCode) {
          case 205:
            failureReason = 'Payment was declined by your bank or card issuer.';
            break;
          case 401:
          case 403:
            failureReason = 'Payment authorization failed. Please try again or use a different payment method.';
            break;
          default:
            failureReason = `Payment failed with error code ${errorCode}. Please try again or contact support.`;
        }
      } else if (paymentError.toLowerCase().includes('cancel')) {
        failureReason = 'Payment was cancelled before completion.';
      }
    }
  }
  
  // CRITICAL: Reset payment status flags at start (only if no URL error)
  state.paymentFailed = false;
  state.paymentPending = false;
  state.paymentConfirmed = false;
  
  try {
    // Fix: Ensure orderId is numeric (handle cases where it might have path segments)
    if (typeof orderId === 'string') {
      // Remove any path segments (e.g., "817247/confirmation" -> "817247")
      orderId = orderId.split('/')[0].trim();
      orderId = parseInt(orderId, 10);
      if (isNaN(orderId)) {
        throw new Error(`Invalid order ID: ${orderId}`);
      }
    }
    
    const startTime = Date.now();
    console.log(`[Payment Return] [${new Date().toISOString()}] Fetching order data for:`, orderId);
    
    // Restore checkout data from sessionStorage
    let storedCustomer = null;
    let storedOrder = null;
    try {
      const customerData = sessionStorage.getItem('boulders_checkout_customer');
      const orderData = sessionStorage.getItem('boulders_checkout_order');
      if (customerData) {
        storedCustomer = JSON.parse(customerData);
        state.customerId = storedCustomer.id;
        console.log('[Payment Return] Restored customer from sessionStorage:', storedCustomer);
      }
      if (orderData) {
        storedOrder = JSON.parse(orderData);
        if (storedOrder.membershipPlanId) state.membershipPlanId = storedOrder.membershipPlanId;
        if (storedOrder.cartItems) state.cartItems = storedOrder.cartItems;
        if (storedOrder.totals) state.totals = storedOrder.totals;
        if (storedOrder.selectedBusinessUnit) state.selectedBusinessUnit = storedOrder.selectedBusinessUnit;
        console.log('[Payment Return] Restored order data from sessionStorage:', storedOrder);
      }
      
      // Load subscriptions from API if we have a business unit, so membership lookup works
      const hasAllProducts = (state.subscriptions?.length || 0) > 0 && (state.valueCards?.length || 0) > 0;
      if (state.selectedBusinessUnit && !hasAllProducts) {
        console.log('[Payment Return] Loading products from API for membership lookup...');
        await loadProductsFromAPI();
      }
    } catch (e) {
      console.warn('[Payment Return] Could not restore data from sessionStorage:', e);
    }
    
    // Fetch order from API
    let order;
    try {
      order = await orderAPI.getOrder(orderId);
      console.log('[Payment Return] Order fetched:', order);
    } catch (fetchError) {
      // CRITICAL: This catch block MUST handle ALL errors to prevent success page from showing
      console.error('[Payment Return] ===== INNER CATCH BLOCK REACHED =====');
      console.error('[Payment Return] Inner catch - fetchError:', fetchError);
      console.error('[Payment Return] Inner catch - fetchError.message:', fetchError?.message);
      console.error('[Payment Return] Inner catch - fetchError.status:', fetchError?.status);
      
      // ALWAYS show payment failed for ANY error when returning from payment
      // This is safer than showing success page when payment actually failed
      try {
        const errorMessage = String(fetchError?.message || fetchError || '');
        const errorStatus = fetchError?.status || (errorMessage.match(/401|404/) ? parseInt(errorMessage.match(/(401|404)/)?.[0]) : null);
        const isUnauthorized = errorStatus === 401 || errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Get order failed: 401');
        const isNotFound = errorStatus === 404 || errorMessage.includes('404') || errorMessage.includes('Not Found') || errorMessage.includes('Get order failed: 404');
        
        console.log('[Payment Return] Inner catch - Error analysis:', {
          errorMessage: errorMessage.substring(0, 200),
          errorStatus,
          fetchErrorStatus: fetchError?.status,
          isUnauthorized,
          isNotFound,
          errorString: String(fetchError).substring(0, 200)
        });
        
        if (hasReceiptParam && !hasPaymentErrorParam) {
          console.warn('[Payment Return] ⚠️ Order fetch failed, but receipt present - showing success using stored data');

          const summaryOrder = {
            id: orderId,
            orderId,
            number: orderId,
            created: new Date().toISOString(),
            total: storedOrder?.totals?.cartTotal ?? state.totals?.cartTotal ?? 0,
            totalAmount: storedOrder?.totals?.cartTotal ?? state.totals?.cartTotal ?? 0,
          };

          const payload = buildCheckoutPayload();
          const summaryCustomer = storedCustomer || null;

          state.orderId = orderId;
          state.order = buildOrderSummary(payload, summaryOrder, summaryCustomer);
          state.paymentConfirmed = true;
          state.paymentFailed = false;
          state.paymentPending = false;

          state.currentStep = TOTAL_STEPS;
          showStep(TOTAL_STEPS);
          updateStepIndicator();
          updateNavigationButtons();
          updateMainSubtitle();
          renderConfirmationView();
          return;
        }

        if (isUnauthorized && !hasPaymentErrorParam) {
          console.warn('[Payment Return] ⚠️ Order fetch unauthorized without error param - showing pending instead of failed');
          showPaymentPendingMessage(null, orderId);
          return;
        }

        // Use default calm message instead of technical details
        console.warn('[Payment Return] ⚠️ INNER CATCH: Calling showPaymentFailedMessage');
        showPaymentFailedMessage(null, orderId, null);
        console.warn('[Payment Return] ✅ showPaymentFailedMessage called from inner catch - returning early');
        return; // CRITICAL: Always return to prevent success page
      } catch (innerError) {
        // Even if showPaymentFailedMessage fails, don't show success page
        console.error('[Payment Return] ❌ Error in inner catch handler:', innerError);
        // At minimum, navigate to step 5 and show error state
        state.paymentFailed = true;
        state.currentStep = TOTAL_STEPS;
        showStep(TOTAL_STEPS);
        return;
      }
    }
    
    // CRITICAL: Check payment status IMMEDIATELY after fetch
    // If payment is not confirmed, show pending/failed right away (don't show success first)
    const initialLeftToPay = order.leftToPay?.amount ?? order.leftToPay ?? null;
    const initialOrderStatus = order.orderStatus?.name || order.status;
    const initialIsPaid = order.orderStatus?.name === 'Betalet' || order.orderStatus?.id === 2;
    
    console.log('[Payment Return] Initial payment check:', {
      leftToPay: initialLeftToPay,
      orderStatus: initialOrderStatus,
      isPaid: initialIsPaid,
      willShowPending: initialLeftToPay !== null && initialLeftToPay > 0 && !initialIsPaid
    });
    
    // CRITICAL: Check payment status BEFORE showing any page
    // If payment is clearly not confirmed (leftToPay > 0 and not paid), show pending immediately
    if (hasPaymentErrorParam && !initialIsPaid) {
      console.warn('[Payment Return] ⚠️ Payment error param present and payment not confirmed - showing failure');
      showPaymentFailedMessage(order, orderId, failureReason);
      return;
    }

    if (initialLeftToPay !== null && initialLeftToPay > 0 && !initialIsPaid) {
      console.warn('[Payment Return] ⚠️ Payment not confirmed on initial fetch - showing pending immediately');
      showPaymentPendingMessage(order, orderId);
      return; // Don't continue with success page logic
    }
    
    // Payment is confirmed - navigate to step 5 and show success
    state.currentStep = TOTAL_STEPS;
    showStep(TOTAL_STEPS);
    updateStepIndicator();
    updateNavigationButtons();
    updateMainSubtitle();
    
    // DETAILED LOGGING: Check order status and structure to diagnose membership creation issue
    const diagnosticTime = Date.now();
    console.log('[Payment Return] ===== ORDER DIAGNOSTICS =====');
    console.log(`[Payment Return] Diagnostic timestamp: ${new Date().toISOString()}`);
    console.log(`[Payment Return] Time since payment return: ${((diagnosticTime - startTime) / 1000).toFixed(2)}s`);
    console.log('[Payment Return] Full order object:', JSON.stringify(order, null, 2));
    console.log('[Payment Return] Order status:', order.status);
    console.log('[Payment Return] Order paymentStatus:', order.paymentStatus || order.payment?.status);
    console.log('[Payment Return] Order items:', order.items);
    console.log('[Payment Return] Order customer:', order.customer);
    
    // Check if subscription item exists in order
    const hasSubscription = order.items?.some(item => 
      item.type === 'subscription' || 
      item.productType === 'subscription' ||
      item.subscriptionProduct ||
      item.subscription
    );
    console.log('[Payment Return] Has subscription item in order:', hasSubscription);
    
    // Check customer memberships/subscriptions
    if (order.customer) {
      console.log('[Payment Return] Customer memberships:', order.customer.memberships);
      console.log('[Payment Return] Customer subscriptions:', order.customer.subscriptions);
      console.log('[Payment Return] Customer activeMemberships:', order.customer.activeMemberships);
    }
    
    // Check order status - API uses orderStatus object, not status field
    const orderStatusName = order.orderStatus?.name || order.status;
    const orderStatusId = order.orderStatus?.id;
    const isPreliminary = order.preliminary === true;
    const leftToPay = order.leftToPay?.amount || 0;
    
    console.log('[Payment Return] Order status name:', orderStatusName);
    console.log('[Payment Return] Order status ID:', orderStatusId);
    console.log('[Payment Return] Order is preliminary:', isPreliminary);
    console.log('[Payment Return] Left to pay:', leftToPay);
    
    // Warn if order is still pending or preliminary
    if (orderStatusName === 'Oprettet' || orderStatusName === 'Created' || isPreliminary || leftToPay > 0) {
      console.warn('[Payment Return] ⚠️ Order still in "Created" status or preliminary - membership may not be created yet');
      console.warn('[Payment Return] Order needs to be finalized/completed for membership to be created in BRP');
      console.warn('[Payment Return] This might indicate:');
      console.warn('[Payment Return]   1. Payment webhook hasn\'t arrived yet (wait a few seconds)');
      console.warn('[Payment Return]   2. Payment webhook failed');
      console.warn('[Payment Return]   3. Order needs to be manually finalized');
      
      // Try to finalize the order if it's preliminary and payment was successful
      // Note: We're returning from payment, so payment should be successful
      // The order needs to be finalized (preliminary: false) for membership to be created in BRP
      if (isPreliminary) {
        console.log('[Payment Return] ⚠️ Order is preliminary - attempting to finalize...');
        console.log('[Payment Return] This is required for membership to be created in BRP');
        
        try {
          // Option 1: Try to set preliminary to false
          // The API might require additional fields or a specific endpoint
          const updateData = {
            preliminary: false, // Finalize the order
            businessUnit: state.selectedBusinessUnit || order.businessUnit?.id,
          };
          
          console.log('[Payment Return] Updating order with:', JSON.stringify(updateData, null, 2));
          const updatedOrder = await orderAPI.updateOrder(orderId, updateData);
          console.log('[Payment Return] Order update response:', updatedOrder);
          
          // Re-fetch order to verify status changed
          await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for backend processing
          const refreshedOrder = await orderAPI.getOrder(orderId);
          console.log('[Payment Return] Refreshed order status:', refreshedOrder.orderStatus);
          console.log('[Payment Return] Refreshed order preliminary:', refreshedOrder.preliminary);
          console.log('[Payment Return] Refreshed order leftToPay:', refreshedOrder.leftToPay);
          
          if (!refreshedOrder.preliminary && refreshedOrder.leftToPay?.amount === 0) {
            console.log('[Payment Return] ✅ Order finalized successfully! Membership should now be created in BRP');
            // Use refreshed order for summary
            Object.assign(order, refreshedOrder);
          } else if (!refreshedOrder.preliminary) {
            console.log('[Payment Return] ✅ Order preliminary set to false, but leftToPay still > 0');
            console.log('[Payment Return] ⚠️ Payment has not been registered yet - membership will NOT be created until payment is confirmed');
            console.log('[Payment Return] This might indicate:');
            console.warn('[Payment Return]   1. Payment webhook from payment provider hasn\'t arrived yet');
            console.warn('[Payment Return]   2. Payment provider needs to send webhook to backend');
            console.warn('[Payment Return]   3. Backend needs to process payment webhook to register payment');
            console.warn('[Payment Return]   4. Once payment is registered (leftToPay = 0), membership will be created');
            
            // Try polling for payment registration (wait up to 10 seconds)
            console.log('[Payment Return] Polling for payment registration...');
            const pollStartTime = Date.now();
            let paymentRegistered = false;
            for (let attempt = 0; attempt < 5; attempt++) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
              
              const pollTime = Date.now();
              const polledOrder = await orderAPI.getOrder(orderId);
              const newLeftToPay = polledOrder.leftToPay?.amount || 0;
              const timeSinceStart = ((pollTime - pollStartTime) / 1000).toFixed(1);
              
              console.log(`[Payment Return] [${new Date().toISOString()}] Poll attempt ${attempt + 1}/5 (${timeSinceStart}s): leftToPay = ${newLeftToPay}`);
              console.log(`[Payment Return] Poll ${attempt + 1} order status:`, polledOrder.orderStatus?.name, '| preliminary:', polledOrder.preliminary);
              
              if (newLeftToPay === 0) {
                console.log('[Payment Return] ✅ Payment registered! Membership should now be created in BRP');
                Object.assign(order, polledOrder);
                paymentRegistered = true;
                break;
              }
            }
            
            if (!paymentRegistered) {
              console.warn('[Payment Return] ⚠️ Payment still not registered after polling');
              console.warn('[Payment Return] The payment webhook may be delayed or failed');
              console.warn('[Payment Return] Membership will be created automatically once payment is registered');
            }
            
            // Use refreshed order for summary
            Object.assign(order, refreshedOrder);
          } else {
            console.warn('[Payment Return] ⚠️ Order update didn\'t change preliminary status');
            console.warn('[Payment Return] This might indicate:');
            console.warn('[Payment Return]   1. API doesn\'t allow client to finalize orders');
            console.warn('[Payment Return]   2. Backend webhook needs to finalize the order');
            console.warn('[Payment Return]   3. Additional fields required in update payload');
          }
        } catch (error) {
          console.error('[Payment Return] Failed to finalize order:', error);
          console.warn('[Payment Return] This might be expected if:');
          console.warn('[Payment Return]   1. Backend handles finalization via payment webhook');
          console.warn('[Payment Return]   2. Client is not authorized to finalize orders');
          console.warn('[Payment Return]   3. Order finalization requires different endpoint/fields');
          // Don't throw - continue with showing confirmation even if finalization fails
        }
      } else if (leftToPay > 0) {
        console.warn('[Payment Return] ⚠️ Order is not preliminary but still has leftToPay > 0');
        console.warn('[Payment Return] Payment may not have been registered yet');
      }
    }
    console.log('[Payment Return] =============================');
    
    // Extract customer data - try order response first, then stored data
    let customer = order?.customer || order?.data?.customer || null;
    let customerId = customer?.id || order?.customerId || state.customerId;
    
    // If no customer in order response, use stored customer data
    if (!customer && storedCustomer) {
      customer = storedCustomer;
      customerId = storedCustomer.id;
    }
    
    // If we have customer ID but no customer object, try to fetch customer data
    if (customerId && !customer) {
      try {
        // Note: We don't have a getCustomer API method, so we'll use stored data
        // If needed, we could add authAPI.getCustomer(customerId) later
        console.log('[Payment Return] Customer ID available but no customer object, using stored data');
      } catch (e) {
        console.warn('[Payment Return] Could not fetch customer data:', e);
      }
    }
    
    // Store customer ID if available
    if (customerId) {
      state.customerId = customerId;
    }
    
    // Build payload - use stored customer data if available
    const payload = buildCheckoutPayload();
    
    // Ensure customer data is in payload - prioritize stored customer data
    if (storedCustomer) {
      payload.customer = {
        firstName: storedCustomer.firstName,
        lastName: storedCustomer.lastName,
        email: storedCustomer.email,
        primaryGym: storedCustomer.primaryGym,
      };
    } else if (customer) {
      payload.customer = {
        firstName: customer.firstName || customer.first_name,
        lastName: customer.lastName || customer.last_name,
        email: customer.email,
        primaryGym: customer.primaryGym || customer.primary_gym,
      };
    }
    
    // Also ensure customer object has firstName/lastName for buildOrderSummary
    // Get primaryGym from business unit if not in customer data
    let primaryGym = storedCustomer?.primaryGym || customer?.primaryGym || customer?.primary_gym;
    if (!primaryGym && state.selectedBusinessUnit) {
      // Try to get gym name from business unit - check if businessUnits are loaded
      // Business units are stored in DOM or we need to fetch them
      // For now, use the business unit ID as fallback, or try to get from order
      if (order?.businessUnit) {
        primaryGym = order.businessUnit.name || order.businessUnit.label || order.businessUnit.id;
      } else {
        // Use business unit ID as fallback
        primaryGym = state.selectedBusinessUnit;
      }
    }
    
    if (!customer && storedCustomer) {
      customer = { ...storedCustomer, primaryGym: primaryGym || storedCustomer.primaryGym };
    } else if (customer && storedCustomer) {
      // Merge stored customer data into customer object if missing
      customer.firstName = customer.firstName || customer.first_name || storedCustomer.firstName;
      customer.lastName = customer.lastName || customer.last_name || storedCustomer.lastName;
      customer.email = customer.email || storedCustomer.email;
      customer.primaryGym = primaryGym || customer.primaryGym || customer.primary_gym || storedCustomer.primaryGym;
    } else if (customer) {
      customer.primaryGym = primaryGym || customer.primaryGym || customer.primary_gym;
    }
    
    // Use order total if available, otherwise use stored total
    const orderTotal = order?.total || order?.totalAmount || order?.data?.total || storedOrder?.totals?.cartTotal || 0;
    
    // Store diagnostic data for easy access (after customer is extracted)
    window.lastPaymentDiagnostics = {
      timestamp: new Date().toISOString(),
      orderId: orderId,
      order: order,
      customer: customer || storedCustomer,
      state: {
        customerId: state.customerId,
        membershipPlanId: state.membershipPlanId,
        selectedBusinessUnit: state.selectedBusinessUnit,
      },
    };
    console.log('[Payment Return] Diagnostic data stored in window.lastPaymentDiagnostics');
    
    // CRITICAL: Check payment status AFTER all processing (including polling)
    // This ensures we check the final state of the order after any updates
    const finalOrder = order; // Use the order object which may have been updated during polling
    const isPaymentConfirmed = finalOrder.leftToPay?.amount === 0 || finalOrder.leftToPay === 0;
    const isOrderPaid = finalOrder.orderStatus?.name === 'Betalet' || finalOrder.orderStatus?.id === 2; // Assuming 2 is "Paid" status
    
    console.log('[Payment Return] Final payment check:', {
      leftToPay: finalOrder.leftToPay?.amount || finalOrder.leftToPay,
      orderStatus: finalOrder.orderStatus?.name,
      isPaymentConfirmed,
      isOrderPaid,
      willShowSuccess: isPaymentConfirmed || isOrderPaid
    });
    
    if (!isPaymentConfirmed && !isOrderPaid) {
      console.warn('[Payment Return] ⚠️ Payment not confirmed - showing pending message instead of success page');
      console.warn('[Payment Return] leftToPay:', finalOrder.leftToPay?.amount || finalOrder.leftToPay);
      console.warn('[Payment Return] orderStatus:', finalOrder.orderStatus?.name);
      
      // Show payment pending message instead of success page
      showPaymentPendingMessage(finalOrder, orderId);
      return; // Don't show success page yet
    }
    
    // CRITICAL: Mark payment as confirmed to allow success page rendering
    state.paymentConfirmed = true;
    state.paymentFailed = false;
    state.paymentPending = false;
    
    // Store full order object for payment overview (before building summary)
    state.fullOrder = order;
    
    // Log order number fields to verify correct number is used
    console.log('[Payment Return] Order number fields:', {
      'order.id': order.id,
      'order.number': order.number,
      'order.orderId': order.orderId,
      'state.orderId': state.orderId,
      'Will use for display': order.number || order.id || order.orderId || state.orderId
    });
    
    // Build order summary with fetched data (for confirmation view)
    state.order = buildOrderSummary(payload, { ...order, total: orderTotal, totalAmount: orderTotal }, customer || storedCustomer);
    console.log('[Payment Return] Order summary built:', state.order);
    console.log('[Payment Return] Order number in summary:', state.order.number);
    
    // Update payment overview with order data
    updatePaymentOverview();
    
    // GTM: Track purchase event when payment is confirmed
    const purchaseItems = (state.cartItems && state.cartItems.length > 0)
      ? state.cartItems
      : (storedOrder?.cartItems || []);
    if (window.GTM && window.GTM.trackPurchase && purchaseItems.length > 0) {
      try {
        // Get order total - prefer from order object, fallback to cart total
        const purchaseValue = orderTotal || 
                             (order?.price?.total?.amount ? order.price.total.amount / 100 : 0) ||
                             (order?.price?.total ? order.price.total / 100 : 0) ||
                             state.totals.cartTotal || 0;
        
        // Get transaction ID
        const transactionId = order?.number || order?.id || orderId;
        
        window.GTM.trackPurchase(
          transactionId,
          purchaseItems,
          purchaseValue,
          0, // tax
          0, // shipping
          'DKK'
        );
      } catch (error) {
        console.warn('[GTM] Error tracking purchase:', error);
      }
    } else if (window.GTM && window.GTM.trackPurchase) {
      console.warn('[GTM] purchase not tracked: missing cart items after payment return');
    }
    
    // Only render confirmation view if payment is confirmed
    renderConfirmationView();
  } catch (error) {
    console.error('[Payment Return] ===== CATCH BLOCK REACHED =====');
    console.error('[Payment Return] Failed to load order data:', error);
    
    // CRITICAL: Check if error is 401 (Unauthorized) - this usually means payment was cancelled/failed
    // 401 = Unauthorized (payment not completed, order not accessible)
    // 404 = Not Found (order doesn't exist)
    // Use multiple detection methods to be absolutely sure we catch 401 errors
    const errorString = String(error || '');
    const errorMessage = String(error?.message || errorString || '');
    const errorStatus = error?.status || (errorMessage.match(/401|404/) ? parseInt(errorMessage.match(/(401|404)/)?.[0]) : null);
    
    // Multiple ways to detect 401/404 errors - check EVERYTHING
    const has401InMessage = errorMessage.includes('401') || errorString.includes('401') || String(error).includes('401');
    const has404InMessage = errorMessage.includes('404') || errorString.includes('404') || String(error).includes('404');
    const isUnauthorized = errorStatus === 401 || has401InMessage || errorMessage.includes('Unauthorized') || errorString.includes('Unauthorized');
    const isNotFound = errorStatus === 404 || has404InMessage || errorMessage.includes('Not Found') || errorString.includes('Not Found');
    
    console.log('[Payment Return] Error detection:', {
      errorString: errorString.substring(0, 200),
      errorMessage: errorMessage.substring(0, 200),
      errorStatus,
      has401InMessage,
      has404InMessage,
      isUnauthorized,
      isNotFound,
      errorKeys: Object.keys(error || {})
    });
    
    // ALWAYS show payment failed for 401/404 errors (payment cancelled/failed)
    // Also show failed for ANY error when returning from payment (safer than showing success)
    if (isUnauthorized || isNotFound || has401InMessage || has404InMessage) {
      console.warn('[Payment Return] ⚠️ DETECTED 401/404 ERROR - Calling showPaymentFailedMessage');
        const failureReason = null; // Use default calm message instead of technical details
      
      // CRITICAL: Always call showPaymentFailedMessage for 401/404 errors
      console.warn('[Payment Return] About to call showPaymentFailedMessage with:', { orderId, failureReason });
      showPaymentFailedMessage(null, orderId, failureReason);
      console.warn('[Payment Return] showPaymentFailedMessage called - returning early');
      return; // Don't show success page
    }
    
    // For any other error when returning from payment, also show failed (safer than showing success)
    // This handles cases where error doesn't match 401/404 patterns but still indicates failure
    console.warn('[Payment Return] ⚠️ Unexpected error during payment return - showing payment failed as fallback');
    console.warn('[Payment Return] About to call showPaymentFailedMessage (fallback)');
    showPaymentFailedMessage(null, orderId, null); // Use default calm message
    console.warn('[Payment Return] showPaymentFailedMessage (fallback) called - returning early');
    return; // Don't show success page or pending message
  }
}

function showPaymentFailedMessage(order, orderId, reason = null) {
  console.log('[Payment Failed] Called with:', { orderId, reason, currentStep: state.currentStep });
  
  // CRITICAL: Restore cart and state from sessionStorage BEFORE showing failure page
  // This ensures cart is populated when user clicks "Try Payment Again"
  try {
    const orderData = sessionStorage.getItem('boulders_checkout_order');
    if (orderData) {
      const storedOrder = JSON.parse(orderData);
      console.log('[Payment Failed] Restoring cart and state from sessionStorage:', storedOrder);
      
      // Restore cart items and state
      if (storedOrder.cartItems) {
        state.cartItems = storedOrder.cartItems;
        console.log('[Payment Failed] ✅ Restored cart items:', state.cartItems.length, 'items');
        
        // CRITICAL: For punch cards, rebuild valueCardQuantities from cart items
        // This is needed because valueCardQuantities is a Map and doesn't serialize to JSON
        const punchCardItems = storedOrder.cartItems.filter(item => item.type === 'value-card');
        if (punchCardItems.length > 0) {
          console.log('[Payment Failed] Found punch card items, rebuilding valueCardQuantities');
          state.valueCardQuantities.clear();
          punchCardItems.forEach(item => {
            // Use membershipPlanId format (punch-{id} or adult-punch/junior-punch)
            const planId = storedOrder.membershipPlanId || 
                          (item.productId ? `punch-${item.productId}` : `punch-${item.id}`);
            const quantity = item.quantity || 1;
            state.valueCardQuantities.set(planId, quantity);
            console.log('[Payment Failed] ✅ Rebuilt valueCardQuantities:', planId, '=', quantity);
          });
        }
      }
      if (storedOrder.totals) {
        state.totals = { ...state.totals, ...storedOrder.totals };
        console.log('[Payment Failed] ✅ Restored totals:', state.totals);
      }
      
      // Restore selectedProductType and selectedProductId if available
      if (storedOrder.selectedProductType) {
        state.selectedProductType = storedOrder.selectedProductType;
        console.log('[Payment Failed] ✅ Restored selectedProductType:', state.selectedProductType);
      }
      if (storedOrder.selectedProductId) {
        state.selectedProductId = storedOrder.selectedProductId;
        console.log('[Payment Failed] ✅ Restored selectedProductId:', state.selectedProductId);
      }
      
      if (storedOrder.membershipPlanId) {
        state.membershipPlanId = storedOrder.membershipPlanId;
        console.log('[Payment Failed] ✅ Restored membershipPlanId:', state.membershipPlanId);
        
        // CRITICAL: Derive selectedProductId and selectedProductType from membershipPlanId if not already set
        // Handle all formats: campaign-, membership-, 15daypass-, punch-
        if (!state.selectedProductType || !state.selectedProductId) {
          if (typeof storedOrder.membershipPlanId === 'string') {
            if (storedOrder.membershipPlanId.startsWith('campaign-')) {
              const productId = storedOrder.membershipPlanId.replace('campaign-', '');
              state.selectedProductId = parseInt(productId, 10) || productId;
              state.selectedProductType = 'membership';
              console.log('[Payment Failed] ✅ Derived selectedProductId from campaign:', state.selectedProductId);
            } else if (storedOrder.membershipPlanId.startsWith('membership-')) {
              const productId = storedOrder.membershipPlanId.replace('membership-', '');
              state.selectedProductId = parseInt(productId, 10) || productId;
              state.selectedProductType = 'membership';
              console.log('[Payment Failed] ✅ Derived selectedProductId from membership:', state.selectedProductId);
            } else if (storedOrder.membershipPlanId.startsWith('15daypass-')) {
              const productId = storedOrder.membershipPlanId.replace('15daypass-', '');
              state.selectedProductId = parseInt(productId, 10) || productId;
              state.selectedProductType = 'membership';
              console.log('[Payment Failed] ✅ Derived selectedProductId from 15daypass:', state.selectedProductId);
            } else if (storedOrder.membershipPlanId.startsWith('punch-') || 
                       storedOrder.membershipPlanId === 'adult-punch' || 
                       storedOrder.membershipPlanId === 'junior-punch') {
              // For punch cards, extract productId from membershipPlanId
              if (storedOrder.membershipPlanId.startsWith('punch-')) {
                const productId = storedOrder.membershipPlanId.replace('punch-', '');
                state.selectedProductId = parseInt(productId, 10) || productId;
              } else {
                // For adult-punch/junior-punch, we need to find the productId from cart items
                const punchCardItem = storedOrder.cartItems?.find(item => item.type === 'value-card');
                if (punchCardItem) {
                  state.selectedProductId = punchCardItem.productId || punchCardItem.id;
                }
              }
              state.selectedProductType = 'punch-card';
              console.log('[Payment Failed] ✅ Derived selectedProductId from punch card:', state.selectedProductId);
            }
          }
        }
      }
      if (storedOrder.selectedBusinessUnit) {
        state.selectedBusinessUnit = storedOrder.selectedBusinessUnit;
        console.log('[Payment Failed] ✅ Restored selectedBusinessUnit:', state.selectedBusinessUnit);
      }
      if (storedOrder.orderId) {
        state.orderId = storedOrder.orderId;
        console.log('[Payment Failed] ✅ Restored orderId:', state.orderId);
      }
    }
  } catch (e) {
    console.warn('[Payment Failed] Could not restore cart from sessionStorage:', e);
  }
  
  // CRITICAL: Mark payment as failed FIRST to prevent success page from rendering
  state.paymentFailed = true;
  state.paymentConfirmed = false;
  state.paymentPending = false;
  
  // CRITICAL: Clear order data to prevent success page from rendering
  // Don't set state.order - this prevents renderConfirmationView() from being called
  if (state.order) {
    console.log('[Payment Failed] Clearing state.order to prevent success page');
    state.order = null;
  }
  
  // CRITICAL: Navigate to step 5 and IMMEDIATELY modify HTML before it's visible
  console.log('[Payment Failed] Navigating to confirmation page...');
  state.currentStep = TOTAL_STEPS;
  
  // Show step 5 panel
  const step5Panel = document.getElementById('step-5');
  if (step5Panel) {
    // Mark step 5 panel as payment failed for CSS targeting
    step5Panel.setAttribute('data-payment-failed', 'true');
    // Hide all other panels first
    DOM.stepPanels.forEach((panel, index) => {
      if (index + 1 === TOTAL_STEPS) {
        panel.classList.add('active');
        panel.style.display = 'block';
        panel.style.visibility = 'visible';
        panel.style.opacity = '1';
      } else {
        panel.classList.remove('active');
        if (panel.id !== 'step-3') {
          panel.style.display = 'none';
        }
      }
    });
    
    // IMMEDIATELY modify the HTML BEFORE it's visible to user
    const successTitle = step5Panel.querySelector('.success-title');
    const successMessage = step5Panel.querySelector('.success-message');
    const successBadge = step5Panel.querySelector('.success-badge');
    
    if (successTitle) {
      // CRITICAL: Remove data-i18n-key to prevent i18n from resetting the text
      successTitle.removeAttribute('data-i18n-key');
      successTitle.textContent = 'Payment Couldn\'t Be Completed';
      successTitle.style.color = '#f59e0b'; // Use amber/orange instead of red for less alarming tone
      console.log('[Payment Failed] ✅ Title set to calm message');
    }
    
    if (successMessage) {
      // CRITICAL: Remove data-i18n-key to prevent i18n from resetting the text
      successMessage.removeAttribute('data-i18n-key');
      const displayOrderId = orderId || order?.number || order?.id || 'N/A';
      
      // Determine failure reason and provide specific guidance
      let specificGuidance = '';
      
      // If a specific reason was provided (e.g., from URL error code), use it directly
      if (reason && reason.trim() && !reason.toLowerCase().includes('payment was not completed')) {
        specificGuidance = reason;
      } else {
        // Otherwise, try to infer from reason string patterns
        const reasonLower = String(reason || '').toLowerCase();
        
        if (reasonLower.includes('declined') || reasonLower.includes('bank') || reasonLower.includes('card issuer')) {
          specificGuidance = 'Payment was declined by your bank or card issuer.';
        } else if (reasonLower.includes('cancelled') || reasonLower.includes('canceled')) {
          specificGuidance = 'You closed the payment window before completing the transaction.';
        } else if (reasonLower.includes('unauthorized') || reasonLower.includes('401') || reasonLower.includes('authorization failed')) {
          specificGuidance = 'The payment session expired or was cancelled.';
        } else if (reasonLower.includes('not found') || reasonLower.includes('404')) {
          specificGuidance = 'The order could not be found. This may happen if the payment window was open for too long.';
        } else {
          specificGuidance = 'The payment process was interrupted before completion.';
        }
      }
      
      // Build clear, actionable message with status, reason, and next steps
      successMessage.innerHTML = `
        <div style="text-align: left; max-width: 600px; margin: 0 auto;">
          <!-- Status Explanation -->
          <div style="margin-bottom: 24px; padding: 16px; background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; border-radius: 4px;">
            <strong style="color: #f59e0b; display: block; margin-bottom: 8px; font-size: 16px;">Status: Payment Not Completed</strong>
            <p style="color: #d1d5db; margin: 0; line-height: 1.6;">${specificGuidance}</p>
          </div>
          
          <!-- Reassurance -->
          <div style="margin-bottom: 24px; padding: 16px; background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e; border-radius: 4px;">
            <p style="color: #9ca3af; margin: 0; line-height: 1.8;">
              <strong style="color: #22c55e;">✓</strong> Nothing was charged<br>
              <strong style="color: #22c55e;">✓</strong> Your order details are saved<br>
              <strong style="color: #22c55e;">✓</strong> No membership has been activated yet
            </p>
          </div>
          
          <!-- Actionable Steps -->
          <div style="color: #d1d5db; line-height: 1.8;">
            <strong style="color: #f59e0b; display: block; margin-bottom: 16px; font-size: 16px;">What you can do:</strong>
            
            <div style="margin-bottom: 16px; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 4px;">
              <strong style="color: #3b82f6; display: block; margin-bottom: 4px;">1. Try Again</strong>
              <p style="color: #9ca3af; margin: 0; font-size: 14px;">Click the button below to retry payment with the same details. Your order is saved and ready.</p>
            </div>
            
            <div style="margin-bottom: 16px; padding: 12px; background: rgba(139, 92, 246, 0.1); border-radius: 4px;">
              <strong style="color: #8b5cf6; display: block; margin-bottom: 4px;">2. Use a Different Payment Method</strong>
              <p style="color: #9ca3af; margin: 0; font-size: 14px;">If the issue persists, try a different card or payment method. Your order will remain the same.</p>
            </div>
            
            <div style="margin-bottom: 24px; padding: 12px; background: rgba(107, 114, 128, 0.1); border-radius: 4px;">
              <strong style="color: #6b7280; display: block; margin-bottom: 4px;">3. Contact Support</strong>
              <p style="color: #9ca3af; margin: 0; font-size: 14px;">If you continue to experience issues, our support team can help. Reference Order #${displayOrderId}</p>
            </div>
            
            <!-- Action Buttons -->
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px;">
              <button id="retry-payment-btn" style="flex: 1; min-width: 200px; padding: 14px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                Try Payment Again
              </button>
              <button id="contact-support-btn" style="flex: 1; min-width: 200px; padding: 14px 24px; background: transparent; color: #9ca3af; border: 2px solid #374151; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#6b7280'; this.style.color='#d1d5db'" onmouseout="this.style.borderColor='#374151'; this.style.color='#9ca3af'">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      `;
      
      // Add event listeners for action buttons
      setTimeout(() => {
        const retryBtn = document.getElementById('retry-payment-btn');
        const supportBtn = document.getElementById('contact-support-btn');
        
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            console.log('[Payment Failed] User clicked "Try Payment Again" - navigating to payment step');
            
            // CRITICAL: Restore cart and state from sessionStorage BEFORE navigating
            // This ensures cart is populated when showStep(4) runs
            try {
              const orderData = sessionStorage.getItem('boulders_checkout_order');
              if (orderData) {
                const storedOrder = JSON.parse(orderData);
                console.log('[Payment Retry] Restoring cart and state from sessionStorage:', storedOrder);
                
                // Always restore cart items (force restore, don't check if empty)
                if (storedOrder.cartItems) {
                  state.cartItems = storedOrder.cartItems;
                  console.log('[Payment Retry] ✅ Restored cart items:', state.cartItems.length, 'items');
                  
                  // CRITICAL: For punch cards, rebuild valueCardQuantities from cart items
                  // This is needed because valueCardQuantities is a Map and doesn't serialize to JSON
                  const punchCardItems = storedOrder.cartItems.filter(item => item.type === 'value-card');
                  if (punchCardItems.length > 0) {
                    console.log('[Payment Retry] Found punch card items, rebuilding valueCardQuantities');
                    state.valueCardQuantities.clear();
                    punchCardItems.forEach(item => {
                      // Use membershipPlanId format (punch-{id} or adult-punch/junior-punch)
                      // If membershipPlanId exists, use it; otherwise construct from productId
                      const planId = storedOrder.membershipPlanId || 
                                    (item.productId ? `punch-${item.productId}` : `punch-${item.id}`);
                      const quantity = item.quantity || 1;
                      state.valueCardQuantities.set(planId, quantity);
                      console.log('[Payment Retry] ✅ Rebuilt valueCardQuantities:', planId, '=', quantity);
                    });
                  }
                }
                if (storedOrder.totals) {
                  state.totals = { ...state.totals, ...storedOrder.totals };
                  console.log('[Payment Retry] ✅ Restored totals');
                }
                
                // Restore selectedProductType and selectedProductId if available
                if (storedOrder.selectedProductType) {
                  state.selectedProductType = storedOrder.selectedProductType;
                  console.log('[Payment Retry] ✅ Restored selectedProductType:', state.selectedProductType);
                }
                if (storedOrder.selectedProductId) {
                  state.selectedProductId = storedOrder.selectedProductId;
                  console.log('[Payment Retry] ✅ Restored selectedProductId:', state.selectedProductId);
                }
                
                if (storedOrder.membershipPlanId) {
                  state.membershipPlanId = storedOrder.membershipPlanId;
                  console.log('[Payment Retry] ✅ Restored membershipPlanId:', state.membershipPlanId);
                  
                  // CRITICAL: Derive selectedProductId and selectedProductType from membershipPlanId if not already set
                  // Handle all formats: campaign-, membership-, 15daypass-, punch-
                  if (!state.selectedProductType || !state.selectedProductId) {
                    if (typeof storedOrder.membershipPlanId === 'string') {
                      if (storedOrder.membershipPlanId.startsWith('campaign-')) {
                        const productId = storedOrder.membershipPlanId.replace('campaign-', '');
                        state.selectedProductId = parseInt(productId, 10) || productId;
                        state.selectedProductType = 'membership';
                        console.log('[Payment Retry] ✅ Derived selectedProductId from campaign:', state.selectedProductId);
                      } else if (storedOrder.membershipPlanId.startsWith('membership-')) {
                        const productId = storedOrder.membershipPlanId.replace('membership-', '');
                        state.selectedProductId = parseInt(productId, 10) || productId;
                        state.selectedProductType = 'membership';
                        console.log('[Payment Retry] ✅ Derived selectedProductId from membership:', state.selectedProductId);
                      } else if (storedOrder.membershipPlanId.startsWith('15daypass-')) {
                        const productId = storedOrder.membershipPlanId.replace('15daypass-', '');
                        state.selectedProductId = parseInt(productId, 10) || productId;
                        state.selectedProductType = 'membership';
                        console.log('[Payment Retry] ✅ Derived selectedProductId from 15daypass:', state.selectedProductId);
                      } else if (storedOrder.membershipPlanId.startsWith('punch-') || 
                                 storedOrder.membershipPlanId === 'adult-punch' || 
                                 storedOrder.membershipPlanId === 'junior-punch') {
                        // For punch cards, extract productId from membershipPlanId
                        if (storedOrder.membershipPlanId.startsWith('punch-')) {
                          const productId = storedOrder.membershipPlanId.replace('punch-', '');
                          state.selectedProductId = parseInt(productId, 10) || productId;
                        } else {
                          // For adult-punch/junior-punch, we need to find the productId from cart items
                          const punchCardItem = storedOrder.cartItems?.find(item => item.type === 'value-card');
                          if (punchCardItem) {
                            state.selectedProductId = punchCardItem.productId || punchCardItem.id;
                          }
                        }
                        state.selectedProductType = 'punch-card';
                        console.log('[Payment Retry] ✅ Derived selectedProductId from punch card:', state.selectedProductId);
                      }
                    }
                  }
                }
                if (storedOrder.selectedBusinessUnit) {
                  state.selectedBusinessUnit = storedOrder.selectedBusinessUnit;
                  console.log('[Payment Retry] ✅ Restored selectedBusinessUnit');
                }
                if (storedOrder.orderId) {
                  state.orderId = storedOrder.orderId;
                  console.log('[Payment Retry] ✅ Restored orderId');
                }
              }
            } catch (e) {
              console.warn('[Payment Retry] Could not restore cart from sessionStorage:', e);
            }
            
            // Reset payment failed state and navigate to step 4
            state.paymentFailed = false;
            state.currentStep = 4;
            showStep(4);
            updateStepIndicator();
            updateNavigationButtons();
            updateMainSubtitle();
            
            // CRITICAL: Update cart and payment overview after DOM is ready
            // Use setTimeout to ensure showStep(4) has finished rendering
            setTimeout(() => {
              updateCartSummary();
              
              // If order exists, fetch full order data for payment overview
              if (state.orderId) {
                console.log('[Payment Retry] Fetching order data for payment overview (orderId:', state.orderId, ')');
                orderAPI.getOrder(state.orderId)
                  .then(order => {
                    state.fullOrder = order;
                    updatePaymentOverview();
                    console.log('[Payment Retry] ✅ Order data fetched, payment overview updated');
                  })
                  .catch(error => {
                    console.warn('[Payment Retry] Could not fetch order data for payment overview:', error);
                    // Still update payment overview with available data
                    updatePaymentOverview();
                  });
              } else {
                // Update payment overview with current state data
                updatePaymentOverview();
              }
            }, 100);
            
            scrollToTop();
          });
        }
        
        if (supportBtn) {
          supportBtn.addEventListener('click', () => {
            console.log('[Payment Failed] User clicked "Contact Support"');
            // Open support email or support page
            const supportEmail = 'support@boulders.dk';
            const subject = encodeURIComponent(`Payment Issue - Order #${displayOrderId}`);
            const body = encodeURIComponent(`Hello,\n\nI experienced a payment issue with Order #${displayOrderId}.\n\nCould you please help me complete my membership purchase?\n\nThank you!`);
            window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
          });
        }
      }, 100);
      successMessage.style.color = '#d1d5db';
      successMessage.style.lineHeight = '1.6';
      successMessage.style.whiteSpace = 'normal';
      console.log('[Payment Failed] ✅ Message updated with clear status, reason, and actionable steps');
    }
    
    if (successBadge) {
      // Use a less alarming icon - info/warning circle instead of harsh X
      successBadge.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #f59e0b;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      `;
      console.log('[Payment Failed] ✅ Badge updated to calm info icon');
    }
    
    // CRITICAL: Hide order details, membership details, and "What happens next?" sections
    // These should only be shown when payment is successful
    // Use multiple methods to ensure they stay hidden
    const confirmationLayout = step5Panel.querySelector('.confirmation-layout');
    const confirmationLeft = step5Panel.querySelector('.confirmation-left');
    const confirmationRight = step5Panel.querySelector('.confirmation-right');
    
    const hideConfirmationSections = () => {
      if (confirmationLayout) {
        confirmationLayout.style.display = 'none';
        confirmationLayout.style.visibility = 'hidden';
        confirmationLayout.setAttribute('data-payment-failed', 'true');
      }
      if (confirmationLeft) {
        confirmationLeft.style.display = 'none';
        confirmationLeft.style.visibility = 'hidden';
        confirmationLeft.setAttribute('data-payment-failed', 'true');
      }
      if (confirmationRight) {
        confirmationRight.style.display = 'none';
        confirmationRight.style.visibility = 'hidden';
        confirmationRight.setAttribute('data-payment-failed', 'true');
      }
    };
    
    // Hide immediately
    hideConfirmationSections();
    console.log('[Payment Failed] ✅ Hidden confirmation sections');
    
    // Re-hide after a short delay in case something tries to show them
    setTimeout(() => {
      hideConfirmationSections();
      console.log('[Payment Failed] ✅ Re-checked and ensured confirmation sections are hidden');
    }, 100);
    
    // Also set up a MutationObserver to keep them hidden
    if (confirmationLayout && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const target = mutation.target;
            if (target.getAttribute('data-payment-failed') === 'true' && target.style.display !== 'none') {
              target.style.display = 'none';
              target.style.visibility = 'hidden';
              console.log('[Payment Failed] 🔒 Prevented confirmation section from being shown');
            }
          }
        });
      });
      
      [confirmationLayout, confirmationLeft, confirmationRight].forEach((el) => {
        if (el) {
          observer.observe(el, { attributes: true, attributeFilter: ['style'] });
        }
      });
    }
    
    console.log('[Payment Failed] ✅ HTML modified BEFORE showing panel');
  }
  
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();
  
  console.log('[Payment Failed] ✅ Payment failed page displayed');
}

function showPaymentPendingMessage(order, orderId) {
  // CRITICAL: Mark payment as pending to prevent success page from rendering
  state.paymentPending = true;
  state.paymentConfirmed = false;
  state.paymentFailed = false;
  
  // CRITICAL: Ensure we're on step 5 (confirmation page) before modifying elements
  // If we're not on the confirmation page yet, navigate to it first
  if (state.currentStep !== TOTAL_STEPS) {
    console.log('[Payment Pending] Navigating to confirmation page first...');
    state.currentStep = TOTAL_STEPS;
    showStep(TOTAL_STEPS);
    updateStepIndicator();
    updateNavigationButtons();
    updateMainSubtitle();
  }
  
  // Update the confirmation page to show payment pending instead of success
  const successTitle = document.querySelector('.success-title');
  const successMessage = document.querySelector('.success-message');
  const successBadge = document.querySelector('.success-badge');
  
  if (successTitle) {
    // CRITICAL: Remove data-i18n-key to prevent i18n from resetting the text
    successTitle.removeAttribute('data-i18n-key');
    successTitle.textContent = 'Payment Pending';
    successTitle.style.color = '#f59e0b'; // Orange/amber color
  }
  
  if (successMessage) {
    // CRITICAL: Remove data-i18n-key to prevent i18n from resetting the text
    successMessage.removeAttribute('data-i18n-key');
    const displayOrderId = orderId || order?.number || order?.id || 'N/A';
    successMessage.textContent = `Your payment is being processed. We're waiting for confirmation from the payment provider. Your membership will be activated once payment is confirmed. Order #${displayOrderId}`;
    successMessage.style.color = '#6b7280'; // Gray color
  }
  
  if (successBadge) {
    // Change checkmark to a clock/spinner icon
    successBadge.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #f59e0b;">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    `;
  }
  
  // CRITICAL: Hide order details, membership details, and "What happens next?" sections
  // These should only be shown when payment is confirmed
  const step5Panel = document.getElementById('step-5');
  if (step5Panel) {
    // Mark step 5 panel as payment pending for CSS targeting
    step5Panel.setAttribute('data-payment-pending', 'true');
    const confirmationLayout = step5Panel.querySelector('.confirmation-layout');
    const confirmationLeft = step5Panel.querySelector('.confirmation-left');
    const confirmationRight = step5Panel.querySelector('.confirmation-right');
    
    const hideConfirmationSections = () => {
      if (confirmationLayout) {
        confirmationLayout.style.display = 'none';
        confirmationLayout.style.visibility = 'hidden';
        confirmationLayout.setAttribute('data-payment-pending', 'true');
      }
      if (confirmationLeft) {
        confirmationLeft.style.display = 'none';
        confirmationLeft.style.visibility = 'hidden';
        confirmationLeft.setAttribute('data-payment-pending', 'true');
      }
      if (confirmationRight) {
        confirmationRight.style.display = 'none';
        confirmationRight.style.visibility = 'hidden';
        confirmationRight.setAttribute('data-payment-pending', 'true');
      }
    };
    
    // Hide immediately
    hideConfirmationSections();
    console.log('[Payment Pending] ✅ Hidden confirmation sections');
    
    // Re-hide after a short delay in case something tries to show them
    setTimeout(() => {
      hideConfirmationSections();
      console.log('[Payment Pending] ✅ Re-checked and ensured confirmation sections are hidden');
    }, 100);
  }
  
  // Show a message that the page will auto-refresh
  console.log('[Payment Pending] Showing payment pending message. Page will check payment status automatically.');
  
  // Only start polling if we have an orderId
  if (!orderId) {
    console.warn('[Payment Pending] No orderId provided, cannot poll for payment status');
    return;
  }
  
  // Poll for payment confirmation every 5 seconds (up to 2 minutes)
  let pollCount = 0;
  const maxPolls = 24; // 24 * 5 seconds = 2 minutes
  
  const pollInterval = setInterval(async () => {
    pollCount++;
    console.log(`[Payment Pending] Checking payment status (attempt ${pollCount}/${maxPolls})...`);
    
    try {
      const updatedOrder = await orderAPI.getOrder(orderId);
      const isPaymentConfirmed = updatedOrder.leftToPay?.amount === 0 || updatedOrder.leftToPay === 0;
      const isOrderPaid = updatedOrder.orderStatus?.name === 'Betalet' || updatedOrder.orderStatus?.id === 2;
      
      if (isPaymentConfirmed || isOrderPaid) {
        console.log('[Payment Pending] ✅ Payment confirmed! Reloading page to show success...');
        clearInterval(pollInterval);
        // Reload the page to show the success message
        window.location.reload();
      } else if (pollCount >= maxPolls) {
        console.warn('[Payment Pending] ⚠️ Payment still not confirmed after 2 minutes. Stopping auto-poll.');
        clearInterval(pollInterval);
        // Update message to tell user to check back later
        if (successMessage) {
          const displayOrderId = orderId || updatedOrder?.number || updatedOrder?.id || 'N/A';
          successMessage.textContent = `Payment is still being processed. Please check back in a few minutes or contact support if you've completed payment. Order #${displayOrderId}`;
        }
      }
    } catch (error) {
      console.error('[Payment Pending] Error checking payment status:', error);
      if (pollCount >= maxPolls) {
        clearInterval(pollInterval);
      }
    }
  }, 5000); // Check every 5 seconds
}

/**
 * Determine product type from order data
 * Returns: 'membership', '15daypass', or 'punch-card'
 */
function determineProductTypeFromOrder() {
  // Priority 1: Check test mode product type (if in test mode)
  if (state.testMode && state.testProductType) {
    console.log('[Product Type] Using test mode product type:', state.testProductType);
    return state.testProductType;
  }
  
  // Priority 2: Check full order data first (from API)
  if (state.fullOrder) {
    // Check for value card items (punch cards)
    if (state.fullOrder.valueCardItems && state.fullOrder.valueCardItems.length > 0) {
      console.log('[Product Type] Detected punch-card from valueCardItems');
      return 'punch-card';
    }
    
    // Check subscription items
    if (state.fullOrder.subscriptionItems && state.fullOrder.subscriptionItems.length > 0) {
      const subscriptionItem = state.fullOrder.subscriptionItems[0];
      const product = subscriptionItem?.product;
      
      // Check product labels to determine if it's a 15 day pass
      if (product?.productLabels && Array.isArray(product.productLabels)) {
        const has15DayPassLabel = product.productLabels.some(
          label => label.name && label.name.toLowerCase() === '15 day pass'
        );
        if (has15DayPassLabel) {
          console.log('[Product Type] Detected 15daypass from productLabels');
          return '15daypass';
        }
      }
      
      // Check product name for 15 day pass
      if (product?.name) {
        const nameLower = product.name.toLowerCase();
        if (nameLower.includes('15 day') || nameLower.includes('15 dage')) {
          console.log('[Product Type] Detected 15daypass from product name');
          return '15daypass';
        }
      }
      
      // Default to membership if it's a subscription item
      console.log('[Product Type] Detected membership from subscriptionItems');
      return 'membership';
    }
  }
  
  // Priority 3: Fall back to state.selectedProductType
  if (state.selectedProductType === 'punch-card') {
    console.log('[Product Type] Detected punch-card from selectedProductType');
    return 'punch-card';
  }
  
  // Priority 4: Check membershipPlanId format
  if (state.membershipPlanId) {
    if (String(state.membershipPlanId).startsWith('15daypass-')) {
      console.log('[Product Type] Detected 15daypass from membershipPlanId');
      return '15daypass';
    }
    if (String(state.membershipPlanId).startsWith('punch-')) {
      console.log('[Product Type] Detected punch-card from membershipPlanId');
      return 'punch-card';
    }
    // Default to membership for campaign, membership, etc.
    console.log('[Product Type] Detected membership from membershipPlanId');
    return 'membership';
  }
  
  // Priority 5: Check cart items
  if (state.cartItems && state.cartItems.length > 0) {
    const firstItem = state.cartItems[0];
    if (firstItem.type === 'value-card' || firstItem.type === 'punch-card') {
      console.log('[Product Type] Detected punch-card from cartItems');
      return 'punch-card';
    }
    if (firstItem.name && (firstItem.name.toLowerCase().includes('15 day') || firstItem.name.toLowerCase().includes('15 dage'))) {
      console.log('[Product Type] Detected 15daypass from cartItems');
      return '15daypass';
    }
  }
  
  // Default to membership
  console.log('[Product Type] Defaulting to membership');
  return 'membership';
}

function renderConfirmationView() {
  // CRITICAL: Don't render success page if payment failed or is pending (unless in test mode)
  if (!state.testMode && state.paymentFailed === true) {
    console.warn('[Confirmation] Payment failed - not rendering success page');
    return;
  }
  
  if (!state.testMode && state.paymentPending === true) {
    console.warn('[Confirmation] Payment pending - not rendering success page');
    return;
  }
  
  if (!state.order) {
    console.warn('[Confirmation] No order data available to render');
    return;
  }
  
  // CRITICAL: Only render if payment is confirmed OR we're in test mode
  if (!state.testMode && state.paymentConfirmed !== true) {
    console.warn('[Confirmation] Payment not confirmed - not rendering success page');
    return;
  }
  
  console.log('[Confirmation] ✅ Rendering success page - payment confirmed' + (state.testMode ? ' (test mode)' : ''));

  // CRITICAL: Show confirmation sections (order details, membership details, next steps) when payment succeeds
  const step5Panel = document.getElementById('step-5');
  if (step5Panel) {
    // Remove payment failed/pending attributes to allow CSS to show sections
    step5Panel.removeAttribute('data-payment-failed');
    step5Panel.removeAttribute('data-payment-pending');
    
    const confirmationLayout = step5Panel.querySelector('.confirmation-layout');
    const confirmationLeft = step5Panel.querySelector('.confirmation-left');
    const confirmationRight = step5Panel.querySelector('.confirmation-right');
    
    // Remove data attributes and show sections
    const showConfirmationSections = () => {
      if (confirmationLayout) {
        confirmationLayout.style.display = '';
        confirmationLayout.style.visibility = '';
        confirmationLayout.removeAttribute('data-payment-failed');
        confirmationLayout.removeAttribute('data-payment-pending');
      }
      if (confirmationLeft) {
        confirmationLeft.style.display = '';
        confirmationLeft.style.visibility = '';
        confirmationLeft.removeAttribute('data-payment-failed');
        confirmationLeft.removeAttribute('data-payment-pending');
      }
      if (confirmationRight) {
        confirmationRight.style.display = '';
        confirmationRight.style.visibility = '';
        confirmationRight.removeAttribute('data-payment-failed');
        confirmationRight.removeAttribute('data-payment-pending');
      }
    };
    
    showConfirmationSections();
    console.log('[Confirmation] ✅ Showing confirmation sections - payment confirmed');
  }

  // Determine product type
  const productType = determineProductTypeFromOrder();
  console.log('[Confirmation] Product type determined:', productType);
  console.log('[Confirmation] State for debugging:', {
    selectedProductType: state.selectedProductType,
    membershipPlanId: state.membershipPlanId,
    hasFullOrder: !!state.fullOrder,
    hasValueCardItems: !!(state.fullOrder?.valueCardItems?.length),
    hasSubscriptionItems: !!(state.fullOrder?.subscriptionItems?.length),
    productLabels: state.fullOrder?.subscriptionItems?.[0]?.product?.productLabels
  });

  // Update success message based on product type
  const successMessage = document.querySelector('.success-message');
  if (successMessage) {
    if (productType === 'membership') {
      successMessage.textContent = 'Dit medlemskab er blevet bekræftet! Du modtager en e-mail med alle detaljerne snart.';
    } else if (productType === '15daypass') {
      successMessage.textContent = 'Din 15-dages pas er blevet bekræftet! Du modtager en e-mail med alle detaljerne snart.';
    } else if (productType === 'punch-card') {
      successMessage.textContent = 'Dit klippekort er blevet bekræftet! Du modtager en e-mail med alle detaljerne snart.';
    } else {
      // Fallback to generic message
      successMessage.textContent = 'Din ordre er blevet bekræftet! Du modtager en e-mail med alle detaljerne snart.';
    }
  }

  // Update "What happens next?" steps based on product type
  const nextStep1 = document.getElementById('nextStep1');
  const nextStep2 = document.getElementById('nextStep2');
  const nextStep3 = document.getElementById('nextStep3');
  
  if (nextStep1) {
    // First step is always the same (email confirmation)
    nextStep1.textContent = 'E-mail bekræftelse sendt til din indbakke';
  }
  
  if (nextStep2 && nextStep3) {
    if (productType === 'membership') {
      nextStep2.textContent = 'Medlemskabsaktivering og automatisk fornyelse';
      nextStep3.textContent = 'Hent dit medlemskabskort i centeret';
    } else if (productType === '15daypass') {
      nextStep2.textContent = 'Dit pas er aktivt og klar til brug';
      nextStep3.textContent = 'Besøg centeret for at begynde at bruge dit pas';
    } else if (productType === 'punch-card') {
      nextStep2.textContent = 'Dit klippekort er klar til brug';
      nextStep3.textContent = 'Besøg centeret for at begynde at bruge dine klip';
    } else {
      // Fallback to membership steps
      nextStep2.textContent = 'Medlemskabsaktivering og automatisk fornyelse';
      nextStep3.textContent = 'Hent dit medlemskabskort i centeret';
    }
  }

  // Hide all sections first - use !important to override any CSS
  const membershipSection = document.getElementById('confirmationMembershipSection');
  const dayPassSection = document.getElementById('confirmation15DayPassSection');
  const punchCardSection = document.getElementById('confirmationPunchCardSection');
  
  if (membershipSection) {
    membershipSection.style.display = 'none';
    membershipSection.style.setProperty('display', 'none', 'important');
  }
  if (dayPassSection) {
    dayPassSection.style.display = 'none';
    dayPassSection.style.setProperty('display', 'none', 'important');
  }
  if (punchCardSection) {
    punchCardSection.style.display = 'none';
    punchCardSection.style.setProperty('display', 'none', 'important');
  }

  // Show appropriate section based on product type - only ONE section should be visible
  if (productType === 'membership' && membershipSection) {
    console.log('[Confirmation] Showing membership section');
    membershipSection.style.display = 'block';
    membershipSection.style.setProperty('display', 'block', 'important');
  } else if (productType === '15daypass' && dayPassSection) {
    console.log('[Confirmation] Showing 15 day pass section');
    dayPassSection.style.display = 'block';
    dayPassSection.style.setProperty('display', 'block', 'important');
  } else if (productType === 'punch-card' && punchCardSection) {
    console.log('[Confirmation] Showing punch card section');
    punchCardSection.style.display = 'block';
    punchCardSection.style.setProperty('display', 'block', 'important');
  } else {
    console.warn('[Confirmation] Unknown product type or section not found:', productType);
  }

  const { orderNumber, orderDate, orderTotal, memberName, membershipNumber, membershipType, primaryGym, membershipPrice } = DOM.confirmationFields;

  // Use API data only - no fallbacks to state.order or calculated values
  const apiOrder = state.fullOrder;
  
  // Order number - from API only
  if (orderNumber) {
    const number = apiOrder?.number || apiOrder?.id || '—';
    orderNumber.textContent = number;
  }
  
  // Order date - from API only
  if (orderDate) {
    if (apiOrder?.createdAt || apiOrder?.created) {
      const date = apiOrder.createdAt ? new Date(apiOrder.createdAt) : new Date(apiOrder.created);
      orderDate.textContent = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    } else {
      orderDate.textContent = '—';
    }
  }
  
  // Order total - from API only
  if (orderTotal) {
    if (apiOrder?.price?.amount) {
      const amount = apiOrder.price.amount;
      const total = typeof amount === 'object' ? amount.amount / 100 : amount / 100;
      orderTotal.textContent = formatCurrencyHalfKrone(total);
    } else if (apiOrder?.total) {
      const total = typeof apiOrder.total === 'object' ? apiOrder.total.amount / 100 : apiOrder.total / 100;
      orderTotal.textContent = formatCurrencyHalfKrone(total);
    } else {
      orderTotal.textContent = '—';
    }
  }
  
  // Member name - from API only
  if (memberName) {
    let name = '—';
    if (apiOrder?.customer) {
      const customer = apiOrder.customer;
      name = customer.fullName || 
            (customer.firstName && customer.lastName ? `${customer.firstName} ${customer.lastName}` : null) ||
            customer.name ||
            '—';
    }
    memberName.textContent = name;
    // Also update in other sections
    const dayPassMemberName = document.querySelector('#confirmation15DayPassSection [data-summary-field="member-name"]');
    const punchCardMemberName = document.querySelector('#confirmationPunchCardSection [data-summary-field="member-name"]');
    if (dayPassMemberName) dayPassMemberName.textContent = name;
    if (punchCardMemberName) punchCardMemberName.textContent = name;
  }
  
  // Membership-specific fields - from API only
  if (membershipNumber) {
    let membershipId = '—';
    if (apiOrder?.subscriptionItems?.[0]?.subscription?.id) {
      membershipId = apiOrder.subscriptionItems[0].subscription.id.toString();
    } else if (apiOrder?.customer?.id) {
      membershipId = apiOrder.customer.id.toString();
    }
    membershipNumber.textContent = membershipId;
  }
  
  if (membershipType) {
    const type = apiOrder?.subscriptionItems?.[0]?.product?.name || '—';
    membershipType.textContent = type;
  }
  
  if (primaryGym) {
    let gym = '—';
    if (apiOrder?.customer?.primaryGym) {
      gym = resolveGymLabel(apiOrder.customer.primaryGym);
    } else if (apiOrder?.businessUnit?.name) {
      gym = apiOrder.businessUnit.name;
    }
    primaryGym.textContent = gym;
    // Also update in other sections
    const dayPassGym = document.querySelector('#confirmation15DayPassSection [data-summary-field="primary-gym"]');
    if (dayPassGym) dayPassGym.textContent = gym;
  }
  
  if (membershipPrice) {
    let price = null;
    if (apiOrder?.subscriptionItems?.[0]?.payRecurring?.price?.amount) {
      const amount = apiOrder.subscriptionItems[0].payRecurring.price.amount;
      price = typeof amount === 'object' ? amount.amount / 100 : amount / 100;
    } else if (apiOrder?.subscriptionItems?.[0]?.price?.amount) {
      const amount = apiOrder.subscriptionItems[0].price.amount;
      price = typeof amount === 'object' ? amount.amount / 100 : amount / 100;
    }
    
    if (price !== null) {
      membershipPrice.textContent = `${formatCurrencyHalfKrone(roundToHalfKrone(price))}/month`;
    } else {
      membershipPrice.textContent = '—';
    }
  }
  
  // 15 Day Pass specific fields - from API only
  if (productType === '15daypass') {
    const passStartDate = document.querySelector('#confirmation15DayPassSection [data-summary-field="pass-start-date"]');
    const passEndDate = document.querySelector('#confirmation15DayPassSection [data-summary-field="pass-end-date"]');
    
    // Get start date from API subscription startDate only
    if (passStartDate) {
      if (apiOrder?.subscriptionItems?.[0]?.subscription?.startDate) {
        const startDate = new Date(apiOrder.subscriptionItems[0].subscription.startDate);
        passStartDate.textContent = new Intl.DateTimeFormat('da-DK', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(startDate);
      } else {
        passStartDate.textContent = '—';
      }
    }
    
    // Get end date from API subscription endDate only
    if (passEndDate) {
      if (apiOrder?.subscriptionItems?.[0]?.subscription?.endDate) {
        const endDate = new Date(apiOrder.subscriptionItems[0].subscription.endDate);
        passEndDate.textContent = new Intl.DateTimeFormat('da-DK', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(endDate);
      } else {
        passEndDate.textContent = '—';
      }
    }
  }
  
// Helper function to create purchase item element if template not available
function createPurchaseItemElement() {
  const item = document.createElement('div');
  item.className = 'purchase-item';
  item.setAttribute('data-confirmation-item', '');
  item.innerHTML = `
    <span class="item-name" data-element="name"></span>
    <span class="item-price" data-element="price"></span>
  `;
  return item;
}

  // Punch Card specific fields - from API only
  // Show aggregate info for all punch cards if multiple, or single card details
  if (productType === 'punch-card') {
    const punchCardType = document.querySelector('#confirmationPunchCardSection [data-summary-field="punch-card-type"]');
    const punchCardQuantity = document.querySelector('#confirmationPunchCardSection [data-summary-field="punch-card-quantity"]');
    const punchCardExpiry = document.querySelector('#confirmationPunchCardSection [data-summary-field="punch-card-expiry"]');
    
    // Use API valueCardItems data - aggregate if multiple cards
    const valueCardItems = apiOrder?.valueCardItems || [];
    const totalQuantity = valueCardItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    if (punchCardType) {
      // Show product name from first card, or indicate multiple types if different
      // Remove card number from name (e.g., "Klippekort: 10 Klip (400117054549)" -> "Klippekort: 10 Klip")
      if (valueCardItems.length > 0) {
        let firstCardName = valueCardItems[0]?.product?.name || 'Klippekort';
        // Remove card number in parentheses (e.g., " (400117054549)")
        firstCardName = firstCardName.replace(/\s*\(\d+\)\s*$/, '');
        
        if (valueCardItems.length === 1) {
          punchCardType.textContent = firstCardName;
        } else {
          // Multiple cards - show first card name with count
          punchCardType.textContent = `${firstCardName} (${valueCardItems.length} kort)`;
        }
      } else {
        punchCardType.textContent = '—';
      }
    }
    
    if (punchCardQuantity) {
      punchCardQuantity.textContent = totalQuantity > 0 ? totalQuantity.toString() : '—';
    }
    
    if (punchCardExpiry) {
      // Get expiry from first card (all should have same expiry)
      // Per OpenAPI: ValueCardItemOut has validUntil field, and ValueCardOut also has validUntil
      let expiryDate = null;
      const firstCard = valueCardItems[0];
      
      // Priority 1: Check valueCardItem.validUntil (direct field on the item)
      if (firstCard?.validUntil) {
        expiryDate = new Date(firstCard.validUntil);
      }
      // Priority 2: Check valueCard.validUntil (nested in valueCard object)
      else if (firstCard?.valueCard?.validUntil) {
        expiryDate = new Date(firstCard.valueCard.validUntil);
      }
      
      // Display expiry date from API, or show '—' if not available
      if (expiryDate && !isNaN(expiryDate.getTime())) {
        punchCardExpiry.textContent = new Intl.DateTimeFormat('da-DK', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(expiryDate);
      } else {
        punchCardExpiry.textContent = '—';
      }
    }
  }

  // Populate product details from full order (subscriptionItems/valueCardItems) or fallback to state.order.items
  if (DOM.confirmationItems) {
    DOM.confirmationItems.innerHTML = '';
    let hasItems = false;
    
    console.log('[Confirmation] Populating product details:', {
      hasTemplate: !!templates.confirmationItem,
      hasFullOrder: !!state.fullOrder,
      hasSubscriptionItems: !!(state.fullOrder?.subscriptionItems?.length),
      hasValueCardItems: !!(state.fullOrder?.valueCardItems?.length),
      hasOrderItems: !!(state.order?.items?.length),
      hasCartItems: !!(state.cartItems?.length),
      selectedProductId: state.selectedProductId,
      membershipPlanId: state.membershipPlanId
    });
    
    // Priority 1: Use fullOrder data (from API) for detailed product information
    if (state.fullOrder) {
      // Add subscription items (memberships, 15-day passes)
      if (state.fullOrder.subscriptionItems && state.fullOrder.subscriptionItems.length > 0) {
        state.fullOrder.subscriptionItems.forEach(item => {
          const node = templates.confirmationItem 
            ? templates.confirmationItem.content.firstElementChild.cloneNode(true)
            : createPurchaseItemElement();
          const nameEl = node.querySelector('[data-element="name"]') || node.querySelector('.item-name');
          const priceEl = node.querySelector('[data-element="price"]') || node.querySelector('.item-price');
          
          if (nameEl) {
            const productName = item.product?.name || 'Medlemskab';
            nameEl.textContent = productName;
          }
          
          if (priceEl) {
            // Per SubscriptionItemOut: price.amount is total price for all quantity
            const itemTotal = item.price?.amount ? (typeof item.price.amount === 'object' ? item.price.amount.amount / 100 : item.price.amount / 100) : 0;
            priceEl.textContent = formatCurrencyHalfKrone(roundToHalfKrone(itemTotal));
          }
          
          DOM.confirmationItems.appendChild(node);
          hasItems = true;
        });
      }
      
      // Add value card items (punch cards)
      if (state.fullOrder.valueCardItems && state.fullOrder.valueCardItems.length > 0) {
        state.fullOrder.valueCardItems.forEach(item => {
          const node = templates.confirmationItem 
            ? templates.confirmationItem.content.firstElementChild.cloneNode(true)
            : createPurchaseItemElement();
          const nameEl = node.querySelector('[data-element="name"]') || node.querySelector('.item-name');
          const priceEl = node.querySelector('[data-element="price"]') || node.querySelector('.item-price');
          
          if (nameEl) {
            let productName = item.product?.name || 'Klippekort';
            // Remove card number from product name (e.g., "Klippekort: 10 Klip (400117054549)" -> "Klippekort: 10 Klip")
            productName = productName.replace(/\s*\(\d+\)\s*$/, '');
            nameEl.textContent = productName;
          }
          
          if (priceEl) {
            // Per ValueCardItemOut: price.amount is total price for all quantity
            const itemTotal = item.price?.amount ? (typeof item.price.amount === 'object' ? item.price.amount.amount / 100 : item.price.amount / 100) : 0;
            priceEl.textContent = formatCurrencyHalfKrone(roundToHalfKrone(itemTotal));
          }
          
          DOM.confirmationItems.appendChild(node);
          hasItems = true;
        });
      }
    }
    
    // Priority 2: Fallback to state.order.items if fullOrder not available or has no items
    if (!hasItems && state.order?.items && state.order.items.length > 0) {
      state.order.items.forEach((item) => {
        const node = templates.confirmationItem 
          ? templates.confirmationItem.content.firstElementChild.cloneNode(true)
          : createPurchaseItemElement();
        const nameEl = node.querySelector('[data-element="name"]') || node.querySelector('.item-name');
        const priceEl = node.querySelector('[data-element="price"]') || node.querySelector('.item-price');
        if (nameEl) nameEl.textContent = item.name;
        if (priceEl) priceEl.textContent = formatCurrencyHalfKrone(roundToHalfKrone(item.amount));
        DOM.confirmationItems.appendChild(node);
        hasItems = true;
      });
    }
    
    // Priority 3: Fallback to state.cartItems if order.items is empty
    if (!hasItems && state.cartItems && state.cartItems.length > 0) {
      state.cartItems.forEach((item) => {
        const node = templates.confirmationItem 
          ? templates.confirmationItem.content.firstElementChild.cloneNode(true)
          : createPurchaseItemElement();
        const nameEl = node.querySelector('[data-element="name"]') || node.querySelector('.item-name');
        const priceEl = node.querySelector('[data-element="price"]') || node.querySelector('.item-price');
        if (nameEl) {
          // Remove quantity suffix if present (e.g., " ×2")
          const itemName = item.name?.replace(/\s×\d+$/, '') || item.name || 'Item';
          nameEl.textContent = itemName;
        }
        if (priceEl) {
          const itemPrice = item.price || item.amount || 0;
          priceEl.textContent = formatCurrencyHalfKrone(roundToHalfKrone(itemPrice));
        }
        DOM.confirmationItems.appendChild(node);
        hasItems = true;
      });
    }
    
    // Priority 4: Build from selected product if nothing else is available
    if (!hasItems && (state.selectedProductId || state.membershipPlanId)) {
      const node = templates.confirmationItem 
        ? templates.confirmationItem.content.firstElementChild.cloneNode(true)
        : createPurchaseItemElement();
      const nameEl = node.querySelector('[data-element="name"]') || node.querySelector('.item-name');
      const priceEl = node.querySelector('[data-element="price"]') || node.querySelector('.item-price');
      
      if (nameEl) {
        // Try to find product name from available product lists
        const allSubscriptions = [...(state.subscriptions || []), ...(state.dayPassSubscriptions || []), ...(state.campaignSubscriptions || [])];
        const allValueCards = state.valueCards || [];
        const allProducts = [...allSubscriptions, ...allValueCards];
        
        const productId = state.selectedProductId || state.membershipPlanId;
        const numericId = String(productId).replace(/^(campaign|membership|15daypass|punch)-/, '');
        const productIdNum = parseInt(numericId, 10);
        
        const foundProduct = allProducts.find(p => 
          p.id === productId || 
          p.id === productIdNum ||
          String(p.id) === numericId
        );
        
        const productName = foundProduct?.name || 
                           (state.selectedProductType === 'punch-card' ? 'Klippekort' : 'Medlemskab');
        nameEl.textContent = productName;
      }
      
      if (priceEl) {
        const itemPrice = state.totals?.membershipMonthly || state.totals?.cartTotal || state.order?.total || 0;
        priceEl.textContent = formatCurrencyHalfKrone(roundToHalfKrone(itemPrice));
      }
      
      DOM.confirmationItems.appendChild(node);
      hasItems = true;
    }
    
    // Log if no items were found
    if (!hasItems) {
      console.warn('[Confirmation] No product details available to display:', {
        hasFullOrder: !!state.fullOrder,
        hasSubscriptionItems: !!(state.fullOrder?.subscriptionItems?.length),
        hasValueCardItems: !!(state.fullOrder?.valueCardItems?.length),
        hasOrderItems: !!(state.order?.items?.length),
        hasCartItems: !!(state.cartItems?.length),
        selectedProductId: state.selectedProductId,
        membershipPlanId: state.membershipPlanId
      });
    }
  }
}

async function showDetailedReceipt() {
  if (!state.fullOrder && !state.order) {
    console.warn('[Receipt] No order data available');
    return;
  }
  
  const modal = document.getElementById('detailedReceiptModal');
  if (!modal) return;
  
  const order = state.fullOrder || state.order;
  
  // Fetch business unit details for seller information
  let businessUnit = null;
  if (order.businessUnit?.id || state.selectedBusinessUnit) {
    const businessUnitId = order.businessUnit?.id || state.selectedBusinessUnit;
    try {
      // Try to get from cached gymsWithDistances first (already loaded)
      if (gymsWithDistances && Array.isArray(gymsWithDistances)) {
        businessUnit = gymsWithDistances.find(bu => bu.id === businessUnitId || bu.id === parseInt(businessUnitId, 10));
      }
      
      // If not found, try state.gyms (from loadGymsFromAPI)
      if (!businessUnit && state.gyms && Array.isArray(state.gyms)) {
        businessUnit = state.gyms.find(bu => bu.id === businessUnitId || bu.id === parseInt(businessUnitId, 10));
      }
      
      // If still not found, fetch from API
      if (!businessUnit) {
        const businessUnitsAPI = new BusinessUnitsAPI();
        const allBusinessUnits = await businessUnitsAPI.getBusinessUnits();
        businessUnit = allBusinessUnits.find(bu => bu.id === businessUnitId || bu.id === parseInt(businessUnitId, 10));
      }
    } catch (error) {
      console.warn('[Receipt] Could not fetch business unit details:', error);
    }
  }
  
  // Populate receipt header
  const receiptOrderNumber = document.getElementById('receiptOrderNumber');
  const receiptDate = document.getElementById('receiptDate');
  if (receiptOrderNumber) {
    receiptOrderNumber.textContent = order.number || order.id || '—';
  }
  if (receiptDate) {
    const orderDate = order.createdAt ? new Date(order.createdAt) : (order.created ? new Date(order.created) : (order.date || new Date()));
    receiptDate.textContent = new Intl.DateTimeFormat('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(orderDate);
  }
  
  // Calculate totals - use API data structure per OrderOut schema
  const totalAmount = order.price?.amount || order.total || order.totalAmount || 0;
  const totalDKK = typeof totalAmount === 'object' ? (totalAmount.amount || totalAmount) / 100 : totalAmount / 100;
  
  // Use vatSums from API (per OrderOut.vatSums) instead of calculating
  let vatAmount = 0;
  if (order.vatSums && Array.isArray(order.vatSums) && order.vatSums.length > 0) {
    // Sum all VAT amounts from vatSums array
    vatAmount = order.vatSums.reduce((sum, vat) => {
      const vatValue = vat.amount ? (typeof vat.amount === 'object' ? vat.amount.amount / 100 : vat.amount / 100) : 0;
      return sum + vatValue;
    }, 0);
  } else {
    // Fallback: calculate 25% VAT if vatSums not available
    vatAmount = totalDKK * 0.25;
  }
  
  const subtotal = totalDKK - vatAmount;
  const discount = order.couponDiscount?.amount ? (typeof order.couponDiscount.amount === 'object' ? order.couponDiscount.amount.amount / 100 : order.couponDiscount.amount / 100) : 0;
  
  // Populate order overview
  const receiptSubtotal = document.getElementById('receiptSubtotal');
  const receiptDiscount = document.getElementById('receiptDiscount');
  const receiptTotal = document.getElementById('receiptTotal');
  const receiptVat = document.getElementById('receiptVat');
  
  if (receiptSubtotal) receiptSubtotal.textContent = formatCurrencyHalfKrone(subtotal);
  if (receiptDiscount) receiptDiscount.textContent = discount > 0 ? `-${formatCurrencyHalfKrone(discount)}` : '0,00 kr';
  if (receiptTotal) receiptTotal.textContent = formatCurrencyHalfKrone(totalDKK);
  if (receiptVat) receiptVat.textContent = formatCurrencyHalfKrone(vatAmount);
  
  // Populate payment details
  const receiptPaymentMethod = document.getElementById('receiptPaymentMethod');
  const receiptAmountPaid = document.getElementById('receiptAmountPaid');
  const receiptTransactionId = document.getElementById('receiptTransactionId');
  
  if (receiptPaymentMethod) {
    // Try to get payment method from order
    const paymentMethod = order.paymentMethod || order.payment?.method || 'Kortbetaling';
    receiptPaymentMethod.textContent = paymentMethod;
  }
  if (receiptAmountPaid) receiptAmountPaid.textContent = formatCurrencyHalfKrone(totalDKK);
  if (receiptTransactionId) {
    // Try to get transaction ID from order - check multiple possible fields
    const transactionId = order.externalId || 
                         order.transactionId || 
                         order.payment?.transactionId || 
                         order.payment?.id ||
                         order.paymentTransactions?.[0]?.transactionId ||
                         order.paymentTransactions?.[0]?.id ||
                         '—';
    receiptTransactionId.textContent = transactionId;
  }
  
  // Populate customer information - fetch full customer details if we only have a reference
  const receiptCustomerName = document.getElementById('receiptCustomerName');
  const receiptCustomerAddress = document.getElementById('receiptCustomerAddress');
  const receiptCustomerPhone = document.getElementById('receiptCustomerPhone');
  const receiptCustomerEmail = document.getElementById('receiptCustomerEmail');
  
  // Get customer - prefer full customer object, fallback to order.customer reference
  let customer = order.customer || state.customer || state.authenticatedCustomer;
  
  // If we only have customer ID (reference), fetch full customer details
  if (customer?.id && !customer.email && !customer.shippingAddress && !customer.billingAddress && !customer.mobilePhone) {
    try {
      const fullCustomer = await authAPI.getCustomer(customer.id);
      customer = fullCustomer;
      console.log('[Receipt] Fetched full customer details for receipt');
    } catch (error) {
      console.warn('[Receipt] Could not fetch full customer details:', error);
      // Continue with reference customer
    }
  }
  
  if (receiptCustomerName) {
    const name = customer?.fullName || 
                (customer?.firstName && customer?.lastName ? `${customer.firstName} ${customer.lastName}` : null) || 
                state.order?.memberName || 
                '—';
    receiptCustomerName.textContent = name;
  }
  
  if (receiptCustomerAddress) {
    // Use shippingAddress or billingAddress per CustomerOut schema (AddressOut)
    const addressObj = customer?.shippingAddress || customer?.billingAddress;
    if (addressObj) {
      const street = addressObj.street || '';
      const postalCode = addressObj.postalCode || '';
      const city = addressObj.city || '';
      const country = addressObj.country?.name || '';
      const address = `${street} ${postalCode}${city ? ', ' + city : ''}${country ? ' ' + country : ''}`.trim();
      receiptCustomerAddress.textContent = address || '—';
    } else {
      // Fallback for old structure
      const address = customer?.address ? 
        `${customer.address.street || ''} ${customer.address.streetNumber || ''} ${customer.address.postalCode || ''}, ${customer.address.city || ''}`.trim() :
        (customer?.addressLine1 ? `${customer.addressLine1} ${customer.postalCode || ''}, ${customer.city || ''}`.trim() : '—');
      receiptCustomerAddress.textContent = address || '—';
    }
  }
  
  if (receiptCustomerPhone) {
    // Use mobilePhone per CustomerOut schema (PhoneNumberOut)
    if (customer?.mobilePhone) {
      const countryCode = customer.mobilePhone.countryCode ? `+${customer.mobilePhone.countryCode}` : '';
      const number = customer.mobilePhone.number || '';
      receiptCustomerPhone.textContent = countryCode && number ? `${countryCode} ${number}` : number || '—';
    } else {
      // Fallback
      receiptCustomerPhone.textContent = customer?.phone || customer?.phoneNumber || '—';
    }
  }
  
  if (receiptCustomerEmail) {
    receiptCustomerEmail.textContent = customer?.email || '—';
  }
  
  // Populate seller information from business unit
  const receiptSellerName = document.getElementById('receiptSellerName');
  const receiptSellerAddress = document.getElementById('receiptSellerAddress');
  const receiptSellerCVR = document.getElementById('receiptSellerCVR');
  const receiptSellerPhone = document.getElementById('receiptSellerPhone');
  const receiptSellerEmail = document.getElementById('receiptSellerEmail');
  
  if (businessUnit) {
    // Per BusinessUnitOut schema: companyNameForInvoice, address, company
    if (receiptSellerName) {
      receiptSellerName.textContent = businessUnit.companyNameForInvoice || businessUnit.company?.name || businessUnit.name || 'Boulders ApS';
    }
    
    if (receiptSellerAddress && businessUnit.address) {
      // Per AddressOut schema: street, city, postalCode, country
      const street = businessUnit.address.street || '';
      const postalCode = businessUnit.address.postalCode || '';
      const city = businessUnit.address.city || '';
      const country = businessUnit.address.country?.name || '';
      const address = `${street} ${postalCode}${city ? ', ' + city : ''}${country ? ' ' + country : ''}`.trim();
      receiptSellerAddress.textContent = address || '—';
    } else if (receiptSellerAddress) {
      receiptSellerAddress.textContent = '—';
    }
    
    // CVR, Phone, Email might not be in BusinessUnitOut schema - check if available
    if (receiptSellerCVR) {
      // CVR might be in company object or business unit settings - not in schema, so use fallback
      receiptSellerCVR.textContent = businessUnit.cvr || businessUnit.company?.cvr || '32777651'; // Fallback to known value
    }
    
    if (receiptSellerPhone) {
      receiptSellerPhone.textContent = businessUnit.phone || businessUnit.contactPhone || '+45 72100019'; // Fallback
    }
    
    if (receiptSellerEmail) {
      receiptSellerEmail.textContent = businessUnit.email || businessUnit.contactEmail || 'medlem@boulders.dk'; // Fallback
    }
  } else {
    // Fallback to hardcoded values if business unit not available
    if (receiptSellerName) receiptSellerName.textContent = 'Boulders ApS';
    if (receiptSellerAddress) receiptSellerAddress.textContent = 'Graham Bells Vej 18A, 8200 Aarhus DK';
    if (receiptSellerCVR) receiptSellerCVR.textContent = '32777651';
    if (receiptSellerPhone) receiptSellerPhone.textContent = '+45 72100019';
    if (receiptSellerEmail) receiptSellerEmail.textContent = 'medlem@boulders.dk';
  }
  
  // Populate purchased items
  const receiptItems = document.getElementById('receiptItems');
  if (receiptItems) {
    receiptItems.innerHTML = '';
    
    // Add header row
    const headerRow = document.createElement('div');
    headerRow.className = 'receipt-item receipt-item-header';
    headerRow.innerHTML = `
      <div>Navn</div>
      <div>Antal</div>
      <div>TOTALT</div>
    `;
    receiptItems.appendChild(headerRow);
    
    // Add items from order - per OrderOut schema
    if (order.valueCardItems && order.valueCardItems.length > 0) {
      // Per ValueCardItemOut schema: price is total for all quantity, quantity is amount of cards
      order.valueCardItems.forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.className = 'receipt-item';
        let itemName = item.product?.name || 'Klippekort';
        // Remove card number from product name (e.g., "Klippekort: 10 Klip (400117054549)" -> "Klippekort: 10 Klip")
        itemName = itemName.replace(/\s*\(\d+\)\s*$/, '');
        const itemQuantity = item.quantity || 1;
        // Per ValueCardItemOut: price.amount is total price for all quantity (not per unit)
        const itemTotal = item.price?.amount ? (typeof item.price.amount === 'object' ? item.price.amount.amount / 100 : item.price.amount / 100) : 0;
        
        itemRow.innerHTML = `
          <div>${itemName}</div>
          <div>${itemQuantity}</div>
          <div>${formatCurrencyHalfKrone(itemTotal)}</div>
        `;
        receiptItems.appendChild(itemRow);
      });
    } else if (order.subscriptionItems && order.subscriptionItems.length > 0) {
      // Per SubscriptionItemOut schema: price is total for all quantity, quantity is amount of subscriptions
      order.subscriptionItems.forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.className = 'receipt-item';
        const itemName = item.product?.name || 'Medlemskab';
        const itemQuantity = item.quantity || 1;
        // Per SubscriptionItemOut: price.amount is total price for all quantity
        const itemTotal = item.price?.amount ? (typeof item.price.amount === 'object' ? item.price.amount.amount / 100 : item.price.amount / 100) : 0;
        
        itemRow.innerHTML = `
          <div>${itemName}</div>
          <div>${itemQuantity}</div>
          <div>${formatCurrencyHalfKrone(itemTotal)}</div>
        `;
        receiptItems.appendChild(itemRow);
      });
    } else if (state.order?.items && state.order.items.length > 0) {
      // Fallback to state.order.items
      state.order.items.forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.className = 'receipt-item';
        itemRow.innerHTML = `
          <div>${item.name || 'Item'}</div>
          <div>${item.quantity || 1}</div>
          <div>${formatCurrencyHalfKrone(item.amount || 0)}</div>
        `;
        receiptItems.appendChild(itemRow);
      });
    }
  }
  
  // Move modal to body to escape any parent stacking contexts
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  
  // Prevent background scrolling - save current scroll position
  const scrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
  
  // Show modal
  modal.style.display = 'flex';
}

function closeDetailedReceipt() {
  const modal = document.getElementById('detailedReceiptModal');
  if (modal) {
    modal.style.display = 'none';
    
    // Restore background scrolling - restore scroll position
    const scrollY = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    
    // Restore scroll position
    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
  }
}


function validateForm(animate = false) {
  let isValid = true;
  clearErrorStates();
  const skipPersonalValidation = isUserAuthenticated();

  if (!skipPersonalValidation) {
    REQUIRED_FIELDS.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && !field.value.trim()) {
        isValid = false;
        highlightFieldError(fieldId, animate);
      }
    });
  }

  if (!skipPersonalValidation && DOM.parentGuardianForm && DOM.parentGuardianForm.style.display !== 'none') {
    PARENT_REQUIRED_FIELDS.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && !field.value.trim()) {
        isValid = false;
        highlightFieldError(fieldId, animate);
      }
    });
  }

  if (!DOM.termsConsent?.checked) {
    isValid = false;
    if (animate) {
      showToast('Please accept the terms and conditions.', 'error');
      // Animate terms consent checkbox
      const termsConsent = DOM.termsConsent;
      if (termsConsent) {
        const formGroup = termsConsent.closest('.form-group') || termsConsent.closest('.consents-section');
        if (formGroup) {
          formGroup.classList.add('error');
          formGroup.style.animation = 'shake 0.5s ease-in-out';
          setTimeout(() => {
            formGroup.style.animation = '';
          }, 500);
        }
      }
    }
  }

  if (!state.paymentMethod) {
    isValid = false;
    if (animate) {
      // Animate payment method section
      const paymentMethods = document.querySelector('.payment-methods');
      if (paymentMethods) {
        paymentMethods.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
          paymentMethods.style.animation = '';
        }, 500);
      }
    }
  }

  // Card fields validation REMOVED - users are redirected to payment provider
  // Payment details are entered on the payment provider's secure page, not on our site
  // No need to validate card fields here since they won't be filled on this page

  return isValid;
}

function clearErrorStates() {
  [...REQUIRED_FIELDS, ...PARENT_REQUIRED_FIELDS, ...CARD_FIELDS].forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    const formGroup = field?.closest('.form-group');
    if (formGroup) {
      formGroup.classList.remove('error');
      formGroup.style.animation = ''; // Clear any animations
    }
  });
  
  // Also clear animations from consent and payment sections
  const consentsSection = document.querySelector('.consents-section');
  if (consentsSection) {
    consentsSection.classList.remove('error');
    consentsSection.style.animation = '';
  }
  
  const paymentMethods = document.querySelector('.payment-methods');
  if (paymentMethods) {
    paymentMethods.style.animation = '';
  }
}

function updateCheckoutButton() {
  if (!DOM.checkoutBtn) return;
  const termsAccepted = DOM.termsConsent?.checked ?? false;
  const hasMembership = Boolean(state.membershipPlanId);
  const hasPayment = Boolean(state.paymentMethod);

  DOM.checkoutBtn.disabled = !(termsAccepted && hasMembership && hasPayment);
}

// Helper function to manage loading state during checkout
function setCheckoutLoadingState(isLoading) {
  if (!DOM.checkoutBtn) return;
  
  DOM.checkoutBtn.disabled = isLoading;
  
  if (isLoading) {
    DOM.checkoutBtn.textContent = 'Processing...';
    DOM.checkoutBtn.classList.add('loading');
  } else {
    DOM.checkoutBtn.textContent = 'Checkout';
    DOM.checkoutBtn.classList.remove('loading');
    // Re-validate button state based on form
    updateCheckoutButton();
  }
}

function nextStep(fromStep) {
  // Use provided fromStep if available (prevents race conditions), otherwise use state.currentStep
  const currentStep = fromStep !== undefined ? fromStep : state.currentStep;
  
  if (currentStep >= TOTAL_STEPS) {
    return;
  }
  
  // CRITICAL: When going from step 1 (gym selection), always go to step 2 (membership selection)
  // Never skip to any other step - this prevents navigation bugs
  if (currentStep === 1) {
    state.currentStep = 2;
    showStep(2);
    updateStepIndicator();
    updateNavigationButtons();
    updateMainSubtitle();
    
    // Step 5: Load products when step 2 (access type selection) is shown
    if (state.selectedBusinessUnit) {
      // Only load if we don't already have products loaded
      const hasAnyProducts = (state.subscriptions?.length || 0) > 0 || 
                             (state.dayPassSubscriptions?.length || 0) > 0 || 
                             (state.valueCards?.length || 0) > 0;
      if (!hasAnyProducts) {
        loadProductsFromAPI();
      }
      // Update selected gym display
      setTimeout(() => {
        updateSelectedGymDisplay();
      }, 100);
    }
    
    // Scroll to top when navigating steps
    scrollToTop();
    setTimeout(() => {
      scrollToTop();
    }, 200);
    
    return; // Early return - don't continue with normal navigation logic
  }
  
  // advance to next visible panel (skip any hidden ones)
  let target = currentStep + 1;
  // Add-ons step (step 3) is disabled - always skip it
  if (target === 3) {
    target = 4; // Skip directly to step 4
  }
  // Ensure membership goes to Boost (step 3) right after Access (step 2) - DISABLED
  // if (state.currentStep === 2 && isMembershipSelected()) {
  //   target = 3;
  // }
  
  // If we're going from step 2 to step 4 (skipping step 3), don't check for hidden panels
  // Step 4 should always be shown when coming from step 2
  if (currentStep === 2 && target === 4) {
    // Don't enter the while loop - step 4 should be shown
  } else {
    while (target <= TOTAL_STEPS) {
      const panel = DOM.stepPanels[target - 1];
      if (!panel) break; // Panel doesn't exist
      // Skip step 3 check since step 3 is always hidden
      if (target === 3) {
        target = 4;
        continue;
      }
      // Check if panel is explicitly hidden via inline style
      // Don't check computed style to avoid skipping step 4 when it has CSS display:none
      const hidden = panel.style && panel.style.display === 'none';
      if (!hidden) break;
      target += 1;
      // Skip step 3 if we land on it
      if (target === 3) {
        target = 4;
      }
      // CRITICAL: Never skip to step 5 (success page) unless explicitly navigating from step 4
      // This prevents accidental navigation to success page
      if (target >= TOTAL_STEPS && currentStep !== 4) {
        console.warn('[Navigation] Prevented navigation to success page from step', currentStep);
        target = Math.min(currentStep + 1, 4); // Cap at step 4
        break;
      }
    }
  }
  state.currentStep = Math.min(target, TOTAL_STEPS);
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();
  
  // Scroll to top when navigating steps
  scrollToTop();
  setTimeout(() => {
    scrollToTop();
  }, 200);

  // Step 5: Load products when step 2 (access type selection) is shown
  if (state.currentStep === 2 && state.selectedBusinessUnit) {
    // Only load if we don't already have products loaded
    const hasAnyProducts = (state.subscriptions?.length || 0) > 0 || 
                           (state.dayPassSubscriptions?.length || 0) > 0 || 
                           (state.valueCards?.length || 0) > 0;
    if (!hasAnyProducts) {
      loadProductsFromAPI();
    }
    // Update selected gym display when step 2 is shown
    updateSelectedGymDisplay();
  }

  // Update cart when step 4 (Send/Info) is shown
  if (state.currentStep === 4) {
    updateCartSummary();
    // If user is logged in, ensure login tab is selected
    if (isUserAuthenticated()) {
      switchAuthMode('login');
      
      // If user is authenticated and has selected membership, ensure order is created
      // This allows payment overview to show correct prices
      if (state.membershipPlanId && state.selectedBusinessUnit && state.customerId) {
        console.log('[Payment Overview] Step 4 shown - ensuring order is created for payment overview');
        autoEnsureOrderIfReady('step-4-display')
          .then(() => {
            // Order should now be created and subscription attached
            // ensureSubscriptionAttached already fetches order and calls updatePaymentOverview()
            console.log('[Payment Overview] ✅ Order ensured on step 4');
          })
          .catch(error => {
            console.warn('[Payment Overview] Could not ensure order on step 4:', error);
          });
      }
    }
    
    // If order exists, fetch full order data for payment overview
    if (state.orderId && !state.fullOrder) {
      console.log('[Payment Overview] Step 4 shown - fetching order data for payment overview (orderId:', state.orderId, ')');
      orderAPI.getOrder(state.orderId)
        .then(order => {
          state.fullOrder = order;
          updatePaymentOverview();
          console.log('[Payment Overview] ✅ Order data fetched on step 4, payment overview updated');
          console.log('[Payment Overview] Order price:', order.price?.amount, 'SubscriptionItems:', order.subscriptionItems?.length);
        })
        .catch(error => {
          console.warn('[Payment Overview] Could not fetch order data on step 4:', error);
        });
    } else if (state.fullOrder) {
      // Full order data already available - just update payment overview
      updatePaymentOverview();
    }
  }

  // Scroll to top on mobile only
  if (window.innerWidth <= 768) {
    scrollToTop();
    setTimeout(() => {
      scrollToTop();
    }, 200);
  }

  // CRITICAL: Only show success page (step 5) if there's actually a completed order
  // Never navigate to success page unless purchase is actually successful
  // EXCEPTION: Allow test mode via URL parameter ?testSuccess=true
  if (state.currentStep === TOTAL_STEPS) {
    // Check URL parameters for test mode
    const urlParams = new URLSearchParams(window.location.search);
    const testMode = urlParams.get('testSuccess') === 'true';
    const testProductType = urlParams.get('testProductType') || 'membership'; // membership, 15daypass, punch-card
    
    // CRITICAL: Check if payment is actually confirmed before showing success page
    // Don't show success page if payment failed (401 error) or payment is pending
    // Test mode bypasses this check
    if (!testMode) {
      const isPaymentFailed = state.paymentFailed === true;
      const isPaymentPending = state.paymentPending === true;
      
      if (isPaymentFailed || isPaymentPending) {
        console.log('[Navigation] Payment failed or pending - not rendering success page');
        // Don't render success page - the failed/pending message functions handle the UI
        return;
      }
    }
    
    // Only render confirmation if we have order data AND (payment is confirmed OR we're in test mode)
    // This prevents showing success page when user hasn't completed purchase (unless in test mode)
    if ((state.order && state.orderId && (state.paymentConfirmed !== false || testMode)) || testMode) {
      if (testMode) {
        // Use test product type from state if available, otherwise from URL
        const productType = state.testProductType || testProductType;
        console.log('[Test Mode] Creating mock order data for testing:', productType);
        
        // Create mock order data for testing
        state.order = {
          number: 'TEST-12345',
          date: new Date(),
          items: [
            { name: productType === 'membership' ? 'Membership' : productType === '15daypass' ? '15 Day Pass' : 'Punch Card', amount: 469 }
          ],
          total: 469,
          memberName: 'Test User',
          membershipNumber: 'TEST-12345',
          membershipType: productType === 'membership' ? 'Medlemskab' : productType === '15daypass' ? '15 Day Pass' : 'Punch Card',
          primaryGym: 'Boulders Aarhus Nord',
          membershipPrice: 469,
        };
        state.orderId = 'TEST-12345';
        
        // Set product type for test mode - ensure state is set correctly
        state.testMode = true;
        state.testProductType = productType;
        state.paymentConfirmed = true; // Set payment confirmed for test mode
        state.paymentFailed = false;
        state.paymentPending = false;
        
        // Set product type for test mode
        if (productType === 'punch-card') {
          state.selectedProductType = 'punch-card';
          // Mock value card items with price
          state.fullOrder = {
            valueCardItems: [{
              quantity: 2,
              product: { name: 'Klippekort', productLabels: [] },
              valueCard: { number: '12345', numberOfPassages: 10 },
              price: { amount: 46900 } // 469.00 DKK in cents
            }]
          };
        } else if (productType === '15daypass') {
          state.selectedProductType = 'membership';
          state.membershipPlanId = '15daypass-123';
          // Mock subscription items with 15 day pass label and price
          state.fullOrder = {
            subscriptionItems: [{
              product: {
                name: '15 Day Pass',
                productLabels: [{ name: '15 Day Pass' }]
              },
              price: { amount: 46900 } // 469.00 DKK in cents
            }]
          };
        } else {
          // Default to membership
          state.selectedProductType = 'membership';
          state.membershipPlanId = 'membership-123';
          // Mock subscription items with price
          state.fullOrder = {
            subscriptionItems: [{
              product: {
                name: 'Medlemskab',
                productLabels: [{ name: 'Public' }]
              },
              price: { amount: 46900 } // 469.00 DKK in cents
            }]
          };
        }
        
        console.log('[Test Mode] Mock data created:', {
          productType: productType,
          selectedProductType: state.selectedProductType,
          membershipPlanId: state.membershipPlanId,
          hasValueCardItems: !!(state.fullOrder?.valueCardItems?.length),
          hasSubscriptionItems: !!(state.fullOrder?.subscriptionItems?.length)
        });
      }
      renderConfirmationView();
    } else {
      // If we somehow ended up on step 5 without an order, go back to step 1
      console.warn('[Navigation] Attempted to show success page without order data or payment not confirmed. Not rendering success page.');
      console.warn('[Navigation] To test success page, add ?testSuccess=true&testProductType=membership|15daypass|punch-card to URL');
      // Don't redirect - let the payment failed/pending handlers show the appropriate message
    }
  }
}

function prevStep() {
  if (state.currentStep <= 1) return;
  
  // Clear any pending navigation timeouts when going back
  // This prevents stale timeouts from navigating after user changes selection
  Object.keys(pendingNavigationTimeouts).forEach(key => {
    if (pendingNavigationTimeouts[key]) {
      clearTimeout(pendingNavigationTimeouts[key]);
      pendingNavigationTimeouts[key] = null;
    }
  });
  
  // go back to previous visible panel (skip any hidden ones)
  let target = state.currentStep - 1;
  // Add-ons step (step 3) is disabled - always skip it
  if (target === 3) {
    target = 2; // Go back to step 2 instead
  }
  while (target >= 1) {
    const panel = DOM.stepPanels[target - 1];
    const hidden = panel && panel.style && panel.style.display === 'none';
    if (!hidden) break;
    target -= 1;
    // Skip step 3 if we land on it
    if (target === 3) {
      target = 2;
    }
  }
  state.currentStep = Math.max(target, 1);
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();

  // Scroll to top when navigating steps
  scrollToTop();
  setTimeout(() => {
    scrollToTop();
  }, 200);
  
  // Show access heads-up if going back to step 2 and a plan is selected
  if (state.currentStep === 2 && state.membershipPlanId) {
    const selectedCard = document.querySelector(`[data-plan="${state.membershipPlanId}"]`);
    if (selectedCard) {
        // Ensure the card is selected visually
        // Clear all selections first
        document.querySelectorAll('.plan-card').forEach(c => {
          c.classList.remove('selected', 'has-quantity');
          // Hide quantity selector for all cards
          const selector = c.querySelector('.quantity-selector');
          if (selector) {
            selector.style.display = 'none';
          }
        });
        
        // Select the previously selected card
        selectedCard.classList.add('selected');
        
        // If it's a punch card, restore quantity panel and disabled state
        const category = selectedCard.closest('.category-item').dataset.category;
        if (category === 'punchcard' && state.valueCardQuantities.has(state.membershipPlanId)) {
          selectedCard.classList.add('has-quantity');
          const panel = selectedCard.nextElementSibling;
          if (panel && panel.classList.contains('quantity-panel')) {
            panel.classList.add('show');
            panel.style.display = 'block';
            syncPunchCardQuantityUI(selectedCard, state.membershipPlanId);
          }
          
          // Grey out the other punch card type
          const otherPunchCard = document.querySelector(`[data-plan="${state.membershipPlanId === 'adult-punch' ? 'junior-punch' : 'adult-punch'}"]`);
          if (otherPunchCard) {
            otherPunchCard.classList.add('disabled');
          }
        }
        
        // Show heads-up for previously selected access type
        updateAccessHeadsUp(selectedCard);
      }
    }
}

function showStep(stepNumber) {
  
  DOM.stepPanels.forEach((panel, index) => {
    const isActive = index + 1 === stepNumber;
    panel.classList.toggle('active', isActive);
    // Ensure display style is set correctly
    if (isActive) {
      panel.style.display = 'block';
      panel.style.visibility = 'visible';
      panel.style.opacity = '1';
    } else {
      // Only hide if not already hidden by other logic (like step 3)
      if (panel.id !== 'step-3') {
        panel.style.display = 'none';
      }
    }
  });
  
  // Scroll to top when showing a step
  scrollToTop();
  setTimeout(() => {
    scrollToTop();
  }, 100);
  
  // Remove flex and margin from step-content when step 5 (success page) is active
  const stepContent = document.querySelector('.step-content');
  if (stepContent) {
    if (stepNumber === TOTAL_STEPS) {
      stepContent.style.marginTop = '0';
      stepContent.style.flex = 'none'; // Prevent container from expanding
    } else {
      stepContent.style.marginTop = ''; // Reset to CSS default (50px)
      stepContent.style.flex = ''; // Reset to CSS default (flex: 1)
    }
  }
  
  // Update selected gym display when showing step 2
  if (stepNumber === 2) {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      updateSelectedGymDisplay();
      
      // CRITICAL: Restore selectedBusinessUnit from sessionStorage if missing
      if (!state.selectedBusinessUnit) {
        try {
          const orderData = sessionStorage.getItem('boulders_checkout_order');
          if (orderData) {
            const storedOrder = JSON.parse(orderData);
            if (storedOrder.selectedBusinessUnit) {
              state.selectedBusinessUnit = storedOrder.selectedBusinessUnit;
              console.log('[showStep] Step 2 - Restored selectedBusinessUnit from sessionStorage:', state.selectedBusinessUnit);
            }
          }
        } catch (e) {
          console.warn('[showStep] Could not restore selectedBusinessUnit:', e);
        }
      }
      
      // CRITICAL: Load products if business unit is selected but products aren't loaded
      if (state.selectedBusinessUnit) {
        const hasAnyProducts = (state.subscriptions?.length || 0) > 0 || 
                               (state.dayPassSubscriptions?.length || 0) > 0 || 
                               (state.valueCards?.length || 0) > 0;
        if (!hasAnyProducts) {
          console.log('[showStep] Step 2 shown - loading products for business unit:', state.selectedBusinessUnit);
          loadProductsFromAPI()
            .then(() => {
              console.log('[showStep] ✅ Products loaded, rendering...');
              renderProductsFromAPI();
            })
            .catch(error => {
              console.error('[showStep] ❌ Failed to load products:', error);
            });
        } else {
          // Products already loaded, just render them
          console.log('[showStep] Products already loaded, rendering...');
          renderProductsFromAPI();
        }
      } else {
        console.warn('[showStep] Step 2 shown but no business unit selected - cannot load products');
      }
    }, 100);
  }
  
  // Update cart and payment overview when showing step 4 (payment step)
  if (stepNumber === 4) {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      // CRITICAL: Restore cart from sessionStorage if empty
      if ((!state.cartItems || state.cartItems.length === 0) && state.orderId) {
        try {
          const orderData = sessionStorage.getItem('boulders_checkout_order');
          if (orderData) {
            const storedOrder = JSON.parse(orderData);
            if (storedOrder.cartItems) {
              state.cartItems = storedOrder.cartItems;
              console.log('[showStep] Step 4 - Restored cart items from sessionStorage:', state.cartItems.length, 'items');
              
              // CRITICAL: For punch cards, rebuild valueCardQuantities from cart items
              // This is needed because valueCardQuantities is a Map and doesn't serialize to JSON
              const punchCardItems = storedOrder.cartItems.filter(item => item.type === 'value-card');
              if (punchCardItems.length > 0) {
                console.log('[showStep] Step 4 - Found punch card items, rebuilding valueCardQuantities');
                state.valueCardQuantities.clear();
                punchCardItems.forEach(item => {
                  // Use membershipPlanId format (punch-{id} or adult-punch/junior-punch)
                  const planId = storedOrder.membershipPlanId || 
                                (item.productId ? `punch-${item.productId}` : `punch-${item.id}`);
                  const quantity = item.quantity || 1;
                  state.valueCardQuantities.set(planId, quantity);
                  console.log('[showStep] Step 4 - Rebuilt valueCardQuantities:', planId, '=', quantity);
                });
              }
            }
            if (storedOrder.totals) {
              state.totals = { ...state.totals, ...storedOrder.totals };
            }
            
            // Restore selectedProductType and selectedProductId if available
            if (storedOrder.selectedProductType) {
              state.selectedProductType = storedOrder.selectedProductType;
              console.log('[showStep] Step 4 - Restored selectedProductType:', state.selectedProductType);
            }
            if (storedOrder.selectedProductId) {
              state.selectedProductId = storedOrder.selectedProductId;
              console.log('[showStep] Step 4 - Restored selectedProductId:', state.selectedProductId);
            }
            
            if (storedOrder.membershipPlanId && !state.membershipPlanId) {
              state.membershipPlanId = storedOrder.membershipPlanId;
              
              // CRITICAL: Derive selectedProductId and selectedProductType from membershipPlanId if not already set
              // Handle all formats: campaign-, membership-, 15daypass-, punch-
              if (!state.selectedProductType || !state.selectedProductId) {
                if (typeof storedOrder.membershipPlanId === 'string') {
                  if (storedOrder.membershipPlanId.startsWith('campaign-')) {
                    const productId = storedOrder.membershipPlanId.replace('campaign-', '');
                    state.selectedProductId = parseInt(productId, 10) || productId;
                    state.selectedProductType = 'membership';
                    console.log('[showStep] Step 4 - Derived selectedProductId from campaign:', state.selectedProductId);
                  } else if (storedOrder.membershipPlanId.startsWith('membership-')) {
                    const productId = storedOrder.membershipPlanId.replace('membership-', '');
                    state.selectedProductId = parseInt(productId, 10) || productId;
                    state.selectedProductType = 'membership';
                    console.log('[showStep] Step 4 - Derived selectedProductId from membership:', state.selectedProductId);
                  } else if (storedOrder.membershipPlanId.startsWith('15daypass-')) {
                    const productId = storedOrder.membershipPlanId.replace('15daypass-', '');
                    state.selectedProductId = parseInt(productId, 10) || productId;
                    state.selectedProductType = 'membership';
                    console.log('[showStep] Step 4 - Derived selectedProductId from 15daypass:', state.selectedProductId);
                  } else if (storedOrder.membershipPlanId.startsWith('punch-') || 
                             storedOrder.membershipPlanId === 'adult-punch' || 
                             storedOrder.membershipPlanId === 'junior-punch') {
                    // For punch cards, extract productId from membershipPlanId
                    if (storedOrder.membershipPlanId.startsWith('punch-')) {
                      const productId = storedOrder.membershipPlanId.replace('punch-', '');
                      state.selectedProductId = parseInt(productId, 10) || productId;
                    } else {
                      // For adult-punch/junior-punch, we need to find the productId from cart items
                      const punchCardItem = storedOrder.cartItems?.find(item => item.type === 'value-card');
                      if (punchCardItem) {
                        state.selectedProductId = punchCardItem.productId || punchCardItem.id;
                      }
                    }
                    state.selectedProductType = 'punch-card';
                    console.log('[showStep] Step 4 - Derived selectedProductId from punch card:', state.selectedProductId);
                  }
                }
              }
            }
            if (storedOrder.selectedBusinessUnit && !state.selectedBusinessUnit) {
              state.selectedBusinessUnit = storedOrder.selectedBusinessUnit;
            }
          }
        } catch (e) {
          console.warn('[showStep] Could not restore cart from sessionStorage:', e);
        }
      }
      
      updateCartSummary();
      // If order exists, update payment overview
      if (state.orderId && state.fullOrder) {
        updatePaymentOverview();
      }
    }, 100);
  } else {
    // When leaving step 2, reset main content margin
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
      mainContent.style.marginTop = '';
    }
  }
  
  // If showing step 4, ensure country selectors are populated
  if (stepNumber === 4) {
    // Ensure countries are loaded (in case they weren't loaded on init)
    const countryCodeSelect = document.getElementById('countryCode');
    const parentCountryCodeSelect = document.getElementById('parentCountryCode');
    if (countryCodeSelect && countryCodeSelect.options.length <= 1) {
      // Only one option (the default +45), so countries haven't been loaded yet
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isDevelopment) {
        console.log('[Step 4] Country selectors not populated, loading countries...');
      }
      loadCountriesFromAPI();
    }
  }
  
  // If showing step 4 and user is logged in, ensure login tab is selected
  if (stepNumber === 4 && isUserAuthenticated()) {
    switchAuthMode('login');
  } else if (stepNumber === 4 && !isUserAuthenticated()) {
    // Update switch button visibility when showing step 4
    const switchBtns = document.querySelectorAll('.auth-mode-switch-btn');
    switchBtns.forEach(btn => {
      btn.style.display = '';
    });
  }
  
  // Default to create account form when showing step 4 (if not authenticated)
  if (stepNumber === 4 && !isUserAuthenticated()) {
    // Initialize auth mode toggle immediately
    initAuthModeToggle();
    
    // Ensure create account form is visible
    setTimeout(() => {
      const loginSection = document.querySelector('[data-auth-section="login"]');
      const createSection = document.querySelector('[data-auth-section="create"]');
      
      if (loginSection && createSection) {
        // Activate create account mode
        switchAuthMode('create');
        
        // Ensure sections are properly displayed
        createSection.style.display = 'block';
        createSection.style.visibility = 'visible';
        createSection.style.opacity = '1';
        loginSection.style.display = 'none';
      }
    }, 50);
  }
  
  // If showing step 4 and order data is available, update payment overview
  if (stepNumber === 4 && state.orderId && !state.fullOrder) {
    // Order ID exists but full order data not loaded - fetch it
    orderAPI.getOrder(state.orderId)
      .then(order => {
        state.fullOrder = order;
        updatePaymentOverview();
        console.log('[Payment Overview] Order data fetched and payment overview updated on step 4');
      })
      .catch(error => {
        console.warn('[Payment Overview] Could not fetch order data on step 4:', error);
      });
  } else if (stepNumber === 4 && state.fullOrder) {
    // Full order data already available - just update payment overview
    updatePaymentOverview();
  }
}

function updateStepIndicator() {
  const stepIndicator = document.querySelector('.step-indicator');
  if (!stepIndicator) return;

  if (state.currentStep === TOTAL_STEPS) {
    stepIndicator.classList.add('hidden');
  } else {
    stepIndicator.classList.remove('hidden');
  }
  
  // Add class when on step 2 to remove top margin (selected gym display is visible)
  if (state.currentStep === 2) {
    stepIndicator.classList.add('step-2-active');
  } else {
    stepIndicator.classList.remove('step-2-active');
  }

  // Map state.currentStep to indicator step index
  // Step 1 → indicator 0 (Home Gym)
  // Step 2 → indicator 1 (Access)
  // Step 3 → skipped (Boost is hidden)
  // Step 4 → indicator 2 (Send)
  // Step 5 → hide indicator (handled above)
  let visibleCurrentIndex = -1;
  if (state.currentStep === 1) {
    visibleCurrentIndex = 0;
  } else if (state.currentStep === 2) {
    visibleCurrentIndex = 1;
  } else if (state.currentStep === 4) {
    visibleCurrentIndex = 2;
  } else {
    // For step 5 or any other step, hide indicator (already handled above)
    return;
  }

  console.log('[Step Indicator] Updating:', {
    currentStep: state.currentStep,
    visibleCurrentIndex: visibleCurrentIndex
  });

  // Work only with visible indicator steps (Boost is hidden by applyConditionalSteps)
  const indicatorSteps = Array.from(document.querySelectorAll('.step'))
    .filter((s) => !s.classList.contains('hidden'));
  const indicatorCircles = indicatorSteps.map((s) => s.querySelector('.step-circle')).filter(Boolean);
  const indicatorConnectors = Array.from(document.querySelectorAll('.step-connector'))
    .filter((c) => !c.classList.contains('hidden'));

  indicatorCircles.forEach((circle, index) => {
    const isCompleted = index < visibleCurrentIndex;
    const isActive = index === visibleCurrentIndex;
    circle.classList.toggle('completed', isCompleted);
    circle.classList.toggle('active', isActive);
    circle.classList.toggle('inactive', !isActive && !isCompleted);

    if (isCompleted) {
      circle.innerHTML =
        '<svg class="checkmark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    } else {
      circle.textContent = String(index + 1);
    }

    const step = circle.closest('.step');
    if (step) {
      step.classList.toggle('completed', isCompleted);
      step.classList.toggle('active', isActive);
      step.classList.toggle('inactive', !isActive && !isCompleted);
    }
  });

  indicatorConnectors.forEach((connector, index) => {
    const wasCompleted = connector.classList.contains('completed');
    const isNowCompleted = index < visibleCurrentIndex;
    
    connector.classList.toggle('completed', isNowCompleted);
    
    // Trigger animation when connector becomes completed
    if (!wasCompleted && isNowCompleted) {
      connector.classList.add('animating');
      setTimeout(() => {
        connector.classList.remove('animating');
      }, 600);
    }
  });
  
  // Update selected gym display (show only on step 2)
  updateSelectedGymDisplay();
}

function updateSelectedGymDisplay() {
  const selectedGymDisplay = document.getElementById('selectedGymDisplay');
  const selectedGymNameDisplay = document.getElementById('selectedGymNameDisplay');
  const mainContent = document.getElementById('mainContent');
  
  if (!selectedGymDisplay || !selectedGymNameDisplay) {
    console.warn('[Selected Gym Display] Elements not found', {
      display: !!selectedGymDisplay,
      nameDisplay: !!selectedGymNameDisplay
    });
    return;
  }
  
  // Always hide first, then show only if we have a valid name
  selectedGymDisplay.style.display = 'none';
  selectedGymNameDisplay.textContent = '-'; // Reset to default
  
  // Reset main content margin when hiding display (for all steps except step 2)
  if (mainContent && state.currentStep !== 2) {
    mainContent.style.marginTop = '';
  }
  
  // Show only on step 2 if a gym is selected
  if (state.currentStep === 2 && state.selectedBusinessUnit) {
    let gymName = null;
    
    console.log('[Selected Gym Display] Looking for gym:', {
      currentStep: state.currentStep,
      selectedBusinessUnit: state.selectedBusinessUnit,
      storedGymName: state.selectedGymName,
      gymsWithDistancesLength: gymsWithDistances?.length || 0
    });
    
    // Priority 1: Use stored gym name from state (most reliable)
    if (state.selectedGymName && state.selectedGymName.trim() !== '') {
      gymName = state.selectedGymName.trim();
      console.log('[Selected Gym Display] Using stored name:', gymName);
    }
    // Priority 2: Try to get from DOM element (if step 1 is still visible)
    else {
      const gymDataId = `gym-${state.selectedBusinessUnit}`;
      const selectedGymItem = document.querySelector(`[data-gym-id="${gymDataId}"]`);
      console.log('[Selected Gym Display] Looking for DOM element:', gymDataId, 'Found:', !!selectedGymItem);
      if (selectedGymItem) {
        const gymNameElement = selectedGymItem.querySelector('.gym-name');
        if (gymNameElement) {
          gymName = gymNameElement.textContent.trim();
          if (gymName) {
            // Store it for future use
            state.selectedGymName = gymName;
            console.log('[Selected Gym Display] Found in DOM:', gymName);
          }
        }
      }
    }
    
    // Priority 3: Fallback to gymsWithDistances array
    if (!gymName && gymsWithDistances && gymsWithDistances.length > 0) {
      console.log('[Selected Gym Display] Searching in gymsWithDistances array...');
      const selectedGym = gymsWithDistances.find(gym => 
        String(gym.id) === String(state.selectedBusinessUnit)
      );
      console.log('[Selected Gym Display] Found gym in array:', selectedGym);
      if (selectedGym && selectedGym.name && selectedGym.name.trim() !== '') {
        gymName = selectedGym.name.trim();
        // Store it for future use
        state.selectedGymName = gymName;
        console.log('[Selected Gym Display] Found in array:', gymName);
      }
    }
    
    // Only show if we have a valid gym name
    if (gymName && gymName.trim() !== '' && gymName !== '-') {
      selectedGymNameDisplay.textContent = gymName;
      selectedGymDisplay.style.display = 'flex';
      
      // Ensure button is clickable - add direct event listener as backup
      const selectedGymLink = document.getElementById('selectedGymLink');
      if (selectedGymLink) {
        // Remove any existing listeners to avoid duplicates
        const newButton = selectedGymLink.cloneNode(true);
        selectedGymLink.parentNode.replaceChild(newButton, selectedGymLink);
        
        // Add direct click handler
        newButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[Edit Gym] Direct click handler triggered');
          handleBackToGym();
        });
        
        console.log('[Selected Gym Display] Button event listener attached');
      }
      
      // Adjust main content margin to account for selected gym display height
      // Use setTimeout to ensure height is calculated after display is shown
      setTimeout(() => {
        const mainContent = document.getElementById('mainContent');
        if (mainContent && selectedGymDisplay.offsetHeight > 0) {
          const displayHeight = selectedGymDisplay.offsetHeight;
          mainContent.style.marginTop = `-${displayHeight}px`;
        }
      }, 10);
      
      console.log('[Selected Gym Display] ✅ Display updated with:', gymName);
    } else {
      // Hide if we can't find the gym name
      selectedGymDisplay.style.display = 'none';
      
      // Reset main content margin when display is hidden
      if (mainContent) {
        mainContent.style.marginTop = '';
      }
      
      console.warn('[Selected Gym Display] ❌ Could not find gym name for ID:', state.selectedBusinessUnit, {
        storedName: state.selectedGymName,
        gymsArrayLength: gymsWithDistances?.length || 0,
        gymsArray: gymsWithDistances?.slice(0, 3).map(g => ({ id: String(g.id), name: g.name })) || []
      });
    }
  } else {
    // Not on step 2 - ensure margin is reset
    if (mainContent) {
      mainContent.style.marginTop = '';
    }
  }
}

function updateNavigationButtons() {
  if (DOM.prevBtn) {
    DOM.prevBtn.disabled = state.currentStep === 1;
  }
  if (DOM.nextBtn) {
    DOM.nextBtn.disabled = state.currentStep === TOTAL_STEPS;
    DOM.nextBtn.textContent = state.currentStep === TOTAL_STEPS ? 'Complete' : 'Next';
  }
  
}
function updateMainSubtitle() {
  if (!DOM.mainSubtitle || !DOM.mainTitle) return;

  const subtitles = {
    1: t('main.subtitle.step1'),
    2: t('main.subtitle.step2'),
    3: t('main.subtitle.step3'),
    4: t('main.subtitle.step4'),
    5: 'Welcome to Boulders!', // Step 5 is success page
  };

  DOM.mainSubtitle.textContent = subtitles[state.currentStep] ?? t('main.subtitle.step2');
  
  // Update secondary subtitle for current step
  const secondarySubtitle = document.querySelector('.secondary-subtitle');
  if (secondarySubtitle) {
    if (state.currentStep === 1) {
      secondarySubtitle.textContent = t('main.subtitle.step1.secondary');
    } else if (state.currentStep === 2) {
      secondarySubtitle.textContent = t('main.subtitle.step2.secondary');
    }
  }
  
  DOM.mainTitle.textContent = state.currentStep === TOTAL_STEPS ? 'WELCOME TO BOULDERS' : 'JOIN BOULDERS';
}

function refreshCarousels() {
  document.querySelectorAll('.plan-section').forEach((section) => {
    setupCarousel(section);
  });
}

function scrollCardIntoCenter(carousel, card, behavior = 'smooth') {
  if (!carousel || !card) return;

  const canScroll = Math.ceil(carousel.scrollWidth) > Math.ceil(carousel.clientWidth);
  if (!canScroll) return;

  const cardOffset = card.offsetLeft;
  const cardWidth = card.offsetWidth;
  const desiredLeft = cardOffset - (carousel.clientWidth / 2 - cardWidth / 2);
  const maxScroll = Math.max(carousel.scrollWidth - carousel.clientWidth, 0);
  const target = Math.min(Math.max(desiredLeft, 0), maxScroll);

  carousel.scrollTo({ left: target, behavior });
}

function centerPlanCard(card, behavior = 'smooth') {
  if (!card) return;
  const carousel = card.closest('[data-scroll-container]');
  if (!carousel) return;

  scrollCardIntoCenter(carousel, card, behavior);
  carousel.dataset.centerInitialized = 'true';
}

function initializeCarouselCenter(carousel) {
  if (!carousel || carousel.dataset.centerInitialized === 'true') return;

  const initialId = carousel.dataset.initialPlanId;
  let targetCard = initialId ? carousel.querySelector(`[data-plan-id="${initialId}"]`) : null;
  if (!targetCard) {
    targetCard = carousel.querySelector('.plan-card.selected');
  }
  if (!targetCard) {
    targetCard = carousel.querySelector('.plan-card');
  }

  if (targetCard) {
    scrollCardIntoCenter(carousel, targetCard, 'auto');
    carousel.dataset.centerInitialized = 'true';
  }
}

function setupCarousel(section) {
  const carousel = section.querySelector('[data-scroll-container]');
  const indicator = section.querySelector('.scroll-indicator');
  if (!carousel || !indicator) return;

  const updateIndicator = () => {
    const canScroll = Math.ceil(carousel.scrollWidth) > Math.ceil(carousel.clientWidth);
    indicator.classList.toggle('hidden', !canScroll);
    if (!canScroll) return;
    indicator.classList.toggle('at-start', carousel.scrollLeft <= 0);
    indicator.classList.toggle(
      'at-end',
      Math.ceil(carousel.scrollLeft + carousel.clientWidth) >= Math.ceil(carousel.scrollWidth),
    );
  };

  const adjustEdgePadding = () => {
    const firstCard = carousel.querySelector('.plan-card');
    if (!firstCard) {
      carousel.style.removeProperty('--carousel-edge-padding');
      carousel.style.removeProperty('--carousel-scroll-padding');
      return;
    }

    const cardWidth = firstCard.getBoundingClientRect().width;
    const containerWidth = carousel.getBoundingClientRect().width;

    if (!cardWidth || !containerWidth) {
      window.requestAnimationFrame(adjustEdgePadding);
      return;
    }

    const hasHorizontalOverflow = Math.ceil(carousel.scrollWidth) > Math.ceil(carousel.clientWidth);
    if (!hasHorizontalOverflow) {
      carousel.style.removeProperty('--carousel-edge-padding');
      carousel.style.removeProperty('--carousel-scroll-padding');
      return;
    }

    const diff = containerWidth - cardWidth;
    const edgePadding = diff > 0 ? diff / 2 : 12;
    const scrollPadding = diff > 0 ? diff / 2 : 12;

    carousel.style.setProperty('--carousel-edge-padding', `${edgePadding}px`);
    carousel.style.setProperty('--carousel-scroll-padding', `${scrollPadding}px`);
  };

  const updateCarouselState = () => {
    adjustEdgePadding();
    updateIndicator();
    const selectedCard = carousel.querySelector('.plan-card.selected');
    if (selectedCard) {
      scrollCardIntoCenter(carousel, selectedCard, 'auto');
    }
  };

  updateCarouselState();
  initializeCarouselCenter(carousel);

  let scrollHandler = carouselScrollHandlers.get(carousel);
  if (scrollHandler) {
    carousel.removeEventListener('scroll', scrollHandler);
  }
  scrollHandler = () => updateIndicator();
  carousel.addEventListener('scroll', scrollHandler, { passive: true });
  carouselScrollHandlers.set(carousel, scrollHandler);

  if (typeof ResizeObserver === 'function') {
    const fallbackHandler = carouselResizeFallbacks.get(carousel);
    if (fallbackHandler) {
      window.removeEventListener('resize', fallbackHandler);
      carouselResizeFallbacks.delete(carousel);
    }

    let resizeObserver = carouselResizeObservers.get(carousel);
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    resizeObserver = new ResizeObserver(updateCarouselState);
    resizeObserver.observe(carousel);
    const firstCard = carousel.querySelector('.plan-card');
    if (firstCard) {
      resizeObserver.observe(firstCard);
    }
    carouselResizeObservers.set(carousel, resizeObserver);
  } else {
    let fallbackHandler = carouselResizeFallbacks.get(carousel);
    if (fallbackHandler) {
      window.removeEventListener('resize', fallbackHandler);
    }
    fallbackHandler = () => updateCarouselState();
    window.addEventListener('resize', fallbackHandler);
    carouselResizeFallbacks.set(carousel, fallbackHandler);
  }
}

function setByPath(target, path, value) {
  const segments = path.split('.');
  let current = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value;
    } else {
      current[segment] = current[segment] ?? {};
      current = current[segment];
    }
  });
}

function findMembershipPlan(id) {
  const planId = String(id ?? '');
  const pools = [
    state.subscriptions,
    state.dayPassSubscriptions,
    state.campaignSubscriptions,
  ];
  for (const list of pools) {
    if (!Array.isArray(list)) continue;
    const match = list.find((plan) => String(plan.id) === planId);
    if (match) return match;
  }
  return null;
}

function findValueCard(id) {
  const rawId = String(id ?? '');
  const normalizedId = rawId.startsWith('punch-') ? rawId.replace('punch-', '') : rawId;
  if (!Array.isArray(state.valueCards)) return null;
  return state.valueCards.find((plan) => String(plan.id) === normalizedId) ?? null;
}

function findAddon(id) {
  if (!Array.isArray(state.subscriptionAdditions)) return null;
  return state.subscriptionAdditions.find((addon) => String(addon.id) === String(id)) ?? null;
}

// Cookie Consent Management (GDPR Compliant)
const COOKIE_CONSENT_KEY = 'boulders_cookie_consent';
const COOKIE_CONSENT_EXPIRY_DAYS = 365;

// Cookie categories
const COOKIE_CATEGORIES = {
  essential: 'essential',
  analytics: 'analytics',
  marketing: 'marketing',
  functional: 'functional'
};

function getCookieConsent() {
  try {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) return null;
    
    const consentData = JSON.parse(consent);
    // Check if consent has expired (older than 1 year)
    const consentDate = new Date(consentData.timestamp);
    const expiryDate = new Date(consentDate);
    expiryDate.setDate(expiryDate.getDate() + COOKIE_CONSENT_EXPIRY_DAYS);
    
    if (new Date() > expiryDate) {
      localStorage.removeItem(COOKIE_CONSENT_KEY);
      return null;
    }
    
    return consentData;
  } catch (e) {
    console.warn('[Cookie Consent] Error reading consent:', e);
    return null;
  }
}

function setCookieConsent(accepted, categories = null) {
  try {
    // If categories provided, use granular consent
    // If accepted is boolean and no categories, use simple accept/reject
    let consentData;
    
    if (categories !== null && typeof categories === 'object') {
      // Granular consent
      consentData = {
        accepted: true, // User has made a choice
        categories: {
          essential: true, // Always true
          analytics: categories.analytics || false,
          marketing: categories.marketing || false,
          functional: categories.functional || false
        },
        timestamp: new Date().toISOString(),
        version: '2.0',
        granular: true
      };
    } else {
      // Simple accept/reject all
      consentData = {
        accepted: accepted,
        categories: accepted ? {
          essential: true,
          analytics: accepted,
          marketing: accepted,
          functional: accepted
        } : {
          essential: true,
          analytics: false,
          marketing: false,
          functional: false
        },
        timestamp: new Date().toISOString(),
        version: '2.0',
        granular: false
      };
    }
    
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));
    
    // Load or unload tracking scripts based on consent
    const hasAnalytics = consentData.categories?.analytics || false;
    const hasMarketing = consentData.categories?.marketing || false;
    
    if (hasAnalytics || hasMarketing) {
      loadGTMIfConsented();
    } else {
      unloadGTM();
    }
    
    // Dispatch custom event for other scripts to listen to
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', {
      detail: consentData
    }));
    
    console.log('[Cookie Consent] Consent saved:', consentData);
  } catch (e) {
    console.error('[Cookie Consent] Error saving consent:', e);
  }
}

function getCookieCategoryConsent(category) {
  const consent = getCookieConsent();
  if (!consent) return false;
  
  // Essential cookies are always true
  if (category === COOKIE_CATEGORIES.essential) return true;
  
  return consent.categories?.[category] || false;
}

// Load Google Tag Manager conditionally based on consent
function loadGTMIfConsented() {
  // Check if GTM is already loaded
  if (window.GTM_LOADED) return;
  
  // Check consent for analytics or marketing (GTM typically uses both)
  const consent = getCookieConsent();
  if (!consent) return;
  
  const hasAnalytics = getCookieCategoryConsent(COOKIE_CATEGORIES.analytics);
  const hasMarketing = getCookieCategoryConsent(COOKIE_CATEGORIES.marketing);
  
  // Only load GTM if user consented to analytics or marketing
  if (hasAnalytics || hasMarketing) {
    const containerId = window.GTM_CONTAINER_ID || 'GTM-KHB92N9P';
    
    // Load GTM script
    (function(w,d,s,l,i){
      if (w[l] && w[l].length > 0 && w[l][0].event === 'gtm.js') {
        // Already initialized, just load the script
        var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
        j.async=true;
        j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
        f.parentNode.insertBefore(j,f);
      } else {
        // Initialize and load
        w[l]=w[l]||[];
        w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
        var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
        j.async=true;
        j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
        f.parentNode.insertBefore(j,f);
      }
    })(window,document,'script','dataLayer',containerId);
    
    // Show noscript iframe
    const noscript = document.getElementById('gtmNoscript');
    if (noscript) {
      noscript.style.display = 'block';
    }
    
    window.GTM_LOADED = true;
    console.log('[Cookie Consent] GTM loaded with consent for analytics:', hasAnalytics, 'marketing:', hasMarketing);
  }
}

// Unload GTM if consent is withdrawn
function unloadGTM() {
  // Remove GTM script
  const gtmScript = document.querySelector('script[src*="googletagmanager.com/gtm.js"]');
  if (gtmScript) {
    gtmScript.remove();
  }
  
  // Hide noscript iframe
  const noscript = document.getElementById('gtmNoscript');
  if (noscript) {
    noscript.style.display = 'none';
  }
  
  // Clear dataLayer (optional - you may want to keep it for essential tracking)
  // window.dataLayer = [];
  
  window.GTM_LOADED = false;
  console.log('[Cookie Consent] GTM unloaded');
}

function showCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  
  // Update translations
  updateCookieBannerTranslations();
  
  // Show banner with animation
  banner.style.display = 'block';
  // Use requestAnimationFrame to ensure display is set before adding class
  requestAnimationFrame(() => {
    banner.classList.add('show');
  });
}

function hideCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  
  banner.classList.remove('show');
  // Wait for animation to complete before hiding
  setTimeout(() => {
    banner.style.display = 'none';
  }, 300);
}

function updateCookieBannerTranslations() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  
  const title = banner.querySelector('.cookie-banner-title');
  const description = banner.querySelector('.cookie-banner-description');
  const acceptBtn = document.getElementById('cookieBannerAccept');
  const rejectBtn = document.getElementById('cookieBannerReject');
  const settingsBtn = document.getElementById('cookieBannerSettings');
  const settingsButton = document.getElementById('cookieSettingsButton');
  
  if (title) {
    title.textContent = t('cookie.banner.title');
  }
  
  if (description) {
    const descriptionText = t('cookie.banner.description');
    // Parse HTML from translation (for the link)
    description.innerHTML = descriptionText;
    // Re-attach event listener to the link
    const link = description.querySelector('.cookie-banner-link');
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openTermsModal('cookie');
      });
    }
  }
  
  if (acceptBtn) {
    acceptBtn.textContent = t('cookie.banner.accept');
  }
  
  if (rejectBtn) {
    rejectBtn.textContent = t('cookie.banner.reject');
  }
  
  if (settingsBtn) {
    settingsBtn.textContent = t('cookie.banner.settings');
  }
  
  // Update settings panel translations
  const settingsPanel = document.getElementById('cookieSettingsPanel');
  if (settingsPanel) {
    const settingsTitle = settingsPanel.querySelector('.cookie-settings-title');
    const settingsDesc = settingsPanel.querySelector('.cookie-settings-description');
    const saveBtn = document.getElementById('cookieSettingsSave');
    
    if (settingsTitle) {
      settingsTitle.textContent = t('cookie.settings.title');
    }
    
    if (settingsDesc) {
      settingsDesc.textContent = t('cookie.settings.description');
    }
    
    if (saveBtn) {
      saveBtn.textContent = t('cookie.settings.save');
    }
    
    // Update category translations
    const categories = settingsPanel.querySelectorAll('.cookie-category');
    categories.forEach(category => {
      const titleEl = category.querySelector('.cookie-category-title');
      const descEl = category.querySelector('.cookie-category-desc');
      const checkbox = category.querySelector('input[type="checkbox"]');
      
      if (titleEl && checkbox) {
        const categoryKey = checkbox.id.replace('cookie', '').toLowerCase();
        titleEl.textContent = t(`cookie.category.${categoryKey}.title`);
        if (descEl) {
          descEl.textContent = t(`cookie.category.${categoryKey}.desc`);
        }
      }
    });
  }
  
  if (settingsButton) {
    const span = settingsButton.querySelector('span');
    if (span) {
      span.textContent = t('cookie.settings.button');
    }
  }
}

function showCookieSettings() {
  const banner = document.getElementById('cookieBanner');
  const settingsPanel = document.getElementById('cookieSettingsPanel');
  if (!banner || !settingsPanel) return;
  
  // Load current consent preferences
  const consent = getCookieConsent();
  if (consent && consent.categories) {
    const analyticsCheckbox = document.getElementById('cookieAnalytics');
    const marketingCheckbox = document.getElementById('cookieMarketing');
    const functionalCheckbox = document.getElementById('cookieFunctional');
    
    if (analyticsCheckbox) analyticsCheckbox.checked = consent.categories.analytics || false;
    if (marketingCheckbox) marketingCheckbox.checked = consent.categories.marketing || false;
    if (functionalCheckbox) functionalCheckbox.checked = consent.categories.functional || false;
  }
  
  // Show banner if hidden
  if (!banner.classList.contains('show')) {
    showCookieBanner();
  }
  
  // Show settings panel
  settingsPanel.style.display = 'block';
  // Scroll settings panel into view
  setTimeout(() => {
    settingsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

function hideCookieSettings() {
  const settingsPanel = document.getElementById('cookieSettingsPanel');
  if (settingsPanel) {
    settingsPanel.style.display = 'none';
  }
}

function setupCookieSettingsButton() {
  const settingsButton = document.getElementById('cookieSettingsButton');
  
  if (settingsButton) {
    // Remove any existing listeners by cloning (prevents duplicates)
    const newButton = settingsButton.cloneNode(true);
    if (settingsButton.parentNode) {
      settingsButton.parentNode.replaceChild(newButton, settingsButton);
    }
    
    newButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Cookie Settings] Footer button clicked');
      showCookieBanner();
      // Small delay to ensure banner is visible before showing settings
      setTimeout(() => {
        showCookieSettings();
      }, 100);
    });
    
    console.log('[Cookie Settings] Footer button listener attached');
  } else {
    // Button might not be loaded yet, try again after a short delay
    setTimeout(() => {
      const retryButton = document.getElementById('cookieSettingsButton');
      if (retryButton) {
        setupCookieSettingsButton();
      } else {
        console.warn('[Cookie Settings] Footer button not found after retry');
      }
    }, 500);
  }
}

function initCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  
  // Always set up event listeners (even if consent exists, user should be able to change settings)
  const acceptBtn = document.getElementById('cookieBannerAccept');
  const rejectBtn = document.getElementById('cookieBannerReject');
  const settingsBtn = document.getElementById('cookieBannerSettings');
  const settingsCloseBtn = document.getElementById('cookieSettingsClose');
  const settingsSaveBtn = document.getElementById('cookieSettingsSave');
  const settingsButton = document.getElementById('cookieSettingsButton');
  
  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      setCookieConsent(true);
      hideCookieSettings();
      hideCookieBanner();
    });
  }
  
  if (rejectBtn) {
    rejectBtn.addEventListener('click', () => {
      setCookieConsent(false);
      hideCookieSettings();
      hideCookieBanner();
    });
  }
  
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      showCookieSettings();
    });
  }
  
  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', () => {
      hideCookieSettings();
    });
  }
  
  if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener('click', () => {
      const analyticsCheckbox = document.getElementById('cookieAnalytics');
      const marketingCheckbox = document.getElementById('cookieMarketing');
      const functionalCheckbox = document.getElementById('cookieFunctional');
      
      const categories = {
        analytics: analyticsCheckbox ? analyticsCheckbox.checked : false,
        marketing: marketingCheckbox ? marketingCheckbox.checked : false,
        functional: functionalCheckbox ? functionalCheckbox.checked : false
      };
      
      setCookieConsent(true, categories);
      hideCookieSettings();
      hideCookieBanner();
    });
  }
  
  // Cookie settings button (always visible in footer) - ALWAYS set up listener
  setupCookieSettingsButton();
  
  // Check if consent has already been given
  const consent = getCookieConsent();
  if (consent) {
    // Consent already given, don't show banner on load
    // But settings button should still be available (listener already set up above)
    return;
  }
  
  // Show banner after a short delay to let page load
  setTimeout(() => {
    showCookieBanner();
  }, 1000);
}
