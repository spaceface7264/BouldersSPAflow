const normalizePath = (path = '') => (path.startsWith('/') ? path : `/${path}`);

export function buildApiUrl({ baseUrl = '', useProxy = false, path = '' } = {}) {
  const normalizedPath = normalizePath(path);
  if (useProxy) {
    return `${baseUrl}?path=${normalizedPath}`;
  }
  return `${baseUrl}${normalizedPath}`;
}

function extractRetryAfterSeconds(payload, response) {
  if (payload && typeof payload === 'object') {
    const fromBody = payload.retryAfter ?? payload.error?.retryAfter;
    const parsed = parseInt(fromBody, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  const header = response?.headers?.get?.('Retry-After');
  if (header) {
    const asInt = parseInt(header, 10);
    if (!Number.isNaN(asInt) && asInt > 0) return asInt;
  }

  return null;
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

  const contentType = response.headers.get('Content-Type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(`HTTP error! status: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    // Surface retryAfter for callers (no auto-retry — unsafe for non-idempotent POSTs).
    const retryAfter = extractRetryAfterSeconds(payload, response);
    if (retryAfter != null) {
      error.retryAfter = retryAfter;
    }
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
