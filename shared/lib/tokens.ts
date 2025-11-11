// Step 6: Token Management Utilities
// Persist tokens in session store (memory-first, can fallback to localStorage/sessionStorage)

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number; // Optional: timestamp when access token expires
}

interface StoredTokenData extends TokenData {
  metadata?: Record<string, unknown>;
}

// In-memory token storage (memory-first as per guide)
let tokenStore: StoredTokenData | null = null;

// Storage key for fallback persistence
const TOKEN_STORAGE_KEY = 'boulders_auth_tokens';
const LOGIN_SESSION_COOKIE = 'boulders_login_session';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const encodeTokenData = (tokenData: StoredTokenData): string => {
  const payload = JSON.stringify(tokenData);
  if (isBrowser && typeof window.btoa === 'function') {
    try {
      return window.btoa(payload);
    } catch (error) {
      console.warn('[Step 6] Could not base64 encode token data:', error);
    }
  }

  try {
    return encodeURIComponent(payload);
  } catch (error) {
    console.warn('[Step 6] Could not URI encode token data:', error);
    return payload;
  }
};

const decodeTokenData = (value: string): StoredTokenData | null => {
  if (!value) return null;
  if (isBrowser && typeof window.atob === 'function') {
    try {
      return JSON.parse(window.atob(value));
    } catch (error) {
      // Fallback to URI decoding below
    }
  }

  try {
    return JSON.parse(decodeURIComponent(value));
  } catch (error) {
    console.warn('[Step 6] Could not decode login session cookie:', error);
    return null;
  }
};

const writeLoginSessionCookie = (tokenData: StoredTokenData): void => {
  if (!isBrowser) return;
  try {
    const encoded = encodeTokenData(tokenData);
    const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${LOGIN_SESSION_COOKIE}=${encoded}; path=/; SameSite=Lax${secureFlag}`;
  } catch (error) {
    console.warn('[Step 6] Could not write login session cookie:', error);
  }
};

const readLoginSessionCookie = (): StoredTokenData | null => {
  if (!isBrowser || !document.cookie) return null;
  const cookies = document.cookie.split(';');
  const match = cookies.find((cookie) => cookie.trim().startsWith(`${LOGIN_SESSION_COOKIE}=`));
  if (!match) return null;
  const value = match.substring(match.indexOf('=') + 1).trim();
  return decodeTokenData(value);
};

const clearLoginSessionCookie = (): void => {
  if (!isBrowser) return;
  document.cookie = `${LOGIN_SESSION_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
};

const hydrateFromCookie = (): StoredTokenData | null => {
  const cookieData = readLoginSessionCookie();
  if (cookieData) {
    tokenStore = cookieData;
  }
  return cookieData;
};

if (isBrowser) {
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
}

/**
 * Save tokens to session store
 * Step 6: Persist tokens in a small session store (memory-first is fine)
 */
export function saveTokens(
  accessToken: string,
  refreshToken: string,
  expiresAt?: number,
  metadata: Record<string, unknown> = {}
): void {
  const tokenData: StoredTokenData = {
    accessToken,
    refreshToken,
    expiresAt,
    metadata,
  };

  // Store in memory (primary)
  tokenStore = tokenData;

  // Fallback: Store in sessionStorage for persistence across page reloads
  // This allows tokens to survive page refreshes while still being cleared when tab closes
  if (isBrowser) {
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenData));
    } catch (error) {
      console.warn('[Step 6] Could not save tokens to sessionStorage:', error);
      // Continue with memory-only storage
    }
  }

  writeLoginSessionCookie(tokenData);
}

/**
 * Get access token from session store
 * Step 6: Helper so HTTP helper can reuse tokens automatically
 */
export function getAccessToken(): string | null {
  // Try memory first
  if (tokenStore?.accessToken) {
    return tokenStore.accessToken;
  }

  // Fallback: Try sessionStorage
  if (isBrowser) {
    try {
      const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        const tokenData: StoredTokenData = JSON.parse(stored);
        // Restore to memory
        tokenStore = tokenData;
        return tokenData.accessToken;
      }
    } catch (error) {
      console.warn('[Step 6] Could not read tokens from sessionStorage:', error);
    }
  }

  const cookieTokens = hydrateFromCookie();
  return cookieTokens?.accessToken ?? null;
}

/**
 * Get refresh token from session store
 */
export function getRefreshToken(): string | null {
  // Try memory first
  if (tokenStore?.refreshToken) {
    return tokenStore.refreshToken;
  }

  // Fallback: Try sessionStorage
  if (isBrowser) {
    try {
      const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        const tokenData: StoredTokenData = JSON.parse(stored);
        // Restore to memory
        tokenStore = tokenData;
        return tokenData.refreshToken;
      }
    } catch (error) {
      console.warn('[Step 6] Could not read tokens from sessionStorage:', error);
    }
  }

  const cookieTokens = hydrateFromCookie();
  return cookieTokens?.refreshToken ?? null;
}

export function getTokenMetadata(): Record<string, unknown> | null {
  if (tokenStore?.metadata) {
    return tokenStore.metadata ?? null;
  }

  if (isBrowser) {
    try {
      const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        const tokenData: StoredTokenData = JSON.parse(stored);
        tokenStore = tokenData;
        return tokenData.metadata ?? null;
      }
    } catch (error) {
      console.warn('[Step 6] Could not read token metadata from sessionStorage:', error);
    }
  }

  const cookieTokens = hydrateFromCookie();
  return cookieTokens?.metadata ?? null;
}

/**
 * Clear tokens from session store
 * Step 6: Clear session and return to auth step
 */
export function clearTokens(): void {
  // Clear memory
  tokenStore = null;

  // Clear sessionStorage
  if (isBrowser) {
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.warn('[Step 6] Could not clear tokens from sessionStorage:', error);
    }
  }

  clearLoginSessionCookie();
}

/**
 * Check if access token is expired
 */
export function isTokenExpired(): boolean {
  const activeStore = tokenStore ?? hydrateFromCookie();
  if (!activeStore?.expiresAt) {
    return false; // No expiry info, assume valid
  }

  // Add 5 minute buffer before actual expiry
  const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds
  return Date.now() >= (activeStore.expiresAt - buffer);
}

/**
 * Check if tokens exist
 */
export function hasTokens(): boolean {
  return getAccessToken() !== null;
}
