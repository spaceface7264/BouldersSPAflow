// Step 6: Token Management Utilities
// Persist tokens in session store (memory-first, can fallback to localStorage/sessionStorage)

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number; // Optional: timestamp when access token expires
}

// In-memory token storage (memory-first as per guide)
let tokenStore: TokenData | null = null;

// Storage key for fallback persistence
const TOKEN_STORAGE_KEY = 'boulders_auth_tokens';

/**
 * Save tokens to session store
 * Step 6: Persist tokens in a small session store (memory-first is fine)
 */
export function saveTokens(accessToken: string, refreshToken: string, expiresAt?: number): void {
  const tokenData: TokenData = {
    accessToken,
    refreshToken,
    expiresAt,
  };

  // Store in memory (primary)
  tokenStore = tokenData;

  // Fallback: Store in sessionStorage for persistence across page reloads
  // This allows tokens to survive page refreshes while still being cleared when tab closes
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenData));
  } catch (error) {
    console.warn('[Step 6] Could not save tokens to sessionStorage:', error);
    // Continue with memory-only storage
  }
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
  try {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      const tokenData: TokenData = JSON.parse(stored);
      // Restore to memory
      tokenStore = tokenData;
      return tokenData.accessToken;
    }
  } catch (error) {
    console.warn('[Step 6] Could not read tokens from sessionStorage:', error);
  }

  return null;
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
  try {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      const tokenData: TokenData = JSON.parse(stored);
      // Restore to memory
      tokenStore = tokenData;
      return tokenData.refreshToken;
    }
  } catch (error) {
    console.warn('[Step 6] Could not read tokens from sessionStorage:', error);
  }

  return null;
}

/**
 * Clear tokens from session store
 * Step 6: Clear session and return to auth step
 */
export function clearTokens(): void {
  // Clear memory
  tokenStore = null;

  // Clear sessionStorage
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn('[Step 6] Could not clear tokens from sessionStorage:', error);
  }
}

/**
 * Check if access token is expired
 */
export function isTokenExpired(): boolean {
  if (!tokenStore?.expiresAt) {
    return false; // No expiry info, assume valid
  }

  // Add 5 minute buffer before actual expiry
  const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds
  return Date.now() >= (tokenStore.expiresAt - buffer);
}

/**
 * Check if tokens exist
 */
export function hasTokens(): boolean {
  return getAccessToken() !== null;
}

