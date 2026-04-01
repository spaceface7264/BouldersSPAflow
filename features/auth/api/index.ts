import { getAccessToken } from '../../../shared/lib/tokens';

// BRP API3 is proxied at /api/ver3/ (Vite dev proxy + Cloudflare Pages proxy in prod)
const BRP_BASE = '';

async function brpPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BRP_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'da-DK',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Auth error ${response.status}`), {
      status: response.status,
      data: err,
    });
  }

  return response.json() as Promise<T>;
}

export interface AuthLoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // milliseconds
  token_type: string;
  username: string; // This is the customer ID (e.g. "4711")
  roles: string[];
}

/**
 * Login with email/phone/card number + password.
 * Returns tokens and `username` which is the BRP customer ID.
 */
export async function login(username: string, password: string): Promise<AuthLoginResponse> {
  return brpPost<AuthLoginResponse>('/api/ver3/auth/login', { username, password });
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthLoginResponse> {
  return brpPost<AuthLoginResponse>('/api/ver3/auth/refresh', { refreshToken });
}

/**
 * Send a password reset email. Always returns success to prevent email enumeration.
 */
export async function resetPassword(email: string): Promise<void> {
  await fetch(`${BRP_BASE}/api/ver3/auth/resetpassword`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': 'da-DK' },
    body: JSON.stringify({ email }),
  });
}

/**
 * Validate the current access token.
 */
export async function validateToken(): Promise<boolean> {
  const token = getAccessToken();
  if (!token) return false;

  try {
    const response = await fetch(`${BRP_BASE}/api/ver3/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'da-DK',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    return response.ok;
  } catch {
    return false;
  }
}
