import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Helper to safely read certificate files if they exist
const readIfExists = (file: string) => {
  try {
    return fs.readFileSync(path.resolve(__dirname, file));
  } catch {
    return undefined;
  }
};

const key = readIfExists('key.pem');
const cert = readIfExists('cert.pem');

// Plugin to copy functions directory and postal-codes-dk.js to dist for Cloudflare Pages deployment
const copyFunctionsPlugin = () => ({
  name: 'copy-functions',
  closeBundle() {
    const functionsDir = path.resolve(__dirname, 'functions');
    const distFunctionsDir = path.resolve(__dirname, 'dist', 'functions');
    
    // Copy functions directory recursively (including subdirectories)
    if (fs.existsSync(functionsDir)) {
      const copyDir = (src: string, dest: string) => {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        const entries = fs.readdirSync(src, { withFileTypes: true });
        entries.forEach((entry: fs.Dirent) => {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
            console.log(`[Vite] Copied ${entry.name} to dist/functions/${path.relative(functionsDir, srcPath)}`);
          }
        });
      };
      copyDir(functionsDir, distFunctionsDir);
    }
    
    // Copy postal-codes-dk.js to dist root
    const postalCodesFile = path.resolve(__dirname, 'postal-codes-dk.js');
    if (fs.existsSync(postalCodesFile)) {
      const distPostalCodesFile = path.resolve(__dirname, 'dist', 'postal-codes-dk.js');
      fs.copyFileSync(postalCodesFile, distPostalCodesFile);
      console.log(`[Vite] Copied postal-codes-dk.js to dist/`);
    }
  }
});

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), copyFunctionsPlugin()],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // Disable HMR overlay for cleaner error handling (can be re-enabled if needed)
    hmr: {
      overlay: true,
    },
    // Only use HTTPS in dev mode when certificate files are present
    ...(key && cert && command === 'serve' ? {
      https: {
        // Self-signed certificate for local development
        // Required for geolocation API to work on mobile devices
        key,
        cert,
      },
    } : {}),
    // Proxy API requests to avoid CORS issues in development
    proxy: {
      // Handle /api/ver3/ endpoints - these go to boulders.brpsystems.com/apiserver
      // Vite proxy by default strips the matched prefix (/api/ver3), so we need to rewrite
      // to keep the full path including /api/ver3
      '/api/ver3': {
        target: 'https://boulders.brpsystems.com/apiserver',
        changeOrigin: true,
        secure: true,
        // Don't rewrite - keep the full path including /api/ver3
        // Query parameters are automatically preserved by http-proxy-middleware
        rewrite: (path) => {
          // Vite strips the matched prefix, so /api/ver3/services/countries becomes /services/countries
          // We need to add /api/ver3 back to get /api/ver3/services/countries
          // But check if it's already there to avoid doubling
          // IMPORTANT: The 'path' parameter does NOT include query parameters
          // Query parameters are handled separately by Vite proxy and should be preserved automatically
          if (path.startsWith('/api/ver3')) {
            return path; // Already has the prefix
          }
          return `/api/ver3${path}`;
        },
        // Ensure query parameters are forwarded
        // IMPORTANT: autoRewrite and followRedirects should preserve query strings
        autoRewrite: true,
        logLevel: 'debug',
        // Use onProxyReq to intercept and fix query string before forwarding
        onProxyReq: (proxyReq, req, _res) => {
          // Log initial state before any modifications
          const initialProxyPath = proxyReq.path;
          
          // Forward Accept-Language header from client request, or default to da-DK
          const acceptLanguage = req.headers['accept-language'] || req.headers['Accept-Language'] || 'da-DK';
          proxyReq.setHeader('Accept-Language', acceptLanguage);
          proxyReq.setHeader('Content-Type', 'application/json');
          
          // CRITICAL: Extract raw query string before Express parses it
          // Express parses query strings and converts period.start into nested objects
          // We need to preserve the original query string with dots intact
          let queryString = '';
          
          // Try multiple methods to get the raw query string (in order of preference)
          // Method 1: Use the original request URL if available (most reliable)
          const originalRequestUrl = req.originalUrl || req.url || '';
          if (originalRequestUrl.includes('?')) {
            queryString = originalRequestUrl.split('?')[1];
          }
          
          // Method 2: Fallback to parsedUrl.search if available
          if (!queryString && req._parsedUrl && req._parsedUrl.search) {
            queryString = req._parsedUrl.search.substring(1); // Remove leading ?
          }
          
          // Method 3: Try to reconstruct from proxyReq.path if it has query params
          if (!queryString && proxyReq.path && proxyReq.path.includes('?')) {
            queryString = proxyReq.path.split('?')[1];
          }
          
          // Log parsed query object to see if middleware has already parsed it incorrectly
          const parsedQuery = req.query || {};
          const parsedQueryKeys = Object.keys(parsedQuery);
          
          // Validate query string doesn't contain null values
          if (queryString && (queryString.includes('null') || queryString.includes('period.start=null') || queryString.includes('period.end=null'))) {
            console.error('[Vite Proxy] Query string contains null values:', queryString);
          }
          
          // CRITICAL: Override proxyReq.path to ensure query string is preserved exactly as-is
          // The rewrite function has already handled adding /api/ver3 back to the path
          // We just need to ensure the query string (with dots in param names) is preserved
          if (queryString) {
            // Get base path (remove any existing query string that middleware might have added incorrectly)
            const basePath = proxyReq.path.includes('?') ? proxyReq.path.split('?')[0] : proxyReq.path;
            
            // Verify basePath has correct prefix (rewrite function should have added it)
            if (!basePath.startsWith('/api/ver3')) {
              console.error('[Vite Proxy] ERROR: Base path missing /api/ver3 prefix!', {
                basePath,
                initialProxyPath,
                originalUrl: req.url,
                originalPath: req.path
              });
              // Try to fix it by adding the prefix
              const fixedPath = `/api/ver3${basePath}`;
              proxyReq.path = fixedPath + '?' + queryString;
            } else {
              // Path is correct, just replace query string with original
              proxyReq.path = basePath + '?' + queryString;
            }
          }
          
          // Log full URL including query string for debugging
          // These logs appear in the Vite dev server terminal, not browser console
          console.log('[Vite Proxy] Forwarding /api/ver3 request:', {
            initialProxyPath: initialProxyPath,
            finalProxyPath: proxyReq.path,
            originalUrl: req.url,
            originalOriginalUrl: req.originalUrl,
            parsedUrlSearch: req._parsedUrl?.search,
            originalPath: req.path,
            queryString: queryString,
            parsedQuery: parsedQuery,
            parsedQueryKeys: parsedQueryKeys,
            hasQuery: !!queryString,
            acceptLanguage: acceptLanguage,
            // Log if query string contains period parameters
            hasPeriodParams: queryString.includes('period.start') || queryString.includes('period.end'),
            // Check if parsed query has period params (might have different keys)
            parsedHasPeriodParams: parsedQueryKeys.some(k => k.includes('period'))
          });
        },
      },
      // Handle other /api endpoints - these go to api-join.boulders.dk
      '/api': {
        target: 'https://api-join.boulders.dk',
        changeOrigin: true,
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Forward Accept-Language header from client request, or default to da-DK
            const acceptLanguage = req.headers['accept-language'] || req.headers['Accept-Language'] || 'da-DK';
            proxyReq.setHeader('Accept-Language', acceptLanguage);
            proxyReq.setHeader('Content-Type', 'application/json');
            console.log('[Vite Proxy] Forwarding /api request:', req.url, 'with Accept-Language:', acceptLanguage);
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
}))

