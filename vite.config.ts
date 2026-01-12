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
    assetsDir: 'assets'
  }
}))

