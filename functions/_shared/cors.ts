// Shared origin policy for all Pages Functions. Underscore-prefixed files
// export no onRequest handler, so Pages does not mount them as routes.

export const ALLOWED_ORIGINS = [
  'https://join.boulders.dk',
  'https://bouldersspaflow.pages.dev',
  'http://localhost:5173', // Local development (Vite default)
  'http://localhost:5174', // Local development (alternative port)
  'http://localhost:4173', // Local preview
];

// Returns the origin if valid, null if invalid. Same-origin requests carry no
// Origin header and pass through as null.
export function validateOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Preview deployments
  if (origin.endsWith('.pages.dev')) return origin;
  return null;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
  return headers;
}

export function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}
