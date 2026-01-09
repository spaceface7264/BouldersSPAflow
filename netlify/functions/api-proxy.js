// Netlify Function to proxy API requests and avoid CORS issues
// This function forwards requests from the frontend to the Join Boulders API
// Supports all HTTP methods (GET, POST, PUT, DELETE) for future implementation steps

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Language',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  // Extract the API path from the query string or path
  // The function will be called as: /.netlify/functions/api-proxy?path=/api/reference/business-units
  const apiPath = event.queryStringParameters?.path || event.path.replace('/.netlify/functions/api-proxy', '');
  
  if (!apiPath) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'API path is required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }

  // Build the full API URL
  // Check if path starts with /api/ver3 or /services - these use different base URL
  // According to backend team: ver3 endpoints use https://boulders.brpsystems.com/apiserver
  // Standard endpoints use: https://api-join.boulders.dk
  // 
  // IMPORTANT: Backend team confirmed full path is needed: /api/ver3/services/generatelink/payment
  // Do NOT remove /api/ver3 prefix - it's required
  let apiUrl;
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
  console.log('[API Proxy] Full request will be:', event.httpMethod, apiUrl);

  try {
    // Build request options - support all HTTP methods
    const requestOptions = {
      method: event.httpMethod,
      headers: {
        'Accept-Language': event.headers['accept-language'] || event.headers['Accept-Language'] || 'da-DK', // Use client's language preference or default
        'Content-Type': 'application/json',
        // Forward Authorization header if present (for future auth steps)
        ...(event.headers['authorization'] || event.headers['Authorization'] 
          ? { 'Authorization': event.headers['authorization'] || event.headers['Authorization'] }
          : {}),
      },
    };

    // Include request body for POST, PUT, PATCH methods
    if (['POST', 'PUT', 'PATCH'].includes(event.httpMethod) && event.body) {
      requestOptions.body = event.body;
    }

    // Forward the request to the API
    const response = await fetch(apiUrl, requestOptions);

    // Get the response data
    const data = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = data;
    }

    // Return the response with CORS headers
    return {
      statusCode: response.status,
      body: JSON.stringify(jsonData),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Language',
      },
    };
  } catch (error) {
    console.error('API Proxy Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
};

