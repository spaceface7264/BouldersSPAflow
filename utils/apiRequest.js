const normalizePath = (path = '') => (path.startsWith('/') ? path : `/${path}`);

export function buildApiUrl({ baseUrl = '', useProxy = false, path = '' } = {}) {
  const normalizedPath = normalizePath(path);
  if (useProxy) {
    return `${baseUrl}?path=${normalizedPath}`;
  }
  return `${baseUrl}${normalizedPath}`;
}

export async function requestJson({
  url,
  method = 'GET',
  headers = {},
  body = null,
  expectJson = true,
} = {}) {
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Successful no-content responses are valid for DELETE/cancel endpoints.
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const contentType = response.headers.get('Content-Type') || '';
  const isJson = contentType.includes('application/json');
  const raw = await response.text();
  const payload = isJson && raw ? JSON.parse(raw) : raw;

  if (!response.ok) {
    const error = new Error(`HTTP error! status: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (expectJson && !isJson) {
    const error = new Error(
      `API returned non-JSON response. Status: ${response.status}. ` +
      'This usually means the API endpoint is not working correctly or the proxy is misconfigured.'
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
