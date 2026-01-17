// Cloudflare Pages Function to proxy API requests and avoid CORS issues
// This function forwards requests from the frontend to the Join Boulders API
// Supports all HTTP methods (GET, POST, PUT, DELETE) for future implementation steps
// Based on the legacy proxy implementation to maintain consistency

// Allowed origins for CORS - production domains only
const ALLOWED_ORIGINS = [
  'https://join.boulders.dk',
  'https://bouldersspaflow.pages.dev',
  'http://localhost:5173', // Local development (Vite default)
  'http://localhost:5174', // Local development (alternative port)
  'http://localhost:4173', // Local preview
];

// Allowed API path patterns for security
const ALLOWED_PATH_PATTERNS = [
  /^\/api\/reference\/.+/,
  /^\/api\/products\/.+/,
  /^\/api\/ver3\/services\/.+/,
  /^\/services\/.+/,
  /^\/ver3\/.+/,
];

// Helper function to validate origin
function validateOrigin(origin: string | null): string {
  if (!origin) {
    return ALLOWED_ORIGINS[0]; // Default to production domain
  }

  // Check if origin is in allowed list
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // Check if it's a preview deployment (*.pages.dev)
  if (origin.endsWith('.pages.dev')) {
    return origin;
  }

  // Default to first allowed origin if not matched
  return ALLOWED_ORIGINS[0];
}

// Helper function to validate API path
function isValidApiPath(path: string): boolean {
  return ALLOWED_PATH_PATTERNS.some(pattern => pattern.test(path));
}

// Security headers to add to all responses
function getSecurityHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Language',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

export async function onRequest(context: any) {
  const request = context.request;
  const url = new URL(request.url);

  // Validate origin
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigin = validateOrigin(requestOrigin);
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        ...getSecurityHeaders(allowedOrigin),
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Extract the API path from the query string
  // The function will be called as: /api-proxy?path=/api/reference/business-units
  const apiPath = url.searchParams.get('path');

  if (!apiPath) {
    return new Response(
      JSON.stringify({ error: 'API path is required' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...getSecurityHeaders(allowedOrigin),
        },
      }
    );
  }

  // Validate API path for security
  if (!isValidApiPath(apiPath)) {
    return new Response(
      JSON.stringify({ error: 'Invalid API path' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...getSecurityHeaders(allowedOrigin),
        },
      }
    );
  }

  // Build the full API URL
  // Check if path starts with /api/ver3 or /services - these use different base URL
  // According to backend team: ver3 endpoints use https://boulders.brpsystems.com/apiserver
  // Standard endpoints use: https://api-join.boulders.dk
  // 
  // IMPORTANT: Backend team confirmed full path is needed: /api/ver3/services/generatelink/payment
  // Do NOT remove /api/ver3 prefix - it's required
  let apiUrl: string;
  if (apiPath.startsWith('/api/ver3/')) {
    // ver3 endpoints - use full path with /api/ver3 prefix
    // Backend confirmed: https://boulders.brpsystems.com/apiserver/api/ver3/services/generatelink/payment
    apiUrl = `https://boulders.brpsystems.com/apiserver${apiPath}`;
    console.log('[API Proxy] Using ver3 endpoint with full path:', apiUrl);
  } else if (apiPath.startsWith('/services/')) {
    // Services endpoints without /api/ver3 prefix - add it
    // Final URL: https://boulders.brpsystems.com/apiserver/api/ver3/services/...
    apiUrl = `https://boulders.brpsystems.com/apiserver/api/ver3${apiPath}`;
  } else if (apiPath.startsWith('/ver3/')) {
    // Path starts with /ver3/ but not /api/ver3/ - add /api prefix
    apiUrl = `https://boulders.brpsystems.com/apiserver/api${apiPath}`;
  } else {
    // Standard API endpoints use api-join.boulders.dk
    apiUrl = `https://api-join.boulders.dk${apiPath}`;
  }
  
  console.log('[API Proxy] Input path:', apiPath);
  console.log('[API Proxy] Constructed URL:', apiUrl);
  console.log('[API Proxy] Full request will be:', request.method, apiUrl);

  try {
    // Build request headers
    const headers: Record<string, string> = {
      'Accept-Language': request.headers.get('Accept-Language') || 'da-DK', // Use client's language preference or default
      'Content-Type': 'application/json',
    };

    // Forward Authorization header if present (for auth steps)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Build request options
    const requestOptions: RequestInit = {
      method: request.method,
      headers,
    };

    // Include request body for POST, PUT, PATCH methods
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      requestOptions.body = await request.text();
    }

    // Forward the request to the API
    const response = await fetch(apiUrl, requestOptions);

    // Get the response data
    const data = await response.text();
    let jsonData: any;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = data;
    }

    // Return the response with CORS headers
    return new Response(
      JSON.stringify(jsonData),
      {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...getSecurityHeaders(allowedOrigin),
        },
      }
    );
  } catch (error: any) {
    console.error('API Proxy Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getSecurityHeaders(allowedOrigin),
        },
      }
    );
  }
}

