// Shared origin policy for all Pages Functions. Underscore-prefixed files
// export no onRequest handler, so Pages does not mount them as routes.

const ALLOWED_ORIGINS = [
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

export interface CorsOptions {
  methods?: string;
  allowHeaders?: string;
}

export function corsHeaders(origin: string | null, options: CorsOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = options.methods ?? 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = options.allowHeaders ?? 'Content-Type, Authorization';
  }
  return headers;
}

export function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
  options?: CorsOptions,
): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin, options) });
}

// Deploy environment for logging/attribution, inferred from the request origin
// when env.ENVIRONMENT is not configured.
export function classifyEnvironment(origin: string | null, configured?: string): string {
  if (configured) return configured;
  if (origin && origin.endsWith('.pages.dev')) return 'preview';
  if (origin && origin.includes('localhost')) return 'dev';
  return 'production';
}
