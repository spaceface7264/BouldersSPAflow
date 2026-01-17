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
// Using broader patterns to avoid breaking when backend adds new endpoints
// Origin validation (CORS) is the primary security layer
// Path validation is defense-in-depth to ensure only API paths are proxied
const ALLOWED_PATH_PATTERNS = [
  /^\/api\/.+/,      // Allow any /api/* endpoint (goes to api-join.boulders.dk)
  /^\/services\/.+/, // Allow /services/* (goes to brpsystems.com with /api/ver3 prefix)
  /^\/ver3\/.+/,     // Allow /ver3/* (goes to brpsystems.com with /api prefix)
];

// Maximum request body size (1MB)
const MAX_REQUEST_SIZE = 1024 * 1024;

// Helper function to validate origin
// Returns the origin if valid, null if invalid
function validateOrigin(origin: string | null): string | null {
  if (!origin) {
    // For same-origin requests (no Origin header), allow but log
    // This is common for same-origin requests from the same domain
    return null;
  }

  // Check if origin is in allowed list
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // Check if it's a preview deployment (*.pages.dev)
  if (origin.endsWith('.pages.dev')) {
    return origin;
  }

  // Reject unknown origins for security
  return null;
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
  
  // Reject requests from unknown origins
  if (requestOrigin && !allowedOrigin) {
    console.warn('[API Proxy] Rejected request from unknown origin:', requestOrigin);
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  }
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    // For same-origin requests (no Origin header), return basic headers
    const preflightHeaders: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
    
    if (allowedOrigin) {
      Object.assign(preflightHeaders, getSecurityHeaders(allowedOrigin));
      preflightHeaders['Access-Control-Max-Age'] = '86400';
    }
    
    return new Response(null, {
      status: 200,
      headers: preflightHeaders,
    });
  }

  // Extract the API path from the query string
  // The function will be called as: /api-proxy?path=/api/reference/business-units
  const apiPath = url.searchParams.get('path');

  if (!apiPath) {
    const errorHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    };
    if (allowedOrigin) {
      Object.assign(errorHeaders, getSecurityHeaders(allowedOrigin));
    }
    return new Response(
      JSON.stringify({ error: 'API path is required' }),
      {
        status: 400,
        headers: errorHeaders,
      }
    );
  }

  // Validate API path for security
  if (!isValidApiPath(apiPath)) {
    const invalidHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    };
    if (allowedOrigin) {
      Object.assign(invalidHeaders, getSecurityHeaders(allowedOrigin));
    }
    return new Response(
      JSON.stringify({ error: 'Invalid API path' }),
      {
        status: 403,
        headers: invalidHeaders,
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
      const contentLength = request.headers.get('Content-Length');
      if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
        const errorHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
        };
        if (allowedOrigin) {
          Object.assign(errorHeaders, getSecurityHeaders(allowedOrigin));
        }
        return new Response(
          JSON.stringify({ error: 'Request body too large' }),
          {
            status: 413,
            headers: errorHeaders,
          }
        );
      }
      
      const bodyText = await request.text();
      if (bodyText.length > MAX_REQUEST_SIZE) {
        const errorHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
        };
        if (allowedOrigin) {
          Object.assign(errorHeaders, getSecurityHeaders(allowedOrigin));
        }
        return new Response(
          JSON.stringify({ error: 'Request body too large' }),
          {
            status: 413,
            headers: errorHeaders,
          }
        );
      }
      
      requestOptions.body = bodyText;
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
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    };
    if (allowedOrigin) {
      Object.assign(responseHeaders, getSecurityHeaders(allowedOrigin));
    }
    
    return new Response(
      JSON.stringify(jsonData),
      {
        status: response.status,
        headers: responseHeaders,
      }
    );
  } catch (error: any) {
    // Log full error details server-side for debugging
    console.error('[API Proxy] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    
    // Return generic error message to client (don't leak internal details)
    const errorResponseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    };
    if (allowedOrigin) {
      Object.assign(errorResponseHeaders, getSecurityHeaders(allowedOrigin));
    }
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        // Don't expose error.message to prevent information leakage
      }),
      {
        status: 500,
        headers: errorResponseHeaders,
      }
    );
  }
}

