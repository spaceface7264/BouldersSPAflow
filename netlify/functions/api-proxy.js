// Netlify Function to proxy API requests and avoid CORS issues
// This function forwards requests from the frontend to the Join Boulders API

exports.handler = async (event, context) => {
  // Only allow GET requests for now (can be extended for POST, etc.)
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
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
  const apiUrl = `https://api-join.boulders.dk${apiPath}`;

  try {
    // Forward the request to the API
    const response = await fetch(apiUrl, {
      method: event.httpMethod,
      headers: {
        'Accept-Language': 'da-DK',
        'Content-Type': 'application/json',
        // Forward any additional headers from the original request
        ...(event.headers['authorization'] && { 'Authorization': event.headers['authorization'] }),
      },
    });

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

