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
    const isNetlify = window.location.hostname.includes('netlify.app') || window.location.hostname.includes('boulders.dk');
    const isCloudflare = window.location.hostname.includes('workers.dev') || window.location.hostname.includes('pages.dev');
    
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
  async getSubscriptions(businessUnitId) {
    try {
      // Build URL with business unit as query parameter
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
    } else if (window.location.hostname.includes('netlify') || window.location.hostname.includes('boulders.dk')) {
      // Production: use Netlify Function proxy
      this.baseUrl = '/.netlify/functions/api-proxy';
      this.useProxy = true;
    } else if (window.location.hostname.includes('workers.dev') || window.location.hostname.includes('pages.dev')) {
      // Production: use Cloudflare Pages Function proxy
      this.baseUrl = '/api-proxy';
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
    } else if (window.location.hostname.includes('netlify') || window.location.hostname.includes('boulders.dk')) {
      // Production: use Netlify Function proxy
      this.baseUrl = '/.netlify/functions/api-proxy';
      this.useProxy = true;
    } else if (window.location.hostname.includes('workers.dev') || window.location.hostname.includes('pages.dev')) {
      // Production: use Cloudflare Pages Function proxy
      this.baseUrl = '/api-proxy';
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
  async resetPassword(email, appId = 'boulders-web') {
    try {
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/auth/reset-password`;
      } else {
        url = `${this.baseUrl}/api/auth/reset-password`;
      }
      
      console.log('[Step 6] Requesting password reset:', url);
      
      const headers = {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
      };
      
      // API requires appId field - using default 'boulders-web' if not provided
      const payload = {
        email,
        appId: appId || 'boulders-web'
      };
      
      console.log('[Step 6] Password reset payload:', payload);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Step 6] Password reset error (${response.status}):`, errorText);
        throw new Error(`Password reset failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Step 6] Password reset response:', data);
      return data;
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
    } else if (window.location.hostname.includes('netlify') || window.location.hostname.includes('boulders.dk')) {
      // Production: use Netlify Function proxy
      this.baseUrl = '/.netlify/functions/api-proxy';
      this.useProxy = true;
    } else if (window.location.hostname.includes('workers.dev') || window.location.hostname.includes('pages.dev')) {
      // Production: use Cloudflare Pages Function proxy
      this.baseUrl = '/api-proxy';
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

  // Step 7: Add subscription item (membership) - POST /api/orders/{orderId}/items/subscriptions
  async addSubscriptionItem(orderId, productId) {
    try {
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/orders/${orderId}/items/subscriptions`;
      } else {
        url = `${this.baseUrl}/api/orders/${orderId}/items/subscriptions`;
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
      
      const payload = {
        subscriptionProduct: subscriptionProductId,
        businessUnit: state.selectedBusinessUnit, // Always include active business unit
        ...(subscriberId ? { subscriber: subscriberId } : {}),
        ...(birthDate ? { birthDate } : {}),
      };
      
      console.log('[Step 7] Adding subscription item - productId:', productId);
      console.log('[Step 7] Extracted subscriptionProductId:', subscriptionProductId);
      console.log('[Step 7] Subscription item payload:', JSON.stringify(payload, null, 2));
      
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
      return data;
    } catch (error) {
      console.error('[Step 7] Add subscription item error:', error);
      throw error;
    }
  }

  // Step 7: Add value card item (punch card) - POST /api/orders/{orderId}/items/valuecards
  async addValueCardItem(orderId, productId, quantity = 1) {
    try {
      let url;
      if (this.useProxy) {
        url = `${this.baseUrl}?path=/api/orders/${orderId}/items/valuecards`;
      } else {
        url = `${this.baseUrl}/api/orders/${orderId}/items/valuecards`;
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
      
      const payload = {
        productId,
        quantity,
        businessUnit: state.selectedBusinessUnit, // Always include active business unit
      };
      
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
    } else if (window.location.hostname.includes('netlify') || window.location.hostname.includes('boulders.dk')) {
      // Production: use Netlify Function proxy
      this.baseUrl = '/.netlify/functions/api-proxy';
      this.useProxy = true;
    } else if (window.location.hostname.includes('workers.dev') || window.location.hostname.includes('pages.dev')) {
      // Production: use Cloudflare Pages Function proxy
      this.baseUrl = '/api-proxy';
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
async function loadProductsFromAPI() {
  if (!state.selectedBusinessUnit) {
    console.warn('Cannot load products: No business unit selected');
    return;
  }

  try {
    // Fetch subscriptions and value cards in parallel
    const [subscriptionsResponse, valueCardsResponse] = await Promise.all([
      businessUnitsAPI.getSubscriptions(state.selectedBusinessUnit),
      businessUnitsAPI.getValueCards(),
    ]);

    // Handle different response formats - could be array or object with data property
    const subscriptions = Array.isArray(subscriptionsResponse) 
      ? subscriptionsResponse 
      : (subscriptionsResponse.data || subscriptionsResponse.items || []);
    
    const valueCards = Array.isArray(valueCardsResponse)
      ? valueCardsResponse
      : (valueCardsResponse.data || valueCardsResponse.items || []);

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

// Load gyms from API and update UI
async function loadGymsFromAPI() {
  try {
    const response = await businessUnitsAPI.getBusinessUnits();
    
    // Handle different response formats - could be array or object with data property
    const gyms = Array.isArray(response) ? response : (response.data || response.items || []);
    
    console.log('Loaded gyms from API:', gyms);
    console.log(`Found ${gyms.length} business units`);
    
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
    
    // Create gym items from API data
    for (let i = 0; i < gyms.length; i++) {
      const gym = gyms[i];
      if (gym.name && gym.address) {
        // Create and display gym item
        const gymItem = createGymItem(gym);
        if (gymList) {
          gymList.appendChild(gymItem);
        }
      }
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
      noResults.textContent = `Failed to load locations: ${error.message}. Check console for details.`;
    }
  }
}

// Create gym item element from API data
function createGymItem(gym) {
  const gymItem = document.createElement('div');
  gymItem.className = 'gym-item';
  gymItem.setAttribute('data-gym-id', `gym-${gym.id}`);
  
  
  const address = gym.address;
  const addressString = `${address.street}, ${address.postalCode} ${address.city}`;
  
  gymItem.innerHTML = `
    <div class="gym-info">
      <div class="gym-name">${gym.name}</div>
      <div class="gym-details">
        <div class="gym-address">${addressString}</div>
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
  },
  cartItems: [],
  billingPeriod: '',
  forms: {},
  order: null,
  orderId: null, // Step 7: Created order ID
  customerId: null, // Step 6: Created customer ID (for membership ID display)
  authenticatedEmail: null,
  checkoutInProgress: false, // Flag to prevent duplicate checkout attempts
  loginInProgress: false, // Prevent duplicate login submissions
  paymentMethod: null,
  // Step 9: Payment link state
  paymentLink: null, // Generated payment link for checkout
  paymentLinkGenerated: false, // Flag indicating if payment link has been generated
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
  autoEnsureOrderIfReady('auth-state-sync');
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
  
  updateMainSubtitle();
}

document.addEventListener('DOMContentLoaded', () => {
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
  DOM.checkoutBtn = document.querySelector('[data-action="submit-checkout"]');
  DOM.termsConsent = document.getElementById('termsConsent');
  DOM.discountToggle = document.querySelector('.discount-toggle');
  DOM.discountForm = document.querySelector('.discount-form');
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
  DOM.sameAddressToggle?.addEventListener('change', handleSameAddressToggle);
  DOM.parentGuardianToggle?.addEventListener('change', handleParentGuardianToggle);
  DOM.termsConsent?.addEventListener('change', updateCheckoutButton);

  // Gym selection event listeners will be set up dynamically when gyms are loaded

  // Search functionality
  const gymSearch = document.getElementById('gymSearch');
  gymSearch?.addEventListener('input', handleGymSearch);


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
  
  // Set initial state (create account active)
  const createBtn = document.querySelector('[data-mode="create"]');
  if (createBtn) createBtn.classList.add('active');
  
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
  state.totals.cartTotal = items.reduce((total, item) => total + item.amount, 0);

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
  if (DOM.cartTotal) {
    DOM.cartTotal.textContent = currencyFormatter.format(state.totals.cartTotal);
  }

  if (DOM.billingPeriod) {
    DOM.billingPeriod.textContent = state.billingPeriod || 'Billing period confirmed after checkout.';
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
  if (!state.membershipPlanId) {
    console.warn(`[checkout] Cannot attach subscription (${context}) - no membership selected`);
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
    await orderAPI.addSubscriptionItem(orderId, state.membershipPlanId);
    state.subscriptionAttachedOrderId = orderId;
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
  if (!state.membershipPlanId) {
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

  if (!state.membershipPlanId) {
    showToast('Select a membership to continue.', 'error');
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
        };
        
        console.log('[checkout] Customer data before cleanup:', JSON.stringify(customerData, null, 2));
        
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
        
        // If no tokens from customer creation, login with email/password to get tokens
      if (!hasTokens && payload.customer?.email && payload.customer?.password) {
        console.log('[checkout] No tokens from customer creation, logging in to get tokens...');
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
            console.warn('[checkout] ⚠️ Login after customer creation failed:', loginError);
            console.warn('[checkout] Payment link generation might fail without authentication token');
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
    
    try {
      console.log('[checkout] Adding items to order...');
      
      // Add membership/subscription FIRST
	      if (state.membershipPlanId) {
	        try {
	          await ensureSubscriptionAttached('checkout-flow');
	          console.log('[checkout] Membership ensured on order');
          
          // CRITICAL: Generate Payment Link Card immediately after subscription is added
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
      
      // Add value cards (punch cards) - can be added after payment link is generated
      if (state.valueCardQuantities && state.valueCardQuantities.size > 0) {
        for (const [planId, quantity] of state.valueCardQuantities.entries()) {
          if (quantity > 0) {
            try {
              await orderAPI.addValueCardItem(state.orderId, planId, quantity);
              console.log(`[checkout] Value card added: ${planId} x${quantity}`);
            } catch (error) {
              console.error(`[checkout] Failed to add value card ${planId}:`, error);
              // Don't throw - payment link is already generated, just log the error
              console.warn(`[checkout] Continuing despite value card error - payment link already generated`);
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
      
      console.log('[checkout] All items added to order');
      
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
    const summaryOrder = state.orderId ? { id: state.orderId, orderId: state.orderId } : null;
    state.order = buildOrderSummary(payload, summaryOrder, customer);
    
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
    
    // Build order summary with fetched data
    state.order = buildOrderSummary(payload, { ...order, total: orderTotal, totalAmount: orderTotal }, customer || storedCustomer);
    console.log('[Payment Return] Order summary built:', state.order);
    
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
  if (state.currentStep >= TOTAL_STEPS) return;
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
  while (target <= TOTAL_STEPS) {
    const panel = DOM.stepPanels[target - 1];
    const hidden = panel && panel.style && panel.style.display === 'none';
    if (!hidden) break;
    target += 1;
    // Skip step 3 if we land on it
    if (target === 3) {
      target = 4;
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
    panel.classList.toggle('active', index + 1 === stepNumber);
  });
}

function updateStepIndicator() {
  const stepIndicator = document.querySelector('.step-indicator');
  if (!stepIndicator) return;

  if (state.currentStep === TOTAL_STEPS) {
    stepIndicator.classList.add('hidden');
  } else {
    stepIndicator.classList.remove('hidden');
  }

  // Compute visible step panels to determine current visible index
  const visiblePanels = DOM.stepPanels.filter((panel) => panel && panel.style.display !== 'none');
  const currentPanel = DOM.stepPanels[state.currentStep - 1];
  const visibleCurrentIndex = Math.max(0, visiblePanels.indexOf(currentPanel));

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
