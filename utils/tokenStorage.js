export function encodeTokenData(tokenData) {
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
}

export function decodeTokenData(value) {
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
}

export function writeLoginSessionCookie(cookieName, tokenData) {
  if (typeof document === 'undefined') return;
  try {
    const encoded = encodeTokenData(tokenData);
    const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${cookieName}=${encoded}; path=/; SameSite=Lax${secureFlag}`;
  } catch (error) {
    console.warn('[Step 6] Could not write login session cookie:', error);
  }
}

export function readLoginSessionCookie(cookieName) {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const cookies = document.cookie.split(';');
  const match = cookies.find((cookie) => cookie.trim().startsWith(`${cookieName}=`));
  if (!match) return null;
  const value = match.substring(match.indexOf('=') + 1).trim();
  return decodeTokenData(value);
}

export function clearLoginSessionCookie(cookieName) {
  if (typeof document === 'undefined') return;
  document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

export function hydrateFromCookie(cookieName) {
  const cookieData = readLoginSessionCookie(cookieName);
  return cookieData || null;
}
