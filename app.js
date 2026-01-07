const numberFormatter = new Intl.NumberFormat('da-DK');
const currencyFormatter = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
});

const MEMBERSHIP_PLANS = [
  {
    id: 'membership-student',
    name: 'Student',
    price: 379,
    priceSuffix: 'kr/mo',
    description: 'For climbers with valid student ID',
    features: [
      'Unlimited access to 10 gyms',
      'Bloc Life Loyalty Program',
      '3x 15-Day Guest Passes',
      '10% off Shoes and Gear'
    ],
    cta: 'Select Student',
  },
  {
    id: 'membership-adult',
    name: 'Adult',
    price: 445,
    priceSuffix: 'kr/mo',
    description: 'For climbers over 16 years',
    features: [
      'Unlimited access to 10 gyms',
      'Bloc Life Loyalty Program',
      '3x 15-Day Guest Passes',
      '10% off Shoes and Gear'
    ],
    cta: 'Select Adult',
  },
  {
    id: 'membership-junior',
    name: 'Junior',
    price: 249,
    priceSuffix: 'kr/mo',
    description: 'For climbers under 16 years',
    features: [
      'Unlimited access to 10 gyms',
      'Bloc Life Loyalty Program',
      '3x 15-Day Guest Passes',
      'Discount on kids classes',
    ],
    cta: 'Select Junior',
  },
];

const VALUE_CARDS = [
  {
    id: 'value-adult',
    name: 'Adult',
    price: 1200,
    priceSuffix: 'kr',
    description: 'For ages 16+',
    features: [
      '10 x Adult entries',
      'A physical card you can share',
      'Valid at all gyms during opening hours',
      'Can be upgraded to membership',
    ],
    min: 0,
    max: 5,
  },
  {
    id: 'value-junior',
    name: 'Junior',
    price: 800,
    priceSuffix: 'kr',
    description: 'For ages up to 15 years',
    features: [
      '10 x Junior entries',
      'A physical card you can share',
      'Valid at all gyms during opening hours',
      'Can be upgraded to membership',
    ],
    min: 0,
    max: 3,
  },
];

const ADDONS = [
  {
    id: 'addon-shoes',
    name: 'Climbing Shoes',
    price: { original: 599, discounted: 399 },
    description: 'Essential climbing shoes for beginners',
    features: [
      'High-quality rubber sole',
      'Comfortable fit',
      'Perfect for bouldering',
      'Available in multiple sizes',
    ],
    cta: 'Add to Cart',
  },
  {
    id: 'addon-chalk',
    name: 'Chalk Bag Set',
    price: { original: 299, discounted: 199 },
    description: 'Complete chalk bag with magnesium chalk',
    features: [
      'Premium magnesium chalk',
      'Durable chalk bag',
      'Brush included',
      'Multiple color options',
    ],
    cta: 'Add to Cart',
  },
];

const VALUE_CARD_PUNCH_MULTIPLIER = 10;

const REQUIRED_FIELDS = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'streetAddress',
  'postalCode',
  'email',
  'countryCode',
  'password',
  'confirmPassword',
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
  'parentConfirmPassword',
  'parentPrimaryGym',
];

const CARD_FIELDS = ['cardNumber', 'expiryDate', 'cvv', 'cardholderName'];


// API Integration Functions
class BusinessUnitsAPI {
  constructor(baseUrl = null) {
    // In development, use Vite proxy (relative URL)
    // In production on Netlify, use Netlify Function proxy to avoid CORS
    // In production on Cloudflare, use Cloudflare Pages Function proxy to avoid CORS
    // Detect if we're in development by checking if we're on localhost
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Cloudflare Pages detection - check for Cloudflare domains OR boulders.dk domains (which are deployed on Cloudflare)
    const isCloudflare = window.location.hostname.includes('workers.dev') || 
                         window.location.hostname.includes('pages.dev') ||
                         window.location.hostname.includes('join.boulders.dk') ||
                         window.location.hostname === 'boulders.dk';
    const isNetlify = window.location.hostname.includes('netlify.app');
    
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else if (isDevelopment) {
      // Use Vite proxy in development
      this.baseUrl = '';
    } else if (isNetlify) {
      // Use Netlify Function proxy in production
      this.baseUrl = '/.netlify/functions/api-proxy';
      this.useProxy = true;
    } else if (isCloudflare) {
      // Use Cloudflare Pages Function proxy in production
      this.baseUrl = '/api-proxy';
      this.useProxy = true;
    } else {
      // Fallback to direct API (may have CORS issues)
      this.baseUrl = 'https://api-join.boulders.dk';
    }
  }

  // Get all business units from API
  // Step 3: Fetch from /api/reference/business-units endpoint
  // Note: This endpoint uses "No Auth" according to Postman docs
  async getBusinessUnits() {
    try {
      // Build URL - if using Netlify proxy, add path as query parameter
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/reference/business-units`;
      } else {
        url = `${this.baseUrl}/api/reference/business-units`;
      }
      console.log('Fetching business units from:', url);
      
      const headers = {
        'Accept-Language': 'da-DK', // Step 2: Language default
        'Content-Type': 'application/json',
        // No Authorization header needed - endpoint uses "No Auth"
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      console.log('API Response status:', response.status, response.statusText);
      console.log('API Response Content-Type:', response.headers.get('Content-Type'));
      
      // Check if response is actually JSON before parsing
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('API returned non-JSON response:', text.substring(0, 200));
        throw new Error(`API returned HTML instead of JSON. Status: ${response.status}. This usually means the API endpoint is not working correctly or the proxy is misconfigured.`);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Business units API response:', data);
      console.log('Response type:', Array.isArray(data) ? 'Array' : typeof data);
      console.log('Number of items:', Array.isArray(data) ? data.length : 'N/A');
      
      return data;
    } catch (error) {
      console.error('Error fetching business units:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
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
      let url;
      const queryParam = businessUnitId ? `?businessUnit=${businessUnitId}` : '';
      if (this.useProxy) {
        // For proxy, include query params in the path
        url = `${this.baseUrl}?path=/api/products/subscriptions${queryParam}`;
      } else {
        url = `${this.baseUrl}/api/products/subscriptions${queryParam}`;
      }
      console.log('Fetching subscriptions from:', url);
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Subscriptions API response:', data);
      return data;
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }
  }

  // Step 5: Get value cards (punch cards)
  async getValueCards() {
    try {
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/products/valuecards`;
      } else {
        url = `${this.baseUrl}/api/products/valuecards`;
      }
      console.log('Fetching value cards from:', url);
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Value cards API response:', data);
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
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/products/subscriptions/${productId}/additions`;
      } else {
        url = `${this.baseUrl}/api/products/subscriptions/${productId}/additions`;
      }
      console.log('Fetching subscription additions from:', url);
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        // If 404, the endpoint doesn't exist yet - return empty array for now
        if (response.status === 404) {
          console.warn(`Additions endpoint not found for product ${productId}. Endpoint may not be implemented yet.`);
          return [];
        }
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Subscription additions API response:', data);
      
      // Handle different response formats
      return Array.isArray(data) ? data : (data.data || data.items || []);
    } catch (error) {
      console.error('Error fetching subscription additions:', error);
      // Return empty array if endpoint doesn't exist - don't break the flow
      console.warn('Returning empty array for add-ons - endpoint may not be available yet');
      return [];
    }
  }

  // Step 8: Get additional catalog items - GET /api/products
  // To offer more products, fetch catalogs with GET /api/products
  async getProducts(businessUnitId = null) {
    try {
      let url;
      const queryParam = businessUnitId ? `?businessUnit=${businessUnitId}` : '';
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/products${queryParam}`;
      } else {
        url = `${this.baseUrl}/api/products${queryParam}`;
      }
      
      console.log('[Step 8] Fetching additional catalog products from:', url);
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        // If 404, the endpoint doesn't exist yet - return empty array
        if (response.status === 404) {
          console.log('[Step 8] Products endpoint not found (404) - may not be implemented yet');
          return [];
        }
        const errorText = await response.text();
        console.error(`[Step 8] API Error (${response.status}):`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Step 8] Products API response:', data);
      
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
    // Use same proxy logic as BusinessUnitsAPI
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Development: use Vite proxy (relative URL)
      this.baseUrl = '';
      this.useProxy = false;
    } else if (window.location.hostname.includes('workers.dev') || 
               window.location.hostname.includes('pages.dev') ||
               window.location.hostname.includes('join.boulders.dk') ||
               window.location.hostname === 'boulders.dk') {
      // Production: use Cloudflare Pages Function proxy
      this.baseUrl = '/api-proxy';
      this.useProxy = true;
    } else if (window.location.hostname.includes('netlify')) {
      // Production: use Netlify Function proxy
      this.baseUrl = '/.netlify/functions/api-proxy';
      this.useProxy = true;
    } else {
      // Fallback to direct API (may have CORS issues)
      this.baseUrl = 'https://api-join.boulders.dk';
      this.useProxy = false;
    }
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
        'Accept-Language': 'da-DK', // Step 2: Language default
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
        'Accept-Language': 'da-DK',
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
    // Use same proxy logic as BusinessUnitsAPI
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Development: use Vite proxy (relative URL)
      this.baseUrl = '';
      this.useProxy = false;
    } else if (window.location.hostname.includes('workers.dev') || 
               window.location.hostname.includes('pages.dev') ||
               window.location.hostname.includes('join.boulders.dk') ||
               window.location.hostname === 'boulders.dk') {
      // Production: use Cloudflare Pages Function proxy
      this.baseUrl = '/api-proxy';
      this.useProxy = true;
    } else if (window.location.hostname.includes('netlify')) {
      // Production: use Netlify Function proxy
      this.baseUrl = '/.netlify/functions/api-proxy';
      this.useProxy = true;
    } else {
      // Fallback to direct API (may have CORS issues)
      this.baseUrl = 'https://api-join.boulders.dk';
      this.useProxy = false;
    }
  }

  // Step 6: Login - Submit login credentials and store tokens
  async login(email, password) {
    try {
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/auth/login`;
      } else {
        url = `${this.baseUrl}/api/auth/login`;
      }
      
      console.log('[Step 6] Logging in:', url);
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
      };
      
      // API expects username field (which is the email)
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username: email, password }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 6] Login error (${response.status}):`, errorText);
        
        // Handle rate limit errors with better messaging
        if (response.status === 429) {
          let retryAfterSeconds = 60; // Default 1 minute (60 seconds) - more reasonable than 15 minutes
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.retryAfter) {
              // retryAfter is already in seconds (e.g., 900 = 15 minutes)
              retryAfterSeconds = parseInt(errorData.retryAfter, 10);
              // Cap at 2 minutes (120 seconds) for better UX - API might say 15 minutes but that's too long
              retryAfterSeconds = Math.min(retryAfterSeconds, 120);
            }
          } catch (e) {
            // If JSON parse fails, try to extract from error text
            const retryMatch = errorText.match(/retryAfter["\s:]*(\d+)/i);
            if (retryMatch) {
              retryAfterSeconds = parseInt(retryMatch[1], 10);
              // Cap at 2 minutes for better UX
              retryAfterSeconds = Math.min(retryAfterSeconds, 120);
            }
          }
          const retryMinutes = Math.ceil(retryAfterSeconds / 60);
          const retrySeconds = retryAfterSeconds % 60;
          const retryMessage = retryMinutes > 0 
            ? `${retryMinutes} minute${retryMinutes !== 1 ? 's' : ''}${retrySeconds > 0 ? ` and ${retrySeconds} second${retrySeconds !== 1 ? 's' : ''}` : ''}`
            : `${retryAfterSeconds} second${retryAfterSeconds !== 1 ? 's' : ''}`;
          throw new Error(`Rate limit exceeded. Please wait ${retryMessage} before trying again. (${response.status} - ${errorText})`);
        }
        
        throw new Error(`Login failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Step 6] Login response:', data);
      
      const tokenPayload = data?.data ?? data;
      const accessToken = tokenPayload.accessToken || tokenPayload.access_token;
      const refreshToken = tokenPayload.refreshToken || tokenPayload.refresh_token;
      let expiresAt = tokenPayload.expiresAt || tokenPayload.expires_at;
      const expiresIn = tokenPayload.expiresIn || tokenPayload.expires_in;
      if (!expiresAt && expiresIn) {
        const expiresInMs = Number(expiresIn) * 1000;
        expiresAt = Date.now() + (Number.isFinite(expiresInMs) ? expiresInMs : 0);
      }
      
      // Debug: Log the actual structure
      if (data.data) {
        console.log('[Step 6] Data object keys:', Object.keys(data.data));
        console.log('[Step 6] Data object:', JSON.stringify(data.data, null, 2));
      }
      
      if (accessToken && refreshToken) {
        if (typeof window.saveTokens === 'function') {
          const metadata = {
            username: tokenPayload.username || tokenPayload.userName,
            email: tokenPayload.email || email,
            roles: tokenPayload.roles || [],
            tokenType: tokenPayload.tokenType || tokenPayload.token_type,
            expiresIn: tokenPayload.expiresIn || tokenPayload.expires_in,
          };
          window.saveTokens(accessToken, refreshToken, expiresAt, metadata);
          console.log('[Step 6] ✅ Tokens saved successfully');
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
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/auth/validate`;
      } else {
        url = `${this.baseUrl}/api/auth/validate`;
      }
      
      console.log('[Step 6] Validating token:', url);
      
      // Note: Authorization header will be added automatically by HttpClient
      // But since we're using fetch directly, we need to add it manually
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ accessToken }), // Some endpoints require explicit payload
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 6] Token validation error (${response.status}):`, errorText);
        throw new Error(`Token validation failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Step 6] Token validation response:', data);
      return data;
    } catch (error) {
      console.error('[Step 6] Token validation error:', error);
      throw error;
    }
  }

  // Step 6: Refresh token - Refresh expired tokens
  async refreshToken() {
    try {
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/auth/refresh`;
      } else {
        url = `${this.baseUrl}/api/auth/refresh`;
      }
      
      console.log('[Step 6] Refreshing token:', url);
      
      const refreshToken = typeof window.getRefreshToken === 'function' 
        ? window.getRefreshToken() 
        : null;
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ refreshToken }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 6] Token refresh error (${response.status}):`, errorText);
        const isRateLimit = response.status === 429;
        // If refresh fails for other reasons, clear tokens and return to auth step
        if (!isRateLimit && typeof window.clearTokens === 'function') {
          window.clearTokens();
        }
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Step 6] Token refresh response:', data);
      
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
      let url;
      if (this.useProxy) {
        // Use ver3 endpoint path - proxy will route to correct base URL
        url = `${this.baseUrl}?path=/api/ver3/auth/resetpassword`;
      } else {
        // Direct call to ver3 API
        url = `https://boulders.brpsystems.com/apiserver/api/ver3/auth/resetpassword`;
      }
      
      console.log('[Step 6] Requesting password reset:', url);
      
      const headers = {
        'Accept-Language': 'da-DK',
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
      
      console.log('[Step 6] Password reset payload:', payload);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      // API returns 201 (CREATED) on success, even if email doesn't match (security measure)
      if (response.status !== 201 && !response.ok) {
        const errorText = await response.text();
        console.error(`[Step 6] Password reset error (${response.status}):`, errorText);
        throw new Error(`Password reset failed: ${response.status} - ${errorText}`);
      }
      
      // API may return empty body on 201, or JSON response
      let data = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (e) {
          // Empty response is OK for 201 status
          console.log('[Step 6] Password reset returned 201 with no JSON body (expected)');
        }
      }
      
      console.log('[Step 6] Password reset response:', response.status, data);
      // Return success indication
      return { success: true, status: response.status, data };
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
        'Accept-Language': 'da-DK',
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
        'Accept-Language': 'da-DK',
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
        'Accept-Language': 'da-DK',
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

  const encodeTokenData = (tokenData) => {
    const payload = JSON.stringify(tokenData);
    try {
      if (typeof btoa === 'function') {
        return btoa(payload);
      }
    } catch (error) {
      console.warn('[Step 6] Could not base64 encode token data:', error);
    }
    try {
      return encodeURIComponent(payload);
    } catch (error) {
      console.warn('[Step 6] Could not URI encode token data:', error);
    }
    return payload;
  };

  const decodeTokenData = (value) => {
    if (!value) return null;
    try {
      if (typeof atob === 'function') {
        return JSON.parse(atob(value));
      }
    } catch (error) {
      // Fallback to URI decoding below
    }
    try {
      return JSON.parse(decodeURIComponent(value));
    } catch (error) {
      console.warn('[Step 6] Could not decode login session cookie:', error);
      return null;
    }
  };

  const writeLoginSessionCookie = (tokenData) => {
    if (typeof document === 'undefined') return;
    try {
      const encoded = encodeTokenData(tokenData);
      const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${LOGIN_SESSION_COOKIE}=${encoded}; path=/; SameSite=Lax${secureFlag}`;
    } catch (error) {
      console.warn('[Step 6] Could not write login session cookie:', error);
    }
  };

  const readLoginSessionCookie = () => {
    if (typeof document === 'undefined' || !document.cookie) return null;
    const cookies = document.cookie.split(';');
    const match = cookies.find((cookie) => cookie.trim().startsWith(`${LOGIN_SESSION_COOKIE}=`));
    if (!match) return null;
    const value = match.substring(match.indexOf('=') + 1).trim();
    return decodeTokenData(value);
  };

  const clearLoginSessionCookie = () => {
    if (typeof document === 'undefined') return;
    document.cookie = `${LOGIN_SESSION_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  };

  const hydrateFromCookie = () => {
    const cookieData = readLoginSessionCookie();
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
    hydrateFromCookie();
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

    writeLoginSessionCookie(tokenData);
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

    const cookieTokens = hydrateFromCookie();
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
    
    const cookieTokens = hydrateFromCookie();
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

    const cookieTokens = hydrateFromCookie();
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

    clearLoginSessionCookie();
  };

  // Check if token is expired
  window.isTokenExpired = function() {
    const activeStore = tokenStore ?? readLoginSessionCookie();
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
    // Use same proxy logic as BusinessUnitsAPI
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Development: use Vite proxy (relative URL)
      this.baseUrl = '';
      this.useProxy = false;
    } else if (window.location.hostname.includes('workers.dev') || 
               window.location.hostname.includes('pages.dev') ||
               window.location.hostname.includes('join.boulders.dk') ||
               window.location.hostname === 'boulders.dk') {
      // Production: use Cloudflare Pages Function proxy
      this.baseUrl = '/api-proxy';
      this.useProxy = true;
    } else if (window.location.hostname.includes('netlify')) {
      // Production: use Netlify Function proxy
      this.baseUrl = '/.netlify/functions/api-proxy';
      this.useProxy = true;
    } else {
      // Fallback to direct API (may have CORS issues)
      this.baseUrl = 'https://api-join.boulders.dk';
      this.useProxy = false;
    }
  }

  // Step 7: Create order - POST /api/orders
  async createOrder(orderData) {
    try {
      // Always include the active business unit
      if (!orderData.businessUnit && state.selectedBusinessUnit) {
        orderData.businessUnit = state.selectedBusinessUnit;
      }
      
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/orders`;
      } else {
        url = `${this.baseUrl}/api/orders`;
      }
      
      console.log('[Step 7] Creating order:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 7] Create order error (${response.status}):`, errorText);
        throw new Error(`Create order failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
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
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/ver3/orders/${orderId}/items/subscriptions`;
      } else {
        url = `https://boulders.brpsystems.com/apiserver/api/ver3/orders/${orderId}/items/subscriptions`;
      }
      
      console.log('[Step 7] Adding subscription item:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': 'da-DK',
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
      
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 7] Add subscription item error (${response.status}):`, errorText);
        throw new Error(`Add subscription item failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
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
      
      // CRITICAL: If backend ignored startDate (set it to future), try to fix by deleting and re-adding
      // This works for Student/Junior but may not work for productId 134 (known backend bug)
      if (startDateIgnored && subscriptionItem?.id) {
        console.warn('[Step 7] ⚠️ Backend ignored startDate - start date is', daysUntilStart, 'days in future');
        console.warn('[Step 7] ⚠️ Attempting to fix by deleting and re-adding subscription...');
        
        try {
          // Delete the subscription item using DELETE /api/ver3/orders/{order}/items/subscriptions/{id}
          const deleteUrl = this.useProxy
            ? `${this.baseUrl}?path=/api/ver3/orders/${orderId}/items/subscriptions/${subscriptionItem.id}`
            : `https://boulders.brpsystems.com/apiserver/api/ver3/orders/${orderId}/items/subscriptions/${subscriptionItem.id}`;
          
          const deleteResponse = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Accept-Language': 'da-DK',
              'Content-Type': 'application/json',
              ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
            },
          });
          
          if (!deleteResponse.ok) {
            const deleteErrorText = await deleteResponse.text();
            console.warn('[Step 7] ⚠️ Failed to delete subscription item:', deleteErrorText);
            console.warn('[Step 7] ⚠️ Continuing with original subscription (may have incorrect start date)');
          } else {
            console.log('[Step 7] ✅ Subscription item deleted, re-adding with correct startDate...');
            
            // Wait a moment for backend to process deletion
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Re-add subscription with same payload
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
            });
            
            if (!retryResponse.ok) {
              const retryErrorText = await retryResponse.text();
              console.error('[Step 7] ❌ Failed to re-add subscription item:', retryErrorText);
              throw new Error(`Re-add subscription item failed: ${retryResponse.status} - ${retryErrorText}`);
            }
            
            const retryData = await retryResponse.json();
            const retrySubscriptionItem = retryData?.subscriptionItems?.[0];
            const retryStartDate = retrySubscriptionItem?.initialPaymentPeriod?.start;
            const retryStartDateObj = retryStartDate ? new Date(retryStartDate) : null;
            const retryDaysUntilStart = retryStartDateObj ? Math.ceil((retryStartDateObj - checkToday) / (1000 * 60 * 60 * 24)) : 0;
            
            console.log('[Step 7] 🔍 Retry response analysis:', {
              retryStartDate,
              retryDaysUntilStart,
              retryOrderPrice: retryData?.price?.amount,
              retryOrderPriceDKK: retryData?.price?.amount ? retryData.price.amount / 100 : null,
            });
            
            if (retryDaysUntilStart <= 1) {
              console.log('[Step 7] ✅ Successfully fixed startDate by re-adding subscription!');
              return retryData;
            } else {
              console.warn('[Step 7] ⚠️ Re-add still has future start date - backend bug persists for this product');
              console.warn('[Step 7] ⚠️ Payment window will show incorrect price');
              return retryData; // Return retry data anyway
            }
          }
        } catch (retryError) {
          console.error('[Step 7] ❌ Error during retry:', retryError);
          console.warn('[Step 7] ⚠️ Continuing with original subscription (may have incorrect start date)');
        }
      }
      
      // Log warning if backend ignored startDate for productId 134
      if (subscriptionProductId === 134 && startDateIgnored) {
        console.error('[Step 7] ❌ BACKEND BUG CONFIRMED: Backend ignored startDate for productId 134!');
        console.error('[Step 7] ❌ Sent startDate:', startDate, 'but backend returned:', responseStartDate);
        console.error('[Step 7] ❌ Payment window will show incorrect price (full monthly price instead of partial-month)');
        console.error('[Step 7] ❌ This is a backend issue that needs to be fixed on backend side');
      }
      
      return data;
    } catch (error) {
      console.error('[Step 7] Add subscription item error:', error);
      throw error;
    }
  }

  // Step 7: Add value card item (punch card) - POST /api/ver3/orders/{orderId}/items/valuecards
  // API Documentation: https://boulders.brpsystems.com/brponline/external/documentation/api3
  async addValueCardItem(orderId, productId, quantity = 1) {
    try {
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/ver3/orders/${orderId}/items/valuecards`;
      } else {
        url = `https://boulders.brpsystems.com/apiserver/api/ver3/orders/${orderId}/items/valuecards`;
      }
      
      console.log('[Step 7] Adding value card item:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': 'da-DK',
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
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 7] Add value card item error (${response.status}):`, errorText);
        throw new Error(`Add value card item failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
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
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/orders/${orderId}/items/articles`;
      } else {
        url = `${this.baseUrl}/api/orders/${orderId}/items/articles`;
      }
      
      console.log('[Step 7] Adding article item:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      const payload = {
        productId,
        businessUnit: state.selectedBusinessUnit, // Always include active business unit
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 7] Add article item error (${response.status}):`, errorText);
        throw new Error(`Add article item failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
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
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/orders/${orderId}`;
      } else {
        url = `${this.baseUrl}/api/orders/${orderId}`;
      }
      
      console.log('[Step 7] Getting order:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 7] Get order error (${response.status}):`, errorText);
        throw new Error(`Get order failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
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
      
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/orders/${orderId}`;
      } else {
        url = `${this.baseUrl}/api/orders/${orderId}`;
      }
      
      console.log('[Step 7] Updating order:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(orderData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 7] Update order error (${response.status}):`, errorText);
        throw new Error(`Update order failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
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
      let url;
      if (this.useProxy) {
        // Proxy will handle the ver3 endpoint routing
        url = `${this.baseUrl}?path=/api/ver3/orders/${orderId}/coupons`;
      } else {
        // Direct API call - ver3 endpoints use different base URL
        url = `https://boulders.brpsystems.com/apiserver/api/ver3/orders/${orderId}/coupons`;
      }
      
      console.log('[Discount] Applying coupon:', discountCode, 'to order:', orderId);
      console.log('[Discount] Endpoint:', url);
      
      const accessToken = typeof window.getAccessToken === 'function' 
        ? window.getAccessToken() 
        : null;
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      };
      
      // API expects couponName field (not code)
      const payload = {
        couponName: discountCode,
      };
      
      console.log('[Discount] Request payload:', JSON.stringify(payload, null, 2));
      
      // Try POST first (API returns 405 for PUT)
      let response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      // If POST returns 405, the endpoint might not exist or need different path
      // Try alternative endpoint structure if POST fails
      if (response.status === 405 || response.status === 404) {
        console.log('[Discount] POST returned', response.status, '- trying alternative endpoint...');
        // Try with different path structure: /api/orders/{orderId}/coupon (singular)
        const altUrl = this.useProxy 
          ? `${this.baseUrl}?path=/api/orders/${orderId}/coupon`
          : `${this.baseUrl}/api/orders/${orderId}/coupon`;
        
        console.log('[Discount] Trying alternative endpoint:', altUrl);
        response = await fetch(altUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Discount] Apply coupon error (${response.status}):`, errorText);
        throw new Error(`Apply coupon failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
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
        } else if (typeof couponDiscount === 'number') {
          discountAmount = couponDiscount;
          
          // If amount is in cents, convert to DKK
          if (discountAmount > 10000) {
            console.log('[Discount] Large number detected, might be in cents:', discountAmount);
            discountAmount = discountAmount / 100;
            console.log('[Discount] Converted from cents:', discountAmount);
          }
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
            discountAmount = subtotal - newTotalDKK;
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
    // Use same proxy logic as BusinessUnitsAPI
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Development: use Vite proxy (relative URL)
      this.baseUrl = '';
      this.useProxy = false;
    } else if (window.location.hostname.includes('workers.dev') || 
               window.location.hostname.includes('pages.dev') ||
               window.location.hostname.includes('join.boulders.dk') ||
               window.location.hostname === 'boulders.dk') {
      // Production: use Cloudflare Pages Function proxy
      this.baseUrl = '/api-proxy';
      this.useProxy = true;
    } else if (window.location.hostname.includes('netlify')) {
      // Production: use Netlify Function proxy
      this.baseUrl = '/.netlify/functions/api-proxy';
      this.useProxy = true;
    } else {
      // Fallback to direct API (may have CORS issues)
      this.baseUrl = 'https://api-join.boulders.dk';
      this.useProxy = false;
    }
    
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
        const baseUrl = isLocal
          ? 'https://join.boulders.dk'
          : window.location.origin.replace('http://', 'https://');
        returnUrl = `${baseUrl}${path}?payment=return&orderId=${orderId}`;
      }
      
      if (!returnUrl) {
        throw new Error('Return URL is required for payment link generation');
      }
      
      if (!orderId) {
        throw new Error('Order ID is required for payment link generation');
      }
      
      let url;
      if (this.useProxy) {
        // Use standard API endpoint: /api/payment/generate-link
        url = `${this.baseUrl}?path=${this.paymentEndpoint}`;
      } else {
        // Direct API call to api-join.boulders.dk
        url = `https://api-join.boulders.dk${this.paymentEndpoint}`;
      }
      
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
        'Accept-Language': 'da-DK',
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
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      console.log('[Step 9] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 9] ❌ Generate Payment Link Card failed (${response.status}):`, errorText);
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/50e61037-73d2-4f3b-acc0-ea461f14b6ed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:1995',message:'Payment link generation FAILED',data:{orderId,selectedProductType:state?.selectedProductType,selectedProductId:state?.selectedProductId,membershipPlanId:state?.membershipPlanId,paymentMethod,paymentMethodId,businessUnit,responseStatus:response.status,errorText:errorText.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        throw new Error(`Generate Payment Link Card failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
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
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/50e61037-73d2-4f3b-acc0-ea461f14b6ed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2013',message:'Payment link MISSING from response',data:{orderId,selectedProductType:state?.selectedProductType,selectedProductId:state?.selectedProductId,membershipPlanId:state?.membershipPlanId,responseKeys:Object.keys(data),dataKeys:data.data?Object.keys(data.data):[],responseSample:JSON.stringify(data).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        throw new Error('Payment link not found in API response');
      }
      
      // Store in state for UI to use
      if (state) {
        state.paymentLink = paymentLink;
        state.paymentLinkGenerated = true;
      }
      console.log('[Step 9] Payment link extracted from response.url:', paymentLink);
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/50e61037-73d2-4f3b-acc0-ea461f14b6ed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2022',message:'Payment link generation SUCCESS',data:{orderId,selectedProductType:state?.selectedProductType,selectedProductId:state?.selectedProductId,membershipPlanId:state?.membershipPlanId,paymentMethod,paymentMethodId,businessUnit,hasPaymentLink:!!paymentLink,paymentLinkPrefix:paymentLink?paymentLink.substring(0,30):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      return { ...data, paymentLink: paymentLink, url: paymentLink };
    } catch (error) {
      console.error('[Step 9] Generate payment link error:', error);
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/50e61037-73d2-4f3b-acc0-ea461f14b6ed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2030',message:'Payment link generation ERROR',data:{orderId,selectedProductType:state?.selectedProductType,selectedProductId:state?.selectedProductId,membershipPlanId:state?.membershipPlanId,paymentMethod,errorMessage:error.message,errorStack:error.stack?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      throw error;
    }
  }
}

function stripEmailPlusTag(email) {
  if (typeof email !== 'string') {
    return email;
  }
  
  const trimmed = email.trim();
  const [localPart, domain] = trimmed.split('@');
  if (!localPart || !domain) {
    return trimmed;
  }
  
  const plusIndex = localPart.indexOf('+');
  if (plusIndex === -1) {
    return trimmed;
  }
  
  const cleanedLocal = localPart.substring(0, plusIndex);
  const sanitized = `${cleanedLocal}@${domain}`;
  if (sanitized !== trimmed) {
    console.log('[Step 9] Receipt email sanitized (plus tag removed):', sanitized);
  }
  return sanitized;
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

    // Debug: Log all products received from API to verify what backend sends
    console.log('[Product Filter] Raw API response received:', {
      subscriptionsCount: subscriptions.length,
      valueCardsCount: valueCards.length,
      subscriptionNames: subscriptions.map(p => p.name),
      valueCardNames: valueCards.map(p => p.name)
    });

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
          console.log(`[Product Filter] Excluding subscription product ${product.id} (${product.name}): allowedToOrder is false`);
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
        console.log(`[Product Filter] Excluding subscription product ${product.id} (${product.name}): missing priceWithInterval.price.amount (cannot be purchased)`);
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
          console.log(`[Product Filter] Excluding subscription product ${product.id} (${product.name}): not available for business unit ${state.selectedBusinessUnit}`);
          return false;
        }
      }
      
      return true;
    });
    
    if (subscriptions.length !== originalSubscriptionCount) {
      console.log(`[Product Filter] Filtered ${originalSubscriptionCount - subscriptions.length} subscription product(s)`);
    }

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
          console.log(`[Product Filter] Excluding value card product ${product.id} (${product.name}): not available for business unit ${state.selectedBusinessUnit}`);
          return false;
        }
      }
      
      return true;
    });
    
    if (valueCards.length !== originalValueCardCount) {
      console.log(`[Product Filter] Filtered ${originalValueCardCount - valueCards.length} value card product(s)`);
    }

    // Store in state
    state.subscriptions = subscriptions;
    state.valueCards = valueCards;

    console.log(`Loaded ${subscriptions.length} subscriptions and ${valueCards.length} value cards`);

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
  // Render subscriptions (memberships) into the membership category
  const membershipPlansList = document.querySelector('[data-category="membership"] .plans-list');
  if (membershipPlansList && state.subscriptions.length > 0) {
    membershipPlansList.innerHTML = '';
    
    state.subscriptions.forEach((product) => {
      const planCard = document.createElement('div');
      planCard.className = 'plan-card';
      // Use numeric ID from API (e.g., 56)
      const productId = product.id;
      planCard.dataset.plan = `membership-${productId}`; // For backward compatibility
      planCard.dataset.productId = productId; // Store API product ID (numeric)
      
      // Extract price from API structure: priceWithInterval.price.amount is in cents/øre (e.g., 46900 = 469.00 DKK)
      const priceInCents = product.priceWithInterval?.price?.amount || 
                           product.price?.amount || 
                           product.amount || 
                           0;
      const price = priceInCents > 0 ? priceInCents / 100 : 0; // Convert from cents to main currency unit
      const currency = product.priceWithInterval?.price?.currency || 
                       product.price?.currency || 
                       product.currency || 
                       'DKK';
      
      // Determine price unit from interval (e.g., "MONTH" = "kr/mo")
      const intervalUnit = product.priceWithInterval?.interval?.unit || 'MONTH';
      const priceUnit = intervalUnit === 'MONTH' ? 'kr/mo' : 
                       intervalUnit === 'YEAR' ? 'kr/year' : 'kr';
      
      const description = product.description || product.productNumber || '';
      
      planCard.innerHTML = `
        <div class="plan-info">
          <div class="plan-type">${product.name || 'Membership'}</div>
          <div class="plan-details">
            <div class="plan-price">
              <span class="price-amount">${price > 0 ? numberFormatter.format(price) : '—'}</span>
              <span class="price-unit">${priceUnit}</span>
            </div>
            ${description ? `<span class="plan-description">${description}</span>` : ''}
          </div>
        </div>
        <div class="check-circle"></div>
      `;
      
      // Event listeners will be set up by setupNewAccessStep()
      membershipPlansList.appendChild(planCard);
    });
  }

  // Render value cards (punch cards) into the punchcard category
  const punchCardPlansList = document.querySelector('[data-category="punchcard"] .plans-list');
  if (punchCardPlansList && state.valueCards.length > 0) {
    punchCardPlansList.innerHTML = '';
    
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
      
      planCard.innerHTML = `
        <div class="plan-info">
          <div class="plan-type">${product.name || 'Punch Card'}</div>
          <div class="plan-details">
            <div class="plan-price">
              <span class="price-amount">${price > 0 ? numberFormatter.format(price) : '—'}</span>
              <span class="price-unit">kr</span>
            </div>
            ${description ? `<span class="plan-description">${description}</span>` : ''}
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
// Cache for geocoded addresses
const geocodeCache = new Map();

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Validate inputs
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || 
      typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
      isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    console.error('[Distance Calculation] Invalid coordinates:', { lat1, lon1, lat2, lon2 });
    return null;
  }
  
  // Validate coordinate ranges (lat: -90 to 90, lon: -180 to 180)
  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
    console.error('[Distance Calculation] Invalid latitude (must be -90 to 90):', { lat1, lat2 });
    return null;
  }
  if (lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) {
    console.error('[Distance Calculation] Invalid longitude (must be -180 to 180):', { lon1, lon2 });
    return null;
  }
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  
  return distance;
}

// Check if geolocation is available
function isGeolocationAvailable() {
  return 'geolocation' in navigator;
}

// Check geolocation permission status
async function checkGeolocationPermission() {
  if (!isGeolocationAvailable()) {
    return 'not-supported';
  }
  
  // Note: Permission API is not widely supported, so we'll try to get location
  // and handle the error if permission is denied
  return 'unknown';
}

// Get user's current location with explicit permission request
async function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    const options = {
      enableHighAccuracy: true, // Request high accuracy GPS if available
      timeout: 20000, // Increased timeout for better accuracy
      maximumAge: 0 // Don't use cached position, always get fresh location for accuracy
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy // in meters
        };
        
        // Log location accuracy for debugging
        console.log('[Geolocation] User location obtained:', {
          coordinates: { lat: location.latitude, lon: location.longitude },
          accuracy: `${location.accuracy.toFixed(0)} meters`,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed
        });
        
        resolve(location);
      },
      (error) => {
        let errorMessage = 'Unable to get your location';
        let errorType = 'unknown';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access in your browser settings and try again.';
            errorType = 'permission-denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please check your device location settings and try again.';
            errorType = 'unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please check your connection and try again.';
            errorType = 'timeout';
            break;
        }
        
        const errorObj = new Error(errorMessage);
        errorObj.type = errorType;
        reject(errorObj);
      },
      options
    );
  });
}

// Hardcoded coordinates for known Boulders gyms (faster than geocoding)
// Format: "Street, PostalCode City" -> {latitude, longitude}
// Hardcoded coordinates for known Boulders gyms (verified and updated for accuracy)
// Format: "Street, PostalCode City" -> {latitude, longitude}
const GYM_COORDINATES = {
  'Skjernvej 4D, 9220 Aalborg': { latitude: 57.0488, longitude: 9.9217 },
  'Søren Frichs Vej 54, 8230 Aarhus': { latitude: 56.15101, longitude: 10.16778 }, // Updated: Boulders Aarhus Aaby
  'Ankersgade 12, 8000 Aarhus': { latitude: 56.14836, longitude: 10.19124 }, // Updated: Boulders Aarhus City
  'Graham Bells Vej 18A, 8200 Aarhus': { latitude: 56.20514, longitude: 10.18169 }, // Updated: Boulders Aarhus Nord
  'Søren Nymarks Vej 6A, 8270 Aarhus': { latitude: 56.1075, longitude: 10.2039 }, // Updated: Boulders Aarhus Syd
  'Amager Landevej 233, 2770 København': { latitude: 55.6500, longitude: 12.5833 },
  'Strandmarksvej 20, 2650 København': { latitude: 55.6500, longitude: 12.4833 },
  'Bådehavnsgade 38, 2450 København': { latitude: 55.6500, longitude: 12.5500 },
  'Wichmandsgade 11, 5000 Odense': { latitude: 55.40252, longitude: 10.37333 }, // Updated: Verified via Nominatim
  'Vigerslev Allé 47, 2500 København': { latitude: 55.6667, longitude: 12.5167 },
  'Vanløse Torv 1, Kronen Vanløse, 2720 København': { latitude: 55.6833, longitude: 12.4833 },
  'Vesterbrogade 149, 1620 København V': { latitude: 55.6761, longitude: 12.5683 },
};

// Helper to create address key for lookup
function createAddressKey(address) {
  if (!address) return null;
  // Normalize the address string
  const street = (address.street || '').trim();
  const postalCode = (address.postalCode || '').trim();
  const city = (address.city || '').trim();
  return `${street}, ${postalCode} ${city}`;
}

// Find coordinates for a gym address (tries multiple matching strategies)
function findGymCoordinates(address) {
  if (!address) return null;
  
  const addressKey = createAddressKey(address);
  if (!addressKey) return null;
  
  // Try exact match first
  if (GYM_COORDINATES[addressKey]) {
    return GYM_COORDINATES[addressKey];
  }
  
  // Try partial matches (street + postal code)
  const street = address.street?.trim();
  const postalCode = address.postalCode?.trim();
  
  if (street && postalCode) {
    // Try matching by street and postal code
    for (const [key, coords] of Object.entries(GYM_COORDINATES)) {
      if (key.includes(street) && key.includes(postalCode)) {
        return coords;
      }
    }
  }
  
  return null;
}

// Geocode address to get coordinates using OpenStreetMap Nominatim (fallback)
async function geocodeAddress(address) {
  if (!address) return null;
  
  // Try hardcoded coordinates first (instant lookup, no API call needed)
  const hardcodedCoords = findGymCoordinates(address);
  if (hardcodedCoords) {
    const addressKey = createAddressKey(address);
    console.log(`[Geocoding] Using hardcoded coordinates for: ${addressKey}`);
    return hardcodedCoords;
  }
  
  // Create address key for cache lookup
  const addressKey = createAddressKey(address);
  if (!addressKey) return null;
  
  // Check cache
  if (geocodeCache.has(addressKey)) {
    return geocodeCache.get(addressKey);
  }
  
  try {
    // Use OpenStreetMap Nominatim geocoding service (free, no API key)
    // Use more specific query format for better accuracy - postal code first for precision
    const query = encodeURIComponent(`${address.postalCode} ${address.city}, ${address.street}, Denmark`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=dk&addressdetails=1&extratags=1&zoom=18`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Boulders Membership Signup' // Required by Nominatim
      }
    });
    
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const coords = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon)
      };
      
      // Log geocoding result for accuracy verification
      console.log(`[Geocoding] Geocoded ${addressKey}:`, {
        coordinates: coords,
        displayName: result.display_name,
        importance: result.importance,
        type: result.type
      });
      
      // Cache the result
      geocodeCache.set(addressKey, coords);
      
      // Rate limiting: Nominatim allows 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      return coords;
    }
    
    return null;
  } catch (error) {
    console.warn('[Geocoding] Failed to geocode address:', addressKey, error);
    return null;
  }
}

// Calculate distances for all gyms and sort by distance
async function calculateGymDistances(gyms, userLat, userLon, userAccuracy = null) {
  console.log('[Distance Calculation] User location:', { 
    latitude: userLat, 
    longitude: userLon,
    accuracy: userAccuracy ? `${userAccuracy.toFixed(0)} meters` : 'unknown'
  });
  
  // Warn if accuracy is poor (IP-based geolocation is typically > 1000m)
  if (userAccuracy && userAccuracy > 1000) {
    console.warn('[Distance Calculation] WARNING: Low location accuracy detected. Distance calculations may be inaccurate.', {
      accuracy: `${userAccuracy.toFixed(0)} meters`,
      note: 'This suggests IP-based geolocation rather than GPS. Distances may be off by hundreds of kilometers.'
    });
  }
  
  // First, try to get coordinates from API response
  const gymsWithCoords = await Promise.all(gyms.map(async (gym) => {
    let gymLat = null;
    let gymLon = null;
    
    if (gym.address) {
      // Try address.latitude/longitude first
      if (gym.address.latitude !== undefined && gym.address.longitude !== undefined) {
        gymLat = parseFloat(gym.address.latitude);
        gymLon = parseFloat(gym.address.longitude);
      }
      // Try address.coordinates (GeoJSON format: [longitude, latitude])
      else if (gym.address.coordinates && Array.isArray(gym.address.coordinates)) {
        gymLat = parseFloat(gym.address.coordinates[1]);
        gymLon = parseFloat(gym.address.coordinates[0]);
      }
    }
    
    // Try top-level coordinates
    if ((gymLat === null || isNaN(gymLat)) && gym.coordinates && Array.isArray(gym.coordinates)) {
      gymLat = parseFloat(gym.coordinates[1]);
      gymLon = parseFloat(gym.coordinates[0]);
    }
    
    // Validate parsed coordinates
    if (isNaN(gymLat) || isNaN(gymLon)) {
      gymLat = null;
      gymLon = null;
    }
    
    // If no coordinates found, try geocoding
    if ((gymLat === null || gymLon === null) && gym.address) {
      console.log(`[Distance Calculation] Geocoding ${gym.name}...`);
      const coords = await geocodeAddress(gym.address);
      if (coords) {
        gymLat = coords.latitude;
        gymLon = coords.longitude;
        console.log(`[Distance Calculation] Geocoded ${gym.name}:`, coords);
      } else {
        console.warn(`[Distance Calculation] Failed to geocode ${gym.name}`);
      }
    }
    
    return { ...gym, gymLat, gymLon };
  }));
  
  // Calculate distances
  const gymsWithDistances = gymsWithCoords.map(gym => {
    if (gym.gymLat === null || gym.gymLon === null || isNaN(gym.gymLat) || isNaN(gym.gymLon)) {
      return { ...gym, distance: null };
    }
    
    const distance = calculateDistance(
      userLat,
      userLon,
      gym.gymLat,
      gym.gymLon
    );
    
    // Log detailed distance calculation for debugging
    console.log(`[Distance Calculation] ${gym.name}:`, {
      userLocation: { lat: userLat, lon: userLon },
      gymLocation: { lat: gym.gymLat, lon: gym.gymLon },
      distance: `${distance.toFixed(2)} km`,
      address: gym.address ? `${gym.address.street}, ${gym.address.postalCode} ${gym.address.city}` : 'N/A',
      // Verify coordinates are valid (lat should be -90 to 90, lon should be -180 to 180)
      coordinateValidation: {
        userLatValid: userLat >= -90 && userLat <= 90,
        userLonValid: userLon >= -180 && userLon <= 180,
        gymLatValid: gym.gymLat >= -90 && gym.gymLat <= 90,
        gymLonValid: gym.gymLon >= -180 && gym.gymLon <= 180
      }
    });
    
    return { ...gym, distance };
  });
  
  // Sort by distance
  const sorted = gymsWithDistances.sort((a, b) => {
    // Sort by distance, null distances go to the end
    if (a.distance === null && b.distance === null) return 0;
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });
  
  console.log('[Distance Calculation] Sorted gyms:', sorted.map(g => ({
    name: g.name,
    distance: g.distance !== null ? `${g.distance.toFixed(2)} km` : 'N/A'
  })));
  
  return sorted;
}

// Format distance for display
function formatDistance(distance) {
  if (distance === null || distance === undefined) return '';
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }
  return `${distance.toFixed(1)} km`;
}

// Load gyms from API and update UI
async function loadGymsFromAPI() {
  try {
    const response = await businessUnitsAPI.getBusinessUnits();
    
    // Handle different response formats - could be array or object with data property
    const gyms = Array.isArray(response) ? response : (response.data || response.items || []);
    
    console.log('Loaded gyms from API:', gyms);
    console.log(`Found ${gyms.length} business units`);
    
    // Store gyms for distance calculation
    gymsWithDistances = gyms;
    
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
      console.log('[Load Gyms] Sample gym structure:', {
        name: gyms[0].name,
        address: gyms[0].address,
        hasLatLon: !!(gyms[0].address?.latitude && gyms[0].address?.longitude),
        fullGym: gyms[0]
      });
    }
    
    // If user location is available, sort by distance
    let gymsToDisplay = gyms;
    if (userLocation) {
      console.log('[Load Gyms] User location available, calculating distances...', userLocation);
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
        userLocation.accuracy // Pass accuracy for validation
      );
      gymsWithDistances = gymsToDisplay;
      
      // Ensure location button is highlighted if location is active
      const locationBtn = document.getElementById('findNearestGym');
      if (locationBtn && userLocation) {
        locationBtn.classList.add('active');
      }
      
      // Log first few gyms to verify sorting
      console.log('[Load Gyms] First 3 gyms after sorting:', gymsToDisplay.slice(0, 3).map(g => ({
        name: g.name,
        distance: g.distance !== null ? `${g.distance.toFixed(2)} km` : 'N/A',
        hasCoordinates: !!(g.address?.latitude && g.address?.longitude)
      })));
    } else {
      console.log('[Load Gyms] No user location available, displaying gyms in original order');
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
          console.log('[Load Gyms] Marking as nearest:', gym.name, `${gym.distance.toFixed(2)} km`);
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
    
    // Re-setup forward arrow event listener
    setupForwardArrowEventListeners();
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


// Find nearest gym using geolocation
async function findNearestGym() {
  const locationBtn = document.getElementById('findNearestGym');
  const locationStatus = document.getElementById('locationStatus');
  
  if (!locationBtn || !locationStatus) return;
  
  // Check if location is already active - toggle it off
  if (userLocation && locationBtn.classList.contains('active')) {
    console.log('[Geolocation] Toggling location off, restoring default order');
    
    // Clear user location
    userLocation = null;
    gymsWithDistances = [];
    
    // Remove active state
    locationBtn.classList.remove('active');
    
    // Reload gyms in default order (without distance sorting)
    await loadGymsFromAPI();
    
    return;
  }
  
  // Check if geolocation is supported
  if (!isGeolocationAvailable()) {
    locationStatus.style.display = 'none';
    return;
  }
  
  // Update button state
  locationBtn.disabled = true;
  
  // Hide status text
  locationStatus.style.display = 'none';
  
  try {
    // Get user location - this will trigger browser permission prompt
    const location = await getUserLocation();
    userLocation = location;
    
    console.log('User location:', location);
    
    // Hide status text
    locationStatus.style.display = 'none';
    
    // Reload gyms with distance sorting
    await loadGymsFromAPI();
    
    // Highlight icon button (add active class)
    locationBtn.classList.add('active');
    locationBtn.disabled = false;
    
  } catch (error) {
    console.error('Error getting location:', error);
    
    // Show helpful error message based on error type
    let errorMessage = error.message;
    let showHelp = false;
    
    if (error.type === 'permission-denied') {
      errorMessage = 'Location access was denied. Please allow location access in your browser settings and try again.';
      showHelp = true;
    } else if (error.type === 'unavailable') {
      errorMessage = 'Location information is unavailable. Please ensure location services are enabled on your device.';
      showHelp = true;
    }
    
    // Hide status text (no error messages shown)
    locationStatus.style.display = 'none';
    
    // Remove active state from button
    locationBtn.classList.remove('active');
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
  const addressString = `${address.street}, ${address.postalCode} ${address.city}`;
  
  // Add distance badge if available
  const distanceBadge = gym.distance !== null && gym.distance !== undefined
    ? `<div class="gym-distance-badge">${formatDistance(gym.distance)}</div>`
    : '';
  
  // Add nearest badge if this is the nearest gym (positioned absolutely in top right)
  const nearestBadge = isNearest
    ? `<div class="nearest-badge">Nearest</div>`
    : '';
  
  gymItem.innerHTML = `
    ${nearestBadge}
    <div class="gym-info">
      <div class="gym-name">${gym.name}</div>
      <div class="gym-details">
        <div class="gym-address">${addressString}</div>
        ${distanceBadge}
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
    item.addEventListener('click', () => handleGymSelection(item));
  });
}

// Setup event listeners for forward arrow
function setupForwardArrowEventListeners() {
  const forwardArrowBtn = document.getElementById('forwardArrowBtn');
  if (forwardArrowBtn) {
    forwardArrowBtn.addEventListener('click', handleForwardNavigation);
  }
}

// Handle forward navigation
function handleForwardNavigation() {
  // Step 3: Hold the app on step 1 (gym selection) until one option is selected
  if (state.currentStep === 1 && !state.selectedGymId) {
    // Show a message or prevent navigation if no gym is selected
    return;
  }
  
  // Only allow forward navigation if we're not on the last step
  if (state.currentStep < TOTAL_STEPS) {
    nextStep();
  }
}

const state = {
  currentStep: 1,
  selectedGymId: null,
  selectedBusinessUnit: null, // Step 3: Store chosen business unit for API requests
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
  authenticatedEmail: null,
  checkoutInProgress: false, // Flag to prevent duplicate checkout attempts
  loginInProgress: false, // Prevent duplicate login submissions
  paymentMethod: null,
  // Step 9: Payment link state
  paymentLink: null, // Generated payment link for checkout
  paymentLinkGenerated: false, // Flag indicating if payment link has been generated
  // Discount code state
  discountCode: null, // Applied discount code
  discountApplied: false, // Whether discount is currently applied
  // Step 5: Store fetched products from API
  subscriptions: [], // Fetched membership products
  valueCards: [], // Fetched punch card products
  subscriptionAdditions: [], // Fetched add-ons for selected membership
  selectedProductType: null, // 'membership' or 'punch-card'
  selectedProductId: null, // The actual product ID from API
  selectedAddonIds: [], // Array of selected add-on product IDs
  // Step 4: Reference data cache
  referenceData: {}, // Cached reference/lookup data (countries, regions, currencies, etc.)
  referenceDataLoaded: false, // Flag to track if reference data has been loaded
  subscriptionAttachedOrderId: null, // Tracks which order already has the membership attached
};

let orderCreationPromise = null;
let subscriptionAttachPromise = null;
let tokenValidationCooldownUntil = 0;

function isUserAuthenticated() {
  return typeof window.getAccessToken === 'function' && Boolean(window.getAccessToken());
}

function getTokenMetadata() {
  if (typeof window.getTokenMetadata === 'function') {
    return window.getTokenMetadata();
  }
  return null;
}

function syncAuthenticatedCustomerState(username = null, email = null) {
  const metadata = getTokenMetadata();
  const resolvedUsername = username || state.customerId || metadata?.username || metadata?.userName;
  const resolvedEmail = email || state.authenticatedEmail || metadata?.email;

  if (resolvedUsername) {
    state.customerId = String(resolvedUsername);
  }

  if (resolvedEmail) {
    state.authenticatedEmail = resolvedEmail;
  }

  refreshLoginUI();
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
  if (!templates.addon) {
    // Fallback simple cards if template missing
    ADDONS.forEach((addon) => {
      const card = document.createElement('div');
      card.className = 'plan-card addon-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div style="font-weight:600">${addon.name}</div>
        <div>${currencyFormatter.format(addon.price.discounted)}</div>
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
  ADDONS.forEach((addon) => {
    const card = templates.addon.content.firstElementChild.cloneNode(true);
    const checkCircle = card.querySelector('[data-action="toggle-addon"]');
    if (checkCircle) checkCircle.dataset.addonId = addon.id;
    const nameEl = card.querySelector('[data-element="name"]');
    const originalPriceEl = card.querySelector('[data-element="originalPrice"]');
    const discountedPriceEl = card.querySelector('[data-element="discountedPrice"]');
    const descriptionEl = card.querySelector('[data-element="description"]');
    const featuresEl = card.querySelector('[data-element="features"]');
    if (nameEl) nameEl.textContent = addon.name;
    if (originalPriceEl) originalPriceEl.textContent = currencyFormatter.format(addon.price.original);
    if (discountedPriceEl) discountedPriceEl.textContent = currencyFormatter.format(addon.price.discounted);
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
  cacheDom();
  cacheTemplates();
  renderCatalog();
  refreshCarousels();
  updateCartSummary();
  initAuthModeToggle();
  updateCheckoutButton();
  setupEventListeners();
  setupForwardArrowEventListeners();
  // Apply conditional visibility for Boost on load
  applyConditionalSteps();
  updateStepIndicator();
  updateNavigationButtons();
  
  // Load gyms from API
  loadGymsFromAPI();
  
  // Restore location button active state if location exists
  const locationBtn = document.getElementById('findNearestGym');
  if (locationBtn && userLocation) {
    locationBtn.classList.add('active');
  }
  
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


// Translation system
const translations = {
  da: {
    'footer.terms.title': 'Vilkår og Betingelser',
    'footer.terms.membership': 'Vilkår og Betingelser for Medlemskab',
    'footer.terms.punchcard': 'Vilkår og Betingelser for Klippekort',
    'footer.policies.title': 'Politikker',
    'footer.policies.privacy': 'Privatlivspolitik',
    'footer.policies.cookie': 'Cookiepolitik',
    'footer.language.danish': 'Dansk',
    'footer.language.english': 'English',
    'footer.rights': 'Alle rettigheder forbeholdes',
    'modal.loading': 'Indlæser...',
  },
  en: {
    'footer.terms.title': 'Terms and Conditions',
    'footer.terms.membership': 'Terms and Conditions for Membership',
    'footer.terms.punchcard': 'Terms and Conditions for Punch Card',
    'footer.policies.title': 'Policies',
    'footer.policies.privacy': 'Privacy Policy',
    'footer.policies.cookie': 'Cookie Policy',
    'footer.language.danish': 'Dansk',
    'footer.language.english': 'English',
    'footer.rights': 'All rights reserved',
    'modal.loading': 'Loading...',
  },
};

// Get current language from localStorage or default to 'da'
function getCurrentLanguage() {
  return localStorage.getItem('boulders-language') || 'da';
}

// Set current language
function setCurrentLanguage(lang) {
  localStorage.setItem('boulders-language', lang);
  document.documentElement.lang = lang;
  updateTranslations();
}

// Update all translations on the page
function updateTranslations() {
  const lang = getCurrentLanguage();
  const elements = document.querySelectorAll('[data-i18n-key]');
  
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n-key');
    if (translations[lang] && translations[lang][key]) {
      element.textContent = translations[lang][key];
    }
  });
  
  // Update language button active states
  const danishBtn = document.getElementById('languageSwitcher');
  const englishBtn = document.getElementById('languageSwitcherEng');
  
  if (danishBtn && englishBtn) {
    if (lang === 'da') {
      danishBtn.classList.add('active');
      englishBtn.classList.remove('active');
    } else {
      danishBtn.classList.remove('active');
      englishBtn.classList.add('active');
    }
  }
}

// Initialize language switcher
function initLanguageSwitcher() {
  const danishBtn = document.getElementById('languageSwitcher');
  const englishBtn = document.getElementById('languageSwitcherEng');
  
  if (danishBtn) {
    danishBtn.addEventListener('click', () => {
      setCurrentLanguage('da');
    });
  }
  
  if (englishBtn) {
    englishBtn.addEventListener('click', () => {
      setCurrentLanguage('en');
    });
  }
  
  // Set initial language
  const currentLang = getCurrentLanguage();
  document.documentElement.lang = currentLang;
  updateTranslations();
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize language switcher
  initLanguageSwitcher();
  
  // Check if we're returning from payment before initializing
  const urlParams = new URLSearchParams(window.location.search);
  const paymentReturn = urlParams.get('payment');
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
  
  // If returning from payment, fetch order data and show confirmation view
  if (paymentReturn === 'return' && orderId) {
    // Move to final step to show confirmation
    state.currentStep = TOTAL_STEPS;
    showStep(state.currentStep);
    updateStepIndicator();
    updateNavigationButtons();
    
    // Fetch order data from API to populate confirmation view
    loadOrderForConfirmation(parseInt(orderId, 10));
  }
  
  // Step 6: Validate tokens on app load
  validateTokensOnLoad();

  // Restore authenticated state from stored tokens (if available)
  syncAuthenticatedCustomerState();
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
  DOM.cartTotal = document.querySelector('[data-summary-field="cart-total"]');
  DOM.billingPeriod = document.querySelector('[data-summary-field="billing-period"]');
  DOM.paymentOverview = document.querySelector('.payment-overview');
  DOM.payNow = document.querySelector('[data-summary-field="pay-now"]');
  DOM.monthlyPayment = document.querySelector('[data-summary-field="monthly-payment"]');
  DOM.paymentBillingPeriod = document.querySelector('[data-summary-field="payment-billing-period"]');
  DOM.checkoutBtn = document.querySelector('[data-action="submit-checkout"]');
  DOM.termsConsent = document.getElementById('termsConsent');
  DOM.discountToggle = document.querySelector('.discount-toggle');
  DOM.discountForm = document.querySelector('.discount-form');
  DOM.discountInput = document.querySelector('.discount-input');
  DOM.applyDiscountBtn = document.querySelector('.apply-discount-btn');
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
  DOM.loginFormContainer = document.querySelector('[data-login-form-container]');
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
  findNearestGymBtn?.addEventListener('click', findNearestGym);


  // Back arrow event listener
  const backToGymBtn = document.getElementById('backToGymBtn');
  backToGymBtn?.addEventListener('click', () => handleBackToGym());

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
      openTermsModal(termsType);
    }
    
    if (e.target === DOM.termsModalClose || e.target.closest('#termsModalClose')) {
      closeTermsModal();
    }
  });
  
  // Close terms modal when clicking outside
  if (DOM.termsModal) {
    DOM.termsModal.addEventListener('click', (e) => {
      if (e.target === DOM.termsModal) {
        closeTermsModal();
      }
    });
  }
  
  // Close terms modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.termsModal && DOM.termsModal.style.display !== 'none') {
      closeTermsModal();
    }
  });
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
    showToast(`Logged in as ${username}.`, 'success');
    state.authenticatedEmail = email;
    syncAuthenticatedCustomerState(username, email);
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
  } catch (error) {
    console.error('[login] Login failed:', error);
    showToast(getErrorMessage(error, 'Login'), 'error');
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

<h3>§1 Generelt</h3>
<p>Følgende regelsæt er gældende for dit medlemskab i Boulders. Gældende regelsæt vil altid kunne findes på Boulders.dk. Vi gør opmærksom på at løbende ændringer af priser, betingelser, åbningstider og regelsæt kan forekomme.</p>

<p>Dit medlemskab i Boulders er personligt og må ikke benyttes af andre. Ved misbrug af dit medlemskab eller medlemskort, opsiges dit medlemskab øjeblikkeligt uden refusion for den resterende periode af dit medlemskab.</p>

<p>For at kunne identificere dig som medlem opbevares et billede af dig sammen med dine øvrige personoplysninger. Hvis der sker ændringer i de oplysninger, du har givet ved medlemskabets oprettelse, skal du straks meddele dette til Boulders. Du er som medlem selv ansvarlig for, at Boulders til enhver tid har dine korrekte personoplysninger herunder særligt e-mailadresse.</p>

<h3>§3 Indmeldelse</h3>
<p>Dit medlemskab i Boulders er et løbende abonnement med automatisk fornyelse, der starter på købsdagen og fortsætter indtil det opsiges efter §8.</p>

<h3>§8 Opsigelse af medlemskab</h3>
<p>En opsigelse skal ske online på din medlemsprofil eller pr. e-mail til medlem@boulders.dk. Opsigelsen skal indeholde dit navn og/eller medlemsnummer. Opsigelsen er gyldig fra den dag, Boulders modtager den, og du har modtaget en bekræftelse fra Boulders, der anerkender opsigelsen.</p>

<p>Opsigelsesperioden for et medlemskab er resten af den løbende måned + næste hele afsluttede måned. Medlemskaber kan derfor kun ophøre med effekt sidste dag i en måned.</p>

<h3>§10 Helbredstilstand og personskade</h3>
<p>Klatring er en sportsaktivitet, hvor det er påregneligt, at der kan ske skader og uheld. Kunden er derfor indforstået med at benyttelse af Boulders' faciliteter, herunder klatrefaciliteter, foretages på kundens eget ansvar, samt at kunden ikke kan gøre erstatningsansvar gældende på nogen måde overfor Boulders.</p>`,
    en: `<h2>Terms and Conditions for Members and 15-Day Climbing Pass at Boulders</h2>
<p><strong>Applies to all memberships</strong></p>

<h3>Acceptance</h3>
<p>By completing the registration process, you have accepted the following terms and conditions. Your acceptance of the agreement is a binding agreement between the member and Boulders. Your acceptance hereof functions as a signature.</p>

<h3>Highlights</h3>
<p>You must read the entire terms and conditions thoroughly before signing. Pay particular attention to the following:</p>
<p><strong>From §3:</strong> "Your membership at Boulders is a continuous subscription with automatic renewal. The subscription starts on the purchase date and continues until terminated according to §8."</p>
<p><strong>From §8:</strong> "Termination must be done online on your membership profile or by email to medlem@boulders.dk." … "The termination period for a membership is the remainder of the current month plus the following full calendar month. Memberships can therefore only end on the last day of a month."</p>
<p><strong>From §10:</strong> "Climbing is a sports activity where injuries and accidents are foreseeable. Customers acknowledge that using Boulders' facilities, including climbing facilities, is at their own risk and that they cannot claim liability or compensation from Boulders in any way."</p>

<h3>§1 General</h3>
<p>The following terms and conditions apply to your membership at Boulders. Current terms and conditions can always be found on Boulders.dk. We note that ongoing changes to prices, conditions, opening hours, and terms may occur.</p>

<p>Your membership at Boulders is personal and may not be used by others. In case of misuse of your membership or membership card, your membership will be terminated immediately without refund for the remaining period.</p>

<h3>§3 Registration</h3>
<p>Your membership at Boulders is a continuous subscription with automatic renewal that starts on the purchase date and continues until terminated according to §8.</p>

<h3>§8 Termination of Membership</h3>
<p>Termination must be done online on your membership profile or by email to medlem@boulders.dk. The termination must contain your name and/or membership number. The termination is valid from the day Boulders receives it, and you have received a confirmation from Boulders acknowledging the termination.</p>

<p>The termination period for a membership is the remainder of the current month plus the following full calendar month. Memberships can therefore only end on the last day of a month.</p>

<h3>§10 Health Conditions and Personal Injury</h3>
<p>Climbing is a sports activity where injuries and accidents are foreseeable. Customers acknowledge that using Boulders' facilities, including climbing facilities, is at their own risk and that they cannot claim liability or compensation from Boulders in any way.</p>`
  },
  punchcard: {
    da: `<h2>Vilkår og betingelser for klippekort</h2>
<p>Klippekort giver adgang til Boulders' klatrecentre i henhold til nedenstående betingelser.</p>

<h3>Gældende periode</h3>
<p>Klippekortet er gyldigt i 5 år fra købsdatoen.</p>

<h3>Brug</h3>
<p>Hvert klip på kortet giver adgang til ét besøg. Kortet kan deles med andre, men hvert klip kan kun bruges én gang.</p>

<h3>Refill</h3>
<p>Hvis du refiller dit klippekort inden for 14 dage efter dit sidste klip, får du 100 kr. rabat ved køb af nyt klippekort i hallen.</p>

<h3>Opgradere til medlemskab</h3>
<p>Klippekort kan opgraderes til medlemskab. Kontakt Boulders for yderligere information.</p>

<h3>Ansvarsfraskrivelse</h3>
<p>Klatring er en sportsaktivitet, hvor det er påregneligt, at der kan ske skader og uheld. Brug af Boulders' faciliteter foretages på eget ansvar.</p>`,
    en: `<h2>Terms and Conditions for Punch Card</h2>
<p>Punch cards provide access to Boulders' climbing centers according to the following conditions.</p>

<h3>Validity Period</h3>
<p>The punch card is valid for 5 years from the purchase date.</p>

<h3>Usage</h3>
<p>Each clip on the card provides access to one visit. The card can be shared with others, but each clip can only be used once.</p>

<h3>Refill</h3>
<p>If you refill your punch card within 14 days after your last clip, you will receive 100 kr. discount when purchasing a new punch card at the gym.</p>

<h3>Upgrade to Membership</h3>
<p>Punch cards can be upgraded to membership. Contact Boulders for further information.</p>

<h3>Disclaimer</h3>
<p>Climbing is a sports activity where injuries and accidents are foreseeable. Use of Boulders' facilities is at your own risk.</p>`
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
  
  const termsTitles = {
    membership: {
      da: 'Vilkår og Betingelser for Medlemskab',
      en: 'Terms and Conditions for Membership',
    },
    punchcard: {
      da: 'Vilkår og Betingelser for Klippekort',
      en: 'Terms and Conditions for Punch Card',
    },
    privacy: {
      da: 'Privatlivspolitik',
      en: 'Privacy Policy',
    },
    cookie: {
      da: 'Cookiepolitik',
      en: 'Cookie Policy',
    },
  };
  
  const currentLang = getCurrentLanguage();
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
  
  // Show modal
  DOM.termsModal.style.display = 'flex';
  DOM.termsModalContent.style.display = 'block';
  DOM.termsModalLoading.style.display = 'none';
  document.body.classList.add('modal-open');
  
  // Scroll to top of modal content
  DOM.termsModalContent.scrollTop = 0;
}

function closeTermsModal() {
  if (!DOM.termsModal) return;
  
  // Clear content
  if (DOM.termsModalContent) {
    DOM.termsModalContent.innerHTML = '';
  }
  
  // Hide modal
  DOM.termsModal.style.display = 'none';
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

function refreshLoginUI() {
  if (!DOM.loginStatus && !DOM.loginFormContainer) {
    return;
  }

  const authenticated = isUserAuthenticated();
  const metadata = getTokenMetadata();
  const emailDisplay = state.authenticatedEmail || metadata?.email || metadata?.username || 'Account';

  if (DOM.loginStatus) {
    DOM.loginStatus.style.display = authenticated ? 'block' : 'none';
  }
  if (DOM.loginStatusEmail) {
    DOM.loginStatusEmail.textContent = emailDisplay;
  }
  if (DOM.loginFormContainer) {
    DOM.loginFormContainer.style.display = authenticated ? 'none' : '';
  }
}

function handleLogout() {
  if (typeof window.clearTokens === 'function') {
    window.clearTokens();
  }
  state.customerId = null;
  state.authenticatedEmail = null;
  refreshLoginUI();
  showToast('You have been logged out.', 'info');
}

function renderCatalog() {
  // Step 5: Only render mock data if API data is not available yet
  // API data will be loaded when business unit is selected and will replace this
  if (state.subscriptions.length === 0 && state.valueCards.length === 0) {
    renderMembershipPlans();
    renderValueCards();
  }
  renderAddons();
}

function renderMembershipPlans() {
  if (!templates.membership || !DOM.membershipPlans) return;
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
    if (priceValueEl) priceValueEl.textContent = numberFormatter.format(plan.price);
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
  // Remove selected class from all gym items
  document.querySelectorAll('.gym-item').forEach(gymItem => {
    gymItem.classList.remove('selected');
  });
  
  // Add selected class to clicked item
  item.classList.add('selected');
  
  // Step 3: Store the chosen unit in client state so every later request can reference it
  // Extract numeric ID from data attribute (format: "gym-{id}")
  const gymIdString = item.dataset.gymId;
  const numericId = gymIdString ? gymIdString.replace('gym-', '') : null;
  
  // Step 4: If business unit changed, clear cached reference data to force refresh
  const previousBusinessUnit = state.selectedBusinessUnit;
  if (previousBusinessUnit !== numericId) {
    state.referenceData = {};
    state.referenceDataLoaded = false;
  }
  
  state.selectedGymId = numericId; // Store numeric ID for API requests
  state.selectedBusinessUnit = numericId; // Also store as businessUnit for clarity
  
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
  
  // Auto-advance to next step after a short delay
  setTimeout(() => {
    nextStep();
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
    } else if (category === 'membership') {
      displayName = `${planType} Membership`;
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
    if (priceValueEl) priceValueEl.textContent = numberFormatter.format(plan.price);
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
    if (quantityTotalEl) quantityTotalEl.textContent = numberFormatter.format(plan.min * plan.price);

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

  ADDONS.forEach((addon) => {
    const card = templates.addon.content.firstElementChild.cloneNode(true);
    card.dataset.planId = addon.id;

    const nameEl = card.querySelector('[data-element="name"]');
    const originalPriceEl = card.querySelector('[data-element="originalPrice"]');
    const discountedPriceEl = card.querySelector('[data-element="discountedPrice"]');
    const descriptionEl = card.querySelector('[data-element="description"]');
    const featuresEl = card.querySelector('[data-element="features"]');
    const buttonEl = card.querySelector('[data-action="toggle-addon"]');

    if (nameEl) nameEl.textContent = addon.name;
    if (originalPriceEl) originalPriceEl.textContent = currencyFormatter.format(addon.price.original);
    if (discountedPriceEl) discountedPriceEl.textContent = currencyFormatter.format(addon.price.discounted);
    if (descriptionEl) descriptionEl.textContent = addon.description;
    if (featuresEl) {
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
      item.classList.toggle('expanded');
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
  const isMembership = category === 'membership';
  
  state.membershipPlanId = planId; // Keep for backward compatibility
  state.selectedProductId = productId; // Store API product ID
  state.selectedProductType = isMembership ? 'membership' : 'punch-card';
  
  console.log('Selected plan:', planId, 'Product ID:', productId, 'Type:', state.selectedProductType);
  
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
    membership: 'Membership is an ongoing subscription with automatic renewal. No signup or cancellation fees. Notice period is the rest of the month + 1 month. By signing up you accept <a href="#">terms and Conditions</a>.',
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
    
    console.log('Setting up category header for:', category.dataset.category, header);
    
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
        
        // Auto-scroll removed - will be revisited later
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
      state.selectedProductType = category === 'membership' ? 'membership' : 'punch-card';
      
      // Step 5: If membership is selected, fetch add-ons immediately
      if (category === 'membership' && productId) {
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
          
          // Auto-advance to next step after a short delay
          setTimeout(() => {
            nextStep();
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
          
          // Reset card animation and auto-advance to next step
          setTimeout(() => {
            card.style.transform = 'scale(1)';
            card.style.boxShadow = '';
            nextStep();
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
  const toggleBtns = document.querySelectorAll('.auth-mode-btn');
  const loginSection = document.querySelector('[data-auth-section="login"]');
  const createSection = document.querySelector('[data-auth-section="create"]');
  
  // Set initial state - if user is logged in, select login tab, otherwise create account
  const isAuthenticated = isUserAuthenticated();
  const initialMode = isAuthenticated ? 'login' : 'create';
  
  const initialBtn = document.querySelector(`[data-mode="${initialMode}"]`);
  if (initialBtn) {
    initialBtn.classList.add('active');
    // Also switch the mode to show correct section
    switchAuthMode(initialMode);
  } else {
    // Fallback to create account if button not found
    const createBtn = document.querySelector('[data-mode="create"]');
    if (createBtn) createBtn.classList.add('active');
  }
  
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      switchAuthMode(mode);
    });
  });
}

// Switch between auth modes
function switchAuthMode(mode) {
  const toggleBtns = document.querySelectorAll('.auth-mode-btn');
  const loginSection = document.querySelector('[data-auth-section="login"]');
  const createSection = document.querySelector('[data-auth-section="create"]');
  
  // Update button states
  toggleBtns.forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`[data-mode="${mode}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  
  // Show/hide sections with fade
  if (mode === 'login') {
    createSection.style.display = 'none';
    loginSection.style.display = 'block';
  } else {
    loginSection.style.display = 'none';
    createSection.style.display = 'block';
  }
}

function handleGlobalClick(event) {
  const actionable = event.target.closest('[data-action]');
  if (!actionable) return;

  const action = actionable.dataset.action;

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
      switchAuthMode(mode);
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
    case 'copy-referral': {
      handleReferralCopy();
      break;
    }
    case 'open-login': {
      showToast('Login flow handled by backend integration.', 'info');
      break;
    }
    case 'logout': {
      event.preventDefault();
      handleLogout();
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
  if (totalEl) totalEl.textContent = numberFormatter.format(total);
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
      
      // Clear city field if postal code is empty
      if (!postalCode || postalCode.length === 0) {
        if (DOM.city) {
          DOM.city.value = '';
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
              // City found - auto-fill
              if (DOM.city) {
                DOM.city.value = result;
                DOM.city.style.opacity = '1';
                console.log('[PostalCode] Auto-filled city:', result, 'for postal code:', postalCode);
              }
            } else {
              // City not found - clear field but keep readonly
              if (DOM.city) {
                DOM.city.value = '';
                DOM.city.style.opacity = '1';
              }
              console.log('[PostalCode] No city found for postal code:', postalCode);
            }
          } catch (error) {
            console.error('[PostalCode] Error looking up city:', error);
            if (DOM.city) {
              DOM.city.value = '';
              DOM.city.style.opacity = '1';
            }
          }
        } else {
          // Invalid format - clear city field
          if (DOM.city) {
            DOM.city.value = '';
            DOM.city.style.opacity = '1';
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
      
      // Clear city field if postal code is empty
      if (!postalCode || postalCode.length === 0) {
        if (DOM.parentCity) {
          DOM.parentCity.value = '';
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
              // City found - auto-fill
              if (DOM.parentCity) {
                DOM.parentCity.value = result;
                DOM.parentCity.style.opacity = '1';
                console.log('[PostalCode] Auto-filled parent city:', result, 'for postal code:', postalCode);
              }
            } else {
              // City not found - clear field but keep readonly
              if (DOM.parentCity) {
                DOM.parentCity.value = '';
                DOM.parentCity.style.opacity = '1';
              }
              console.log('[PostalCode] No city found for parent postal code:', postalCode);
            }
          } catch (error) {
            console.error('[PostalCode] Error looking up parent city:', error);
            if (DOM.parentCity) {
              DOM.parentCity.value = '';
              DOM.parentCity.style.opacity = '1';
            }
          }
        } else {
          // Invalid format - clear city field
          if (DOM.parentCity) {
            DOM.parentCity.value = '';
            DOM.parentCity.style.opacity = '1';
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
            // City found - auto-fill
            if (DOM.parentCity) {
              DOM.parentCity.value = result;
              DOM.parentCity.style.opacity = '1';
            }
          } else if (DOM.parentCity) {
            DOM.parentCity.value = '';
            DOM.parentCity.style.opacity = '1';
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
  if (!state.orderId) {
    // Check if user has items selected (membership or value cards)
    const hasItems = state.membershipPlanId || (state.valueCardQuantities && Array.from(state.valueCardQuantities.values()).some(qty => qty > 0));
    
    if (hasItems) {
      // User has items - create order first, then apply coupon
      console.log('[Discount] No order exists, creating order to apply coupon...');
      DOM.applyDiscountBtn.disabled = true;
      DOM.applyDiscountBtn.textContent = 'Creating order...';
      clearDiscountMessage();
      
      try {
        // Create order first
        const ensuredOrderId = await ensureOrderCreated('discount-application');
        if (!ensuredOrderId) {
          throw new Error('Failed to create order for coupon application');
        }
        state.orderId = ensuredOrderId;
        console.log('[Discount] Order created:', state.orderId);
        
        // Now add membership/subscription to order if needed (only if it's actually a membership)
        // Check if this is a membership (not a punch card)
        const isMembership = state.membershipPlanId && 
          (state.selectedProductType === 'membership' || 
           (typeof state.membershipPlanId === 'string' && state.membershipPlanId.startsWith('membership-')));
        
        if (isMembership) {
          try {
            await ensureSubscriptionAttached('discount-application');
            console.log('[Discount] Membership ensured on order');
          } catch (subError) {
            console.warn('[Discount] Could not attach membership to order:', subError);
            // Continue anyway - coupon might still work
          }
        }
        
        // Continue to apply coupon below (don't return)
        DOM.applyDiscountBtn.textContent = 'Applying...';
      } catch (orderError) {
        console.error('[Discount] Failed to create order for coupon:', orderError);
        // Store coupon code for later application during checkout
        state.discountCode = discountCode;
        state.discountApplied = false;
        // Update cart display even though we can't apply discount yet
        // This ensures the cart is refreshed and shows current state
        updateCartSummary();
        showDiscountMessage(`Coupon "${discountCode}" will be applied at checkout`, 'info');
        DOM.discountInput.style.borderColor = '#10B981';
        DOM.applyDiscountBtn.disabled = false;
        DOM.applyDiscountBtn.textContent = 'Apply';
        return;
      }
    } else {
      // No items selected - just store coupon code for later
      state.discountCode = discountCode;
      state.discountApplied = false;
      // Update cart display
      updateCartSummary();
      showDiscountMessage(`Coupon "${discountCode}" will be applied at checkout. Please select items first.`, 'info');
      DOM.discountInput.style.borderColor = '#10B981';
      return;
    }
  }
  
  // Order exists - apply coupon immediately
  // Set loading state
  DOM.applyDiscountBtn.disabled = true;
  DOM.applyDiscountBtn.textContent = 'Applying...';
  clearDiscountMessage();
  
  try {
    const orderAPI = new OrderAPI();
    const response = await orderAPI.applyDiscountCode(state.orderId, discountCode);
    
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
      state.totals.discountAmount = discountAmount;
      
      console.log('[Discount] Applying discount:', {
        discountCode,
        discountAmount,
        subtotal,
        finalTotal: subtotal - discountAmount,
      });
      
      // CRITICAL: Update cart totals using API-based function - this recalculates everything
      // updateCartSummary() will calculate subtotal and cart total, and render the UI
      updateCartSummary();
      
      // Force immediate UI update - ensure DOM element exists
      if (!DOM.cartTotal) {
        DOM.cartTotal = document.querySelector('[data-summary-field="cart-total"]');
      }
      
      // Force update discount display
      updateDiscountDisplay();
      
      // Also update any other cart total elements that might exist
      const allCartTotals = document.querySelectorAll('[data-summary-field="cart-total"], .cart-total .total-amount, .total-amount[data-summary-field="cart-total"]');
      allCartTotals.forEach(el => {
        const expectedTotal = currencyFormatter.format(state.totals.cartTotal);
        el.textContent = expectedTotal;
      });
      
      // Double-check the display was updated
      if (DOM.cartTotal) {
        const displayedTotal = DOM.cartTotal.textContent;
        const expectedTotal = currencyFormatter.format(state.totals.cartTotal);
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
        }
      } else {
        console.error('[Discount] DOM.cartTotal element not found after applying discount!');
      }
      
      // Show success message with discount amount
      showDiscountMessage(`Coupon "${discountCode}" applied! Discount: ${currencyFormatter.format(discountAmount)}`, 'success');
      
      // Force a visual update by triggering a reflow
      if (DOM.cartTotal) {
        DOM.cartTotal.offsetHeight; // Trigger reflow
      }
      
      // Disable input and button after successful application
      DOM.discountInput.disabled = true;
      DOM.discountInput.style.opacity = '0.6';
      DOM.discountInput.style.borderColor = '#10B981';
    } else {
      // Check if coupon was actually applied to the order (even if discountAmount is 0)
      // The API might return success but with 0 discount (e.g., for future use coupons)
      const couponDiscount = response?.couponDiscount || response?.price?.couponDiscount;
      if (couponDiscount !== undefined && couponDiscount !== null) {
        // Coupon was applied, even if discount is 0
        state.discountCode = discountCode;
        state.discountApplied = true;
        state.totals.discountAmount = 0; // Set to 0 if that's what the API returned
        updateCartSummary(); // updateCartSummary() already calls renderCartTotal()
        showDiscountMessage(`Coupon "${discountCode}" applied successfully`, 'success');
        DOM.discountInput.disabled = true;
        DOM.discountInput.style.opacity = '0.6';
        DOM.discountInput.style.borderColor = '#10B981';
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
    
    // Parse error message to extract error code
    let errorMessageText = 'Failed to apply coupon. Please try again.';
    const errorText = errorMessage;
    
    // Check for specific error codes in the response
    if (errorText.includes('COUPON_NOT_APPLICABLE')) {
      errorMessageText = 'This coupon is not applicable to your current order. It may have restrictions on products, minimum order amount, or other conditions.';
    } else if (errorText.includes('COUPON_NOT_FOUND') || errorText.includes('404')) {
      errorMessageText = 'Coupon code not found. Please check the code and try again.';
    } else if (errorText.includes('COUPON_EXPIRED') || errorText.includes('expired')) {
      errorMessageText = 'This coupon has expired and is no longer valid.';
    } else if (errorText.includes('COUPON_ALREADY_USED')) {
      errorMessageText = 'This coupon has already been used and cannot be applied again.';
    } else if (errorText.includes('403') || errorText.includes('Forbidden')) {
      errorMessageText = 'This coupon cannot be applied. It may have restrictions or is not valid for your order.';
    } else if (errorText.includes('400') || errorText.includes('invalid')) {
      errorMessageText = 'Invalid coupon code. Please check the code and try again.';
    } else if (errorText.includes('405')) {
      errorMessageText = 'Coupon application method not supported. Please contact support.';
    }
    
    showDiscountMessage(errorMessageText, 'error');
    DOM.discountInput.style.borderColor = '#EF4444'; // Red border on error
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

function formatCardNumber(event) {
  const digits = event.target.value.replace(/\s+/g, '').replace(/[^\d]/g, '');
  event.target.value = digits.replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
}

function formatExpiryDate(event) {
  const digits = event.target.value.replace(/[^\d]/g, '');
  const formatted = digits.length >= 2 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}` : digits;
  event.target.value = formatted.slice(0, 5);
}

function stripNonDigits(event) {
  event.target.value = event.target.value.replace(/[^\d]/g, '');
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
    
    const membership = state.subscriptions.find(p => 
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
      
      items.push({
        id: membership.id,
        name: membership.name || 'Membership',
        amount: price,
        type: 'membership',
        productId: membership.id, // Store API product ID for order creation
      });
      state.totals.membershipMonthly = price;
    } else {
      console.warn('Cart: Membership not found', {
        selectedProductId: state.selectedProductId,
        selectedProductType: state.selectedProductType,
        availableSubscriptions: state.subscriptions.map(s => ({ id: s.id, name: s.name }))
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
          amount: price * quantity,
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
      amount: addon.price.discounted,
      type: 'addon',
    });
  });

  state.cartItems = items;
  
  // Calculate subtotal (before discount)
  state.totals.subtotal = items.reduce((total, item) => total + item.amount, 0);
  
  // Calculate cart total (subtotal - discount)
  state.totals.cartTotal = Math.max(0, state.totals.subtotal - (state.totals.discountAmount || 0));

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
        amount: plan.price,
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
          amount: plan.price * quantity,
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
      amount: addon.price.discounted,
      type: 'addon',
    });
  });

  state.cartItems = items;
  
  // Calculate subtotal (before discount)
  state.totals.subtotal = items.reduce((total, item) => total + item.amount, 0);
  
  // Calculate cart total (subtotal - discount)
  state.totals.cartTotal = Math.max(0, state.totals.subtotal - (state.totals.discountAmount || 0));

  renderCartItems();
  renderCartTotal();
}

function renderCartItems() {
  if (!templates.cartItem || !DOM.cartItems) return;
  DOM.cartItems.innerHTML = '';

  if (!state.cartItems.length) {
    const empty = document.createElement('div');
    empty.className = 'cart-empty';
    empty.textContent = 'Your cart is empty';
    DOM.cartItems.appendChild(empty);
    return;
  }

  state.cartItems.forEach((item) => {
    const cartItem = templates.cartItem.content.firstElementChild.cloneNode(true);
    const nameEl = cartItem.querySelector('[data-element="name"]');
    const priceEl = cartItem.querySelector('[data-element="price"]');

    if (nameEl) nameEl.textContent = item.name;
    if (priceEl) priceEl.textContent = currencyFormatter.format(item.amount);

    DOM.cartItems.appendChild(cartItem);
  });
}

function renderCartTotal() {
  // Update the cart total element
  if (DOM.cartTotal) {
    const formattedTotal = currencyFormatter.format(state.totals.cartTotal);
    DOM.cartTotal.textContent = formattedTotal;
    console.log('[Cart] Updated cart total display:', formattedTotal, '(subtotal:', state.totals.subtotal, 'discount:', state.totals.discountAmount, ')');
  } else {
    console.warn('[Cart] DOM.cartTotal element not found!');
    // Try to find it again
    DOM.cartTotal = document.querySelector('[data-summary-field="cart-total"]');
    if (DOM.cartTotal) {
      DOM.cartTotal.textContent = currencyFormatter.format(state.totals.cartTotal);
      console.log('[Cart] Found and updated cart total element');
    }
  }

  if (DOM.billingPeriod) {
    DOM.billingPeriod.textContent = state.billingPeriod || 'Billing period confirmed after checkout.';
  }
  
  // Update payment overview
  updatePaymentOverview();
  
  // Update discount display if discount is applied
  updateDiscountDisplay();
}

function updatePaymentOverview() {
  // Only show payment overview if there's a membership (subscription) in the cart
  const hasMembership = state.selectedProductType === 'membership' && state.selectedProductId;
  
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
  
  if (!DOM.paymentOverview || !DOM.payNow || !DOM.monthlyPayment) {
    return;
  }
  
  if (!hasMembership) {
    // Hide payment overview if no membership
    DOM.paymentOverview.style.display = 'none';
    return;
  }
  
  // Don't update DOM if fullOrder doesn't exist yet, or if it exists but doesn't have subscriptionItems yet
  // This prevents showing incorrect values before subscription is attached to the order
  // Apply this guard whenever we have a membership selected (payment overview should be shown)
  const hasSubscriptionItems = state.fullOrder?.subscriptionItems && state.fullOrder.subscriptionItems.length > 0;
  if (hasMembership && (!state.fullOrder || !hasSubscriptionItems)) {
    console.log('[Payment Overview] ⏳ Waiting for order data with subscriptionItems before updating payment overview');
    return;
  }
  
  // Show payment overview
  DOM.paymentOverview.style.display = 'block';
  
  console.log('[Payment Overview] ===== UPDATING PAYMENT OVERVIEW =====');
  console.log('[Payment Overview] Order data:', {
    hasFullOrder: !!state.fullOrder,
    hasOrder: !!state.order,
    orderId: state.fullOrder?.id || state.order?.id,
    orderNumber: state.fullOrder?.number || state.order?.number,
    orderPrice: state.fullOrder?.price || state.order?.price,
    hasSubscriptionItems: !!(state.fullOrder?.subscriptionItems || state.order?.subscriptionItems),
    subscriptionItemsCount: (state.fullOrder?.subscriptionItems || state.order?.subscriptionItems)?.length || 0
  });
  
  // Calculate "Betales nu" (Pay now)
  // CRITICAL: Use the EXACT same price that backend sends to payment window
  // Payment link API reads order.price.amount from backend, so we must use the same value
  // This ensures "Betales nu" matches the price shown in payment window
  let payNowAmount = 0;
  
  // Check if backend calculated partial-month pricing correctly
  // If initialPaymentPeriod starts in the future (>1 day), backend may not have calculated partial-month pricing
  // In that case, we need to calculate it client-side to show the correct price
  if (state.fullOrder && state.fullOrder.price && state.fullOrder.price.amount !== undefined) {
    const orderTotalPrice = state.fullOrder.price.amount;
    const orderTotalPriceDKK = typeof orderTotalPrice === 'object' 
      ? orderTotalPrice.amount / 100 
      : orderTotalPrice / 100;
    
    // Check if we need to calculate partial-month pricing client-side
    const subscriptionItem = state.fullOrder.subscriptionItems?.[0];
    const recurringPrice = subscriptionItem?.payRecurring?.price?.amount || 0;
    const initialPaymentPeriod = subscriptionItem?.initialPaymentPeriod;
    
    // If initialPaymentPeriod starts more than 1 day in the future, backend likely didn't calculate partial-month pricing
    let needsClientSideCalculation = false;
    if (initialPaymentPeriod && initialPaymentPeriod.start) {
      const backendStartDate = new Date(initialPaymentPeriod.start);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntilStart = Math.ceil((backendStartDate - today) / (1000 * 60 * 60 * 24));
      
      // If backend start date is more than 1 day in the future AND order price equals recurring price,
      // backend didn't calculate partial-month pricing - we need to calculate it client-side
      if (daysUntilStart > 1 && recurringPrice > 0 && orderTotalPrice === recurringPrice) {
        needsClientSideCalculation = true;
        console.log('[Payment Overview] ⚠️ Backend start date is', daysUntilStart, 'days in future and order price equals recurring price');
        console.log('[Payment Overview] Calculating partial-month pricing client-side...');
        
        // Calculate period from today to end of current month
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
        const daysInCurrentMonth = lastDayOfMonth.getDate();
        const dayOfMonth = today.getDate();
        const daysRemainingInMonth = daysInCurrentMonth - dayOfMonth + 1; // Days from today to end of month
        
        // Calculate prorated price for remaining days in current month
        const proratedPrice = Math.round((recurringPrice * daysRemainingInMonth) / daysInCurrentMonth);
        payNowAmount = proratedPrice / 100;
        
        console.log('[Payment Overview] ✅ Client-side partial-month calculation:', payNowAmount, 'DKK (', daysRemainingInMonth, 'days of', daysInCurrentMonth, 'days)');
      }
    }
    
    // If backend calculated the price correctly (or we don't need client-side calculation), use backend's price
    if (!needsClientSideCalculation) {
      payNowAmount = orderTotalPriceDKK;
      console.log('[Payment Overview] ✅ Pay now from fullOrder.price.amount (matches payment window):', payNowAmount, 'DKK');
      console.log('[Payment Overview] This is the same price backend sends to payment link API');
    }
  } else {
    // Fallback: Use cart total if fullOrder not available yet
    payNowAmount = state.totals.cartTotal || 0;
    console.log('[Payment Overview] ⚠️ Pay now from cartTotal (fallback):', payNowAmount, 'DKK - fullOrder data not available');
    console.log('[Payment Overview] Full state check:', {
      hasFullOrder: !!state.fullOrder,
      fullOrderId: state.fullOrder?.id,
      fullOrderNumber: state.fullOrder?.number,
      hasOrder: !!state.order,
      orderId: state.orderId,
      cartTotal: state.totals.cartTotal
    });
  }
  
  // Calculate "Månedlig betaling herefter" (Monthly payment thereafter)
  // This is the recurring monthly price AFTER any promotional period
  let monthlyPaymentAmount = 0;
  
  // Try to get from fullOrder subscriptionItems first (fullOrder has the API structure)
  if (state.fullOrder && state.fullOrder.subscriptionItems && state.fullOrder.subscriptionItems.length > 0) {
    const subscriptionItem = state.fullOrder.subscriptionItems[0];
    
    console.log('[Payment Overview] DEBUG - SubscriptionItem:', {
      hasPayRecurring: !!subscriptionItem.payRecurring,
      payRecurringPrice: subscriptionItem.payRecurring?.price,
      initialPaymentPeriod: subscriptionItem.initialPaymentPeriod
    });
    
    // payRecurring.price.amount is ALWAYS the regular monthly price after any promotional period
    // Even if there's an initialPaymentPeriod, payRecurring shows the price after promotion ends
    if (subscriptionItem.payRecurring && subscriptionItem.payRecurring.price) {
      monthlyPaymentAmount = subscriptionItem.payRecurring.price.amount / 100;
      console.log('[Payment Overview] ✅ Monthly payment from payRecurring:', monthlyPaymentAmount, 'DKK (payRecurring.price.amount:', subscriptionItem.payRecurring.price.amount, ')');
    } else {
      console.warn('[Payment Overview] ⚠️ SubscriptionItem found but no payRecurring.price:', subscriptionItem);
    }
  } else {
    // No order data yet - use membership monthly price from state
    monthlyPaymentAmount = state.totals.membershipMonthly || 0;
    console.log('[Payment Overview] ⚠️ Monthly payment from state.totals.membershipMonthly (fallback):', monthlyPaymentAmount, 'DKK - fullOrder data not available');
    console.log('[Payment Overview] Full state check:', {
      hasFullOrder: !!state.fullOrder,
      fullOrderSubscriptionItems: state.fullOrder?.subscriptionItems?.length || 0,
      hasOrder: !!state.order,
      membershipMonthly: state.totals.membershipMonthly
    });
    
    // If we have product data, try to get the regular price
    if (monthlyPaymentAmount === 0 && state.selectedProductId && state.subscriptions) {
      const productIdNum = typeof state.selectedProductId === 'string' 
        ? parseInt(state.selectedProductId) 
        : state.selectedProductId;
      
      const membership = state.subscriptions.find(p => 
        p.id === state.selectedProductId || 
        p.id === productIdNum ||
        String(p.id) === String(state.selectedProductId)
      );
      
      if (membership && membership.priceWithInterval && membership.priceWithInterval.price) {
        monthlyPaymentAmount = membership.priceWithInterval.price.amount / 100;
        console.log('[Payment Overview] Monthly payment from product data:', monthlyPaymentAmount, 'DKK');
      }
    }
  }
  
  // Update display
  if (DOM.payNow) {
    DOM.payNow.textContent = currencyFormatter.format(payNowAmount);
    
    // CRITICAL: Log to verify this matches payment window price
    const orderPriceForPayment = state.fullOrder?.price?.amount || 0;
    const orderPriceDKK = orderPriceForPayment / 100;
    const pricesMatch = Math.abs(payNowAmount - orderPriceDKK) < 0.01; // Allow small rounding differences
    
    console.log('[Payment Overview] 🔍 "Betales nu" price:', payNowAmount, 'DKK');
    console.log('[Payment Overview] 🔍 Order price (sent to payment window):', orderPriceDKK, 'DKK');
    console.log('[Payment Overview] 🔍 Prices match:', pricesMatch ? '✅ YES' : '❌ NO - MISMATCH!');
    
    // WARNING: If prices don't match, this is a backend issue
    // Backend ignores startDate parameter for "Medlemskab" (productId 134) and sets start date to future,
    // which prevents partial-month pricing calculation. This causes payment window to show full monthly price
    // instead of partial-month price. This is a known backend limitation that needs to be fixed on backend side.
    if (!pricesMatch) {
      const subscriptionItem = state.fullOrder?.subscriptionItems?.[0];
      const productId = subscriptionItem?.product?.id || state.selectedProductId;
      console.warn('[Payment Overview] ⚠️ PRICE MISMATCH DETECTED!');
      console.warn('[Payment Overview] ⚠️ UI shows:', payNowAmount, 'DKK (client-side calculated partial-month price)');
      console.warn('[Payment Overview] ⚠️ Payment window will show:', orderPriceDKK, 'DKK (backend full monthly price)');
      console.warn('[Payment Overview] ⚠️ Product ID:', productId);
      console.warn('[Payment Overview] ⚠️ This is a backend issue - backend ignores startDate parameter for this product');
      console.warn('[Payment Overview] ⚠️ Backend sets initialPaymentPeriod.start to future date, preventing partial-month pricing');
    }
  }
  
  if (DOM.monthlyPayment) {
    if (monthlyPaymentAmount > 0) {
      DOM.monthlyPayment.textContent = `${currencyFormatter.format(monthlyPaymentAmount)}/md`;
    } else {
      DOM.monthlyPayment.textContent = '—';
    }
  }
  
  // Update billing period display
  if (DOM.paymentBillingPeriod) {
    let billingPeriodText = '';
    
    // Try to get billing period from fullOrder subscriptionItems
    const orderToUseForBilling = state.fullOrder || state.order;
    if (orderToUseForBilling && orderToUseForBilling.subscriptionItems && orderToUseForBilling.subscriptionItems.length > 0) {
      const subscriptionItem = orderToUseForBilling.subscriptionItems[0];
      
      // Check for initialPaymentPeriod (promotional period)
      if (subscriptionItem.initialPaymentPeriod) {
        const backendStartDate = new Date(subscriptionItem.initialPaymentPeriod.start);
        const backendEndDate = new Date(subscriptionItem.initialPaymentPeriod.end);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Today at midnight
        
        // Format dates in Danish format (DD.MM.YYYY)
        const formatDate = (date) => {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${day}.${month}.${year}`;
        };
        
        // If backend start date is in the future (more than 1 day), show period as if it starts today
        const daysUntilBackendStart = Math.ceil((backendStartDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilBackendStart > 1) {
          // Backend set start to future - show period from today to end of current month
          const currentMonth = today.getMonth();
          const currentYear = today.getFullYear();
          const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
          
          billingPeriodText = `For perioden ${formatDate(today)} - ${formatDate(lastDayOfMonth)}`;
        } else {
          // Backend start date is today or very soon - use backend's period
          // Validate dates - if start date is more than 2 months in the future, it might be incorrect
          const monthsDiff = (backendStartDate.getFullYear() - now.getFullYear()) * 12 + (backendStartDate.getMonth() - now.getMonth());
          const isValidPeriod = monthsDiff >= 0 && monthsDiff <= 2 && backendStartDate < backendEndDate;
          
          if (isValidPeriod) {
            billingPeriodText = `For perioden ${formatDate(backendStartDate)} - ${formatDate(backendEndDate)}`;
            
            // If there's a boundUntil date (end of promotional period), show that too
            if (subscriptionItem.boundUntil) {
              const boundUntilDate = new Date(subscriptionItem.boundUntil);
              billingPeriodText += ` (bundet til ${formatDate(boundUntilDate)})`;
            }
          } else {
            // Date period seems invalid (too far in future or invalid range)
            console.warn('[Payment Overview] Invalid initialPaymentPeriod detected:', {
              start: subscriptionItem.initialPaymentPeriod.start,
              end: subscriptionItem.initialPaymentPeriod.end,
              monthsDiff,
              now: now.toISOString()
            });
            
            // Don't show invalid dates - fall back to default message
            billingPeriodText = '';
          }
        }
      } else if (subscriptionItem.boundUntil) {
        // No initialPaymentPeriod, but there's a boundUntil date
        const boundUntilDate = new Date(subscriptionItem.boundUntil);
        const formatDate = (date) => {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${day}.${month}.${year}`;
        };
        billingPeriodText = `Bundet til ${formatDate(boundUntilDate)}`;
      }
    }
    
    // Fallback to state.billingPeriod if available
    if (!billingPeriodText && state.billingPeriod) {
      billingPeriodText = state.billingPeriod;
    }
    
    // If still no billing period, show default message
    if (!billingPeriodText) {
      billingPeriodText = 'Faktureringsperiode bekræftes efter checkout.';
    }
    
    DOM.paymentBillingPeriod.textContent = billingPeriodText;
    DOM.paymentBillingPeriod.style.display = 'block';
  }
  
  console.log('[Payment Overview] Updated:', {
    payNow: payNowAmount,
    monthlyPayment: monthlyPaymentAmount,
    hasOrder: !!state.order,
    billingPeriod: DOM.paymentBillingPeriod?.textContent || 'N/A'
  });
}

function updateDiscountDisplay() {
  // Find or create discount display element
  let discountDisplay = document.querySelector('.discount-display');
  
  // Show discount display if discount is applied OR if discount code is stored (pending application)
  if ((state.discountApplied && state.totals.discountAmount > 0) || (state.discountCode && !state.discountApplied)) {
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
      state.totals.subtotal = items.reduce((total, item) => total + item.amount, 0);
    }
    
    if (!discountDisplay) {
      // Create discount display element
      discountDisplay = document.createElement('div');
      discountDisplay.className = 'discount-display';
      
      // Insert before cart total
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
    
    // Build discount display HTML - show subtotal, discount, and final total
    if (state.discountApplied && state.totals.discountAmount > 0) {
      // Discount is applied - show actual discount amount
      discountDisplay.innerHTML = `
        <div class="discount-row">
          <span class="discount-label">Subtotal:</span>
          <span class="discount-value">${currencyFormatter.format(state.totals.subtotal)}</span>
        </div>
        <div class="discount-row discount-applied">
          <span class="discount-label">Discount (${state.discountCode}):</span>
          <span class="discount-value">-${currencyFormatter.format(state.totals.discountAmount)}</span>
        </div>
        <div class="discount-row discount-total" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
          <span class="discount-label" style="font-weight: bold;">Total:</span>
          <span class="discount-value" style="font-weight: bold;">${currencyFormatter.format(state.totals.cartTotal)}</span>
        </div>
      `;
    } else if (state.discountCode && !state.discountApplied) {
      // Discount code entered but not yet applied (pending) - show subtotal only
      discountDisplay.innerHTML = `
        <div class="discount-row">
          <span class="discount-label">Subtotal:</span>
          <span class="discount-value">${currencyFormatter.format(state.totals.subtotal)}</span>
        </div>
        <div class="discount-row discount-pending" style="opacity: 0.7; font-style: italic;">
          <span class="discount-label">Discount code (${state.discountCode}):</span>
          <span class="discount-value">Will be applied at checkout</span>
        </div>
        <div class="discount-row discount-total" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
          <span class="discount-label" style="font-weight: bold;">Total:</span>
          <span class="discount-value" style="font-weight: bold;">${currencyFormatter.format(state.totals.cartTotal)}</span>
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

function getRetryDelayFromError(error, defaultMs = 900000) {
  const message = typeof error?.message === 'string' ? error.message : '';
  const match = message.match(/"retryAfter":\s*(\d+)/i);
  if (match) {
    const seconds = parseInt(match[1], 10);
    if (!isNaN(seconds)) {
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
  if (!validateForm()) {
    showToast('Please review the highlighted fields.', 'error');
    return;
  }

  // Allow checkout if either membership OR punch cards are selected
  const hasMembership = !!state.membershipPlanId;
  const hasPunchCards = state.valueCardQuantities && 
    Array.from(state.valueCardQuantities.values()).some(qty => qty > 0);
  const hasAddons = state.addonIds && state.addonIds.size > 0;

  if (!hasMembership && !hasPunchCards && !hasAddons) {
    showToast('Select a membership, punch card, or add-on to continue.', 'error');
    return;
  }
  
  // Mark checkout as in progress to prevent state resets
  state.checkoutInProgress = true;

  if (!state.paymentMethod) {
    showToast('Choose a payment method to continue.', 'error');
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
        const customerData = {
          email: payload.customer?.email,
          firstName: payload.customer?.firstName,
          lastName: payload.customer?.lastName,
          phone: payload.customer?.phone?.number || payload.customer?.phone,
          phoneCountryCode: payload.customer?.phone?.countryCode,
          dateOfBirth: payload.customer?.dateOfBirth,
          address: payload.customer?.address?.street || payload.customer?.address,
          city: payload.customer?.address?.city || payload.customer?.city,
          postalCode: payload.customer?.address?.postalCode || payload.customer?.postalCode,
          country: payload.customer?.country,
          primaryGym: payload.customer?.primaryGym,
          password: payload.customer?.password,
          customerType: 1, // Required by API - numeric ID (typically 1 = Individual customer type)
          // Include marketing email consent - API field: allowMassSendEmail
          ...(payload.consent?.marketing !== undefined && { allowMassSendEmail: payload.consent.marketing }),
        };
        
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
        customer = await authAPI.createCustomer(customerData);
        // Extract customer ID from response - API returns {success: true, data: {id: ...}}
        customerId = customer?.data?.id || customer?.id || customer?.customerId || customer?.data?.customerId;
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
        showToast(getErrorMessage(error, 'Customer creation'), 'error');
        setCheckoutLoadingState(false);
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
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/50e61037-73d2-4f3b-acc0-ea461f14b6ed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:6200',message:'Checkout started - tracking product',data:{selectedProductType:state.selectedProductType,selectedProductId:state.selectedProductId,membershipPlanId:state.membershipPlanId,hasValueCards:state.valueCardQuantities?.size>0,valueCardCount:state.valueCardQuantities?.size||0,hasAddons:state.addonIds?.size>0,addonCount:state.addonIds?.size||0,orderId:state.orderId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
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
                state.totals.discountAmount = discountAmount;
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
          
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const baseUrl = isLocal
            ? 'https://join.boulders.dk'
            : window.location.origin.replace('http://', 'https://');
          const returnUrl = `${baseUrl}${window.location.pathname}?payment=return&orderId=${state.orderId}`;
          console.log('[checkout] Return URL:', returnUrl);
          
          // API Documentation: POST /api/payment/generate-link
          // Payload: { orderId, paymentMethodId, businessUnit, returnUrl }
          if (!state.orderId) {
            throw new Error('Order ID is required to generate payment link');
          }
          
          // CRITICAL: Final order fetch to ensure backend has processed coupon before payment link generation
          // The payment link API reads the order total from the backend, so we need to ensure it's updated
          try {
            console.log('[checkout] Final order fetch before payment link generation...');
            // Wait a bit more to ensure backend has fully processed the coupon
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const orderBeforePayment = await orderAPI.getOrder(state.orderId);
            console.log('[checkout] Final order response:', JSON.stringify(orderBeforePayment, null, 2));
            
            // Store full order object for payment overview
            state.fullOrder = orderBeforePayment;
            
            // CRITICAL: Log the exact price that will be sent to payment window
            // Note: For "Medlemskab" (productId 134), backend may not calculate partial-month pricing correctly
            // if initialPaymentPeriod starts in the future. In that case, payment window will show the full
            // monthly price (469 DKK) instead of the partial-month price (408.48 DKK).
            // The UI shows the correct client-side calculated price, but payment window uses backend's price.
            const finalOrderPrice = orderBeforePayment?.price?.amount || 0;
            
            // Check if backend calculated partial-month pricing correctly (for logging only)
            const subscriptionItem = orderBeforePayment?.subscriptionItems?.[0];
            const recurringPrice = subscriptionItem?.payRecurring?.price?.amount || 0;
            const initialPaymentPeriod = subscriptionItem?.initialPaymentPeriod;
            let needsPriceFix = false;
            if (subscriptionItem && initialPaymentPeriod && initialPaymentPeriod.start && recurringPrice > 0) {
              const backendStartDate = new Date(initialPaymentPeriod.start);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const daysUntilStart = Math.ceil((backendStartDate - today) / (1000 * 60 * 60 * 24));
              
              // If backend start date is more than 1 day in the future AND order price equals recurring price,
              // backend didn't calculate partial-month pricing
              if (daysUntilStart > 1 && finalOrderPrice === recurringPrice) {
                needsPriceFix = true;
                console.warn('[checkout] ⚠️ Backend did not calculate partial-month pricing!');
                console.warn('[checkout] Order price:', finalOrderPrice, 'equals recurring price:', recurringPrice);
                console.warn('[checkout] Backend start date:', initialPaymentPeriod.start, '(', daysUntilStart, 'days in future)');
                console.warn('[checkout] Payment window will show full monthly price instead of partial-month price');
                console.warn('[checkout] UI shows client-side calculated price, but payment uses backend price');
              }
            }
            console.log('[checkout] 🔍 PRICE THAT WILL BE SENT TO PAYMENT WINDOW:', finalOrderPrice, '(in cents) =', finalOrderPrice / 100, 'DKK');
            console.log('[checkout] This is order.price.amount from backend - payment link API will use this exact value');
            
            // Update payment overview with order data
            updatePaymentOverview();
            
            // Verify coupon discount is present
            const orderCouponDiscount = orderBeforePayment?.couponDiscount || orderBeforePayment?.price?.couponDiscount;
            if (orderCouponDiscount) {
              console.log('[checkout] ✅ Order has couponDiscount, payment link should reflect discount');
            } else {
              console.warn('[checkout] ⚠️ Order does not have couponDiscount - payment link may not reflect discount');
            }
            
            // Log all available price-related fields for debugging
            console.log('[checkout] Order price fields:', {
              hasPrice: !!orderBeforePayment?.price,
              priceKeys: orderBeforePayment?.price ? Object.keys(orderBeforePayment.price) : [],
              couponDiscount: orderCouponDiscount,
              discountAmount: orderBeforePayment?.discountAmount,
              totalCost: orderBeforePayment?.totalCost,
              priceAmount: orderBeforePayment?.price?.amount,
            });
          } catch (orderCheckError) {
            console.warn('[checkout] Could not verify order state before payment link:', orderCheckError);
            // Continue anyway - coupon was applied earlier
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
          throw new Error('Failed to add membership to order or generate payment link');
        }
      }
      
      // Add value cards (punch cards) - add FIRST if no membership, or AFTER payment link if membership exists
      let valueCardAddFailed = false;
      let valueCardError = null;
      
      if (state.valueCardQuantities && state.valueCardQuantities.size > 0) {
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
                console.log(`[checkout] ✅ Value card added: ${planId} (productId: ${numericProductId}) [${i + 1}/${quantity}]`);
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
              
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/50e61037-73d2-4f3b-acc0-ea461f14b6ed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:6688',message:'Value card add error in checkout',data:{planId,numericProductId,quantity,orderId:state.orderId,errorMessage:error.message,is403:error.message.includes('403'),is401:error.message.includes('401'),isMembership,willContinue:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
              // #endregion
              
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
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const baseUrl = isLocal
            ? 'https://join.boulders.dk'
            : window.location.origin.replace('http://', 'https://');
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
              state.totals.discountAmount = discountAmount;
              
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
              showDiscountMessage(`Coupon "${discountCodeToApply}" applied! Discount: ${currencyFormatter.format(discountAmount)}`, 'success');
              
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
      showToast(getErrorMessage(error, 'Adding items'), 'error');
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
  if (membershipPlanId && state.subscriptions && state.subscriptions.length > 0) {
    // Extract numeric ID from 'membership-134' format
    const numericId = membershipPlanId.replace('membership-', '');
    const productId = parseInt(numericId, 10);
    
    // Find membership in API subscriptions
    membership = state.subscriptions.find(sub => 
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
  
  return {
    number: orderId,
    date: order?.createdAt ? new Date(order.createdAt) : (order?.created ? new Date(order.created) : now),
    items: [...state.cartItems],
    total: order?.total || order?.totalAmount || state.totals.cartTotal,
    memberName: memberName || '—',
    membershipNumber: membershipId,
    membershipType: membership?.name ?? '—',
    primaryGym: resolveGymLabel(primaryGymValue),
    membershipPrice: state.totals.membershipMonthly,
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
      if (state.selectedBusinessUnit && (state.subscriptions.length === 0 || state.valueCards.length === 0)) {
        console.log('[Payment Return] Loading products from API for membership lookup...');
        await loadProductsFromAPI();
      }
    } catch (e) {
      console.warn('[Payment Return] Could not restore data from sessionStorage:', e);
    }
    
    // Fetch order from API
    const order = await orderAPI.getOrder(orderId);
    console.log('[Payment Return] Order fetched:', order);
    
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
    
    // Check if payment is actually confirmed before showing success page
    const isPaymentConfirmed = order.leftToPay?.amount === 0 || order.leftToPay === 0;
    const isOrderPaid = order.orderStatus?.name === 'Betalet' || order.orderStatus?.id === 2; // Assuming 2 is "Paid" status
    
    if (!isPaymentConfirmed && !isOrderPaid) {
      console.warn('[Payment Return] ⚠️ Payment not confirmed - showing pending message instead of success page');
      console.warn('[Payment Return] leftToPay:', order.leftToPay?.amount || order.leftToPay);
      console.warn('[Payment Return] orderStatus:', order.orderStatus?.name);
      
      // Show payment pending message instead of success page
      showPaymentPendingMessage(order, orderId);
      return; // Don't show success page yet
    }
    
    // Store full order object for payment overview (before building summary)
    state.fullOrder = order;
    
    // Build order summary with fetched data (for confirmation view)
    state.order = buildOrderSummary(payload, { ...order, total: orderTotal, totalAmount: orderTotal }, customer || storedCustomer);
    console.log('[Payment Return] Order summary built:', state.order);
    
    // Update payment overview with order data
    updatePaymentOverview();
    
    // Only render confirmation view if payment is confirmed
    renderConfirmationView();
  } catch (error) {
    console.error('[Payment Return] Failed to load order data:', error);
    // Still try to render with whatever data we have
    if (!state.order) {
      // Build a minimal order summary with just the order ID
      const payload = buildCheckoutPayload();
      state.order = buildOrderSummary(payload, { id: orderId }, null);
    }
    // Try to fetch full order data even if payment is not confirmed
    if (orderId && !state.fullOrder) {
      try {
        const fullOrder = await orderAPI.getOrder(orderId);
        state.fullOrder = fullOrder;
        updatePaymentOverview();
      } catch (error) {
        console.warn('[Payment Return] Could not fetch full order data:', error);
      }
    }
    renderConfirmationView();
  }
}

function showPaymentPendingMessage(order, orderId) {
  // Update the confirmation page to show payment pending instead of success
  const successTitle = document.querySelector('.success-title');
  const successMessage = document.querySelector('.success-message');
  const successBadge = document.querySelector('.success-badge');
  
  if (successTitle) {
    successTitle.textContent = 'Payment Pending';
    successTitle.style.color = '#f59e0b'; // Orange/amber color
  }
  
  if (successMessage) {
    successMessage.textContent = `Your payment is being processed. We're waiting for confirmation from the payment provider. Your membership will be activated once payment is confirmed. Order #${orderId || order?.number || order?.id || 'N/A'}`;
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
  
  // Show a message that the page will auto-refresh
  console.log('[Payment Pending] Showing payment pending message. Page will check payment status automatically.');
  
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
          successMessage.textContent = `Payment is still being processed. Please check back in a few minutes or contact support if you've completed payment. Order #${orderId || order?.number || order?.id || 'N/A'}`;
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

function renderConfirmationView() {
  if (!state.order) {
    console.warn('[Confirmation] No order data available to render');
    return;
  }

  const { orderNumber, orderDate, orderTotal, memberName, membershipNumber, membershipType, primaryGym, membershipPrice } = DOM.confirmationFields;

  if (orderNumber) orderNumber.textContent = state.order.number;
  if (orderDate) {
    orderDate.textContent = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(state.order.date);
  }
  if (orderTotal) orderTotal.textContent = currencyFormatter.format(state.order.total);
  if (memberName) memberName.textContent = state.order.memberName || '—';
  if (membershipNumber) membershipNumber.textContent = state.order.membershipNumber;
  if (membershipType) membershipType.textContent = state.order.membershipType;
  if (primaryGym) primaryGym.textContent = state.order.primaryGym;
  if (membershipPrice) {
    membershipPrice.textContent = `${currencyFormatter.format(state.order.membershipPrice)}/month`;
  }

  if (templates.confirmationItem && DOM.confirmationItems) {
    DOM.confirmationItems.innerHTML = '';
    state.order.items.forEach((item) => {
      const node = templates.confirmationItem.content.firstElementChild.cloneNode(true);
      const nameEl = node.querySelector('[data-element="name"]');
      const priceEl = node.querySelector('[data-element="price"]');
      if (nameEl) nameEl.textContent = item.name;
      if (priceEl) priceEl.textContent = currencyFormatter.format(item.amount);
      DOM.confirmationItems.appendChild(node);
    });
  }
}

function handleReferralCopy() {
  const referralLink = 'https://boulders.dk/refer?code=TBD-CODE';
  const clipboard = navigator.clipboard;

  if (clipboard && typeof clipboard.writeText === 'function') {
    clipboard
      .writeText(referralLink)
      .then(() => showToast('Referral link copied to clipboard!', 'success'))
      .catch(() => showToast('Unable to copy link. Please try again.', 'error'));
  } else {
    showToast('Clipboard not supported in this browser. Copy the URL manually.', 'error');
  }
}

function validateForm() {
  let isValid = true;
  clearErrorStates();
  const skipPersonalValidation = isUserAuthenticated();

  if (!skipPersonalValidation) {
    REQUIRED_FIELDS.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && !field.value.trim()) {
        isValid = false;
        highlightFieldError(fieldId);
      }
    });
  }

  if (!skipPersonalValidation && DOM.parentGuardianForm && DOM.parentGuardianForm.style.display !== 'none') {
    PARENT_REQUIRED_FIELDS.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && !field.value.trim()) {
        isValid = false;
        highlightFieldError(fieldId);
      }
    });
  }

  if (!DOM.termsConsent?.checked) {
    isValid = false;
    showToast('Please accept the terms and conditions.', 'error');
  }

  if (!state.paymentMethod) {
    isValid = false;
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
    formGroup?.classList.remove('error');
  });
}

function highlightFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  const formGroup = field?.closest('.form-group');
  formGroup?.classList.add('error');
}

function isValidCardNumber(value) {
  const digits = value.replace(/\s+/g, '');
  return /^\d{13,19}$/.test(digits);
}

function isValidExpiryDate(value) {
  return /^(0[1-9]|1[0-2])\/\d{2}$/.test(value);
}

function updateCheckoutButton() {
  if (!DOM.checkoutBtn) return;
  const termsAccepted = DOM.termsConsent?.checked ?? false;
  const hasMembership = Boolean(state.membershipPlanId);
  const hasPayment = Boolean(state.paymentMethod);

  DOM.checkoutBtn.disabled = !(termsAccepted && hasMembership && hasPayment);
}

// Helper function to get user-friendly error messages
function getErrorMessage(error, context = 'operation') {
  // Network errors
  if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Try to parse validation errors from API response (400/403 errors with details)
  if (error.message.includes('400') || error.message.includes('403')) {
    try {
      // Extract JSON from error message
      const jsonMatch = error.message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const errorData = JSON.parse(jsonMatch[0]);
        
        // Handle validation errors with details array
        if (errorData.error?.details && Array.isArray(errorData.error.details)) {
          const validationErrors = errorData.error.details
            .map(detail => detail.message || `${detail.field}: ${detail.message}`)
            .join(', ');
          return `Please fix the following: ${validationErrors}`;
        }
        
        // Handle field errors (like customerType)
        if (errorData.error?.details?.fieldErrors && Array.isArray(errorData.error.details.fieldErrors)) {
          const fieldErrors = errorData.error.details.fieldErrors
            .map(fieldError => `${fieldError.field}: ${fieldError.errorCode || 'required'}`)
            .join(', ');
          return `Missing required fields: ${fieldErrors}`;
        }
      }
    } catch (e) {
      // If parsing fails, fall through to default error message
    }
  }

  // Parse status code from error message
  const statusMatch = error.message.match(/(\d{3})/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1]);
    
    switch (status) {
      case 400:
        return 'Invalid information provided. Please check your details and try again.';
      case 401:
        return 'Your session has expired. Please try again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return `${context} not found. Please try again.`;
      case 409:
        return 'This order already exists. Please check your orders or contact support.';
      case 422:
        return 'Invalid data provided. Please review your information.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
        return 'Server error. Please try again in a few moments.';
      default:
        return `An error occurred (${status}). Please try again or contact support.`;
    }
  }

  // Default message
  return error.message || 'An unexpected error occurred. Please try again.';
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

function nextStep() {
  if (state.currentStep >= TOTAL_STEPS) {
    return;
  }
  // advance to next visible panel (skip any hidden ones)
  let target = state.currentStep + 1;
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
  if (state.currentStep === 2 && target === 4) {
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
    }
  }
  state.currentStep = Math.min(target, TOTAL_STEPS);
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();

  // Step 5: Load products when step 2 (access type selection) is shown
  if (state.currentStep === 2 && state.selectedBusinessUnit) {
    // Only load if we don't already have products loaded
    if (state.subscriptions.length === 0 && state.valueCards.length === 0) {
      loadProductsFromAPI();
    }
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

  if (state.currentStep === TOTAL_STEPS) {
    renderConfirmationView();
  }
}

function prevStep() {
  if (state.currentStep <= 1) return;
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

  // Scroll to top immediately and with delay
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
  
  // If showing step 4 and user is logged in, ensure login tab is selected
  if (stepNumber === 4 && isUserAuthenticated()) {
    switchAuthMode('login');
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
    connector.classList.toggle('completed', index < visibleCurrentIndex);
  });
}

function updateNavigationButtons() {
  if (DOM.prevBtn) {
    DOM.prevBtn.disabled = state.currentStep === 1;
  }
  if (DOM.nextBtn) {
    DOM.nextBtn.disabled = state.currentStep === TOTAL_STEPS;
    DOM.nextBtn.textContent = state.currentStep === TOTAL_STEPS ? 'Complete' : 'Next';
  }
  
  // Update forward arrow visibility
  const forwardArrowBtn = document.getElementById('forwardArrowBtn');
  if (forwardArrowBtn) {
    // Hide forward arrow on last step
    if (state.currentStep === TOTAL_STEPS) {
      forwardArrowBtn.style.display = 'none';
    } else {
      forwardArrowBtn.style.display = 'flex';
    }
  }
}
function updateMainSubtitle() {
  if (!DOM.mainSubtitle || !DOM.mainTitle) return;

  const subtitles = {
    1: 'Choose your home gym',
    2: 'Choose your access type',
    3: 'Need an add-on?',
    4: 'Log in to your existing account or create a new one',
    5: 'Welcome to Boulders!',
  };

  DOM.mainSubtitle.textContent = subtitles[state.currentStep] ?? 'Choose your membership type';
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
  return MEMBERSHIP_PLANS.find((plan) => plan.id === id) ?? null;
}

function findValueCard(id) {
  return VALUE_CARDS.find((plan) => plan.id === id) ?? null;
}

function findAddon(id) {
  return ADDONS.find((addon) => addon.id === id) ?? null;
}

function showToast(message, type = 'info') {
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach((toast) => toast.remove());

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}
