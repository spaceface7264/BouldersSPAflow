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
  // Check if path starts with /api/ver3 - these use different base URL
  // According to README: ver3 endpoints use https://boulders.brpsystems.com/apiserver
  // Standard endpoints use: https://api-join.boulders.dk
  let apiUrl;
  if (apiPath.startsWith('/api/ver3/')) {
    // ver3 endpoints use different base URL: https://boulders.brpsystems.com/apiserver
    // Path already includes /api/ver3, so just append to base URL
    apiUrl = `https://boulders.brpsystems.com/apiserver${apiPath}`;
  } else if (apiPath.startsWith('/ver3/') || apiPath.startsWith('/services/')) {
    // Path doesn't include /api prefix - add it
    if (apiPath.startsWith('/services/')) {
      apiUrl = `https://boulders.brpsystems.com/apiserver/api/ver3${apiPath}`;
    } else {
      apiUrl = `https://boulders.brpsystems.com/apiserver/api${apiPath}`;
    }
  } else {
    // Standard API endpoints use api-join.boulders.dk
    apiUrl = `https://api-join.boulders.dk${apiPath}`;
  }
  
  console.log('[API Proxy] Constructed URL:', apiUrl, 'from path:', apiPath);

  try {
    // Build request options - support all HTTP methods
    const requestOptions = {
      method: event.httpMethod,
      headers: {
        'Accept-Language': 'da-DK', // Step 2: Language default
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

