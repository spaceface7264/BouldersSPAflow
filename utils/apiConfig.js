export function getApiConfig({ baseUrlOverride = null } = {}) {
  const hostname = window.location.hostname;
  const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1';
  const isCloudflarePages = hostname.includes('pages.dev') ||
    hostname.includes('join.boulders.dk') ||
    hostname === 'boulders.dk';
  const isCloudflareWorker = hostname.includes('workers.dev');

  if (baseUrlOverride) {
    return { baseUrl: baseUrlOverride, useProxy: false, isDevelopment };
  }

  if (isDevelopment) {
    return { baseUrl: '', useProxy: false, isDevelopment };
  }

  if (isCloudflarePages) {
    return { baseUrl: '/api-proxy', useProxy: true, isDevelopment };
  }

  if (isCloudflareWorker) {
    return { baseUrl: 'https://api-join.boulders.dk', useProxy: false, isDevelopment };
  }

  return { baseUrl: 'https://api-join.boulders.dk', useProxy: false, isDevelopment };
}
