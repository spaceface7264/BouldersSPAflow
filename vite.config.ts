import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
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

// Plugin to exclude app.js from HTML processing (it's a standalone script, not a module)
const excludeAppJsPlugin = () => ({
  name: 'exclude-app-js',
  transformIndexHtml(html) {
    // Replace module script with regular script to prevent Vite from parsing it
    return html.replace(
      /<script type="module" src="\.\/app\.js"><\/script>/,
      '<script src="./app.js"></script>'
    );
  }
});

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

    // Copy app.js to dist root (required by index.html)
    const appJsFile = path.resolve(__dirname, 'app.js');
    if (fs.existsSync(appJsFile)) {
      const distAppJsFile = path.resolve(__dirname, 'dist', 'app.js');
      fs.copyFileSync(appJsFile, distAppJsFile);
      console.log(`[Vite] Copied app.js to dist/`);
    }

    // Copy gtm-utils.js to dist root (required by index.html)
    const gtmUtilsFile = path.resolve(__dirname, 'gtm-utils.js');
    if (fs.existsSync(gtmUtilsFile)) {
      const distGtmUtilsFile = path.resolve(__dirname, 'dist', 'gtm-utils.js');
      fs.copyFileSync(gtmUtilsFile, distGtmUtilsFile);
      console.log(`[Vite] Copied gtm-utils.js to dist/`);
    }

    // Copy _headers file to dist root for Cloudflare Pages
    const headersFile = path.resolve(__dirname, '_headers');
    if (fs.existsSync(headersFile)) {
      const distHeadersFile = path.resolve(__dirname, 'dist', '_headers');
      fs.copyFileSync(headersFile, distHeadersFile);
      console.log(`[Vite] Copied _headers to dist/`);
    }
  }
});

// https://vitejs.dev/config/
const resolveBasePath = () => {
  if (process.env.VITE_BASE_PATH) {
    return process.env.VITE_BASE_PATH;
  }

  // GitHub Actions exposes GITHUB_REPOSITORY as "owner/repo"
  if (process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
    return `/${repoName}/`;
  }

  return '/';
};

export default defineConfig(({ command }) => {
  // Conditionally include Sentry plugin only in production builds with auth token
  const plugins = [react(), excludeAppJsPlugin(), copyFunctionsPlugin()];

  // Only upload source maps to Sentry if auth token is provided
  // Set SENTRY_AUTH_TOKEN in your CI/CD environment
  if (command === 'build' && process.env.SENTRY_AUTH_TOKEN) {
    plugins.push(
      sentryVitePlugin({
        org: process.env.SENTRY_ORG || 'boulders',
        project: process.env.SENTRY_PROJECT || 'join-boulders-dk',
        authToken: process.env.SENTRY_AUTH_TOKEN,

        // Upload source maps to Sentry for better error debugging
        sourcemaps: {
          assets: './dist/assets/**',
          filesToDeleteAfterUpload: './dist/assets/**/*.map',
        },

        // Set release version for tracking
        release: {
          name: process.env.VITE_SENTRY_RELEASE || `${Date.now()}`,
        },
      })
    );
    console.log('[Vite] Sentry plugin enabled - source maps will be uploaded');
  }

  return {
    plugins,
    base: resolveBasePath(),
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
          rewrite: (path) => {
            // Vite strips the matched prefix, so /api/ver3/services/countries becomes /services/countries
            // We need to add /api/ver3 back to get /api/ver3/services/countries
            // But check if it's already there to avoid doubling
            if (path.startsWith('/api/ver3')) {
              return path; // Already has the prefix
            }
            return `/api/ver3${path}`;
          },
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Forward Accept-Language header from client request, or default to da-DK
              const acceptLanguage = req.headers['accept-language'] || req.headers['Accept-Language'] || 'da-DK';
              proxyReq.setHeader('Accept-Language', acceptLanguage);
              proxyReq.setHeader('Content-Type', 'application/json');
              console.log('[Vite Proxy] Forwarding /api/ver3 request:', req.url, 'to:', proxyReq.path, 'with Accept-Language:', acceptLanguage);
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
      assetsDir: 'assets',
      // Enable source maps for better error debugging in Sentry
      sourcemap: true,
    }
  }
})

