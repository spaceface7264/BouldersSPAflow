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
      // Note: Vite proxy keeps the path, so /api/ver3/services/countries becomes
      // https://boulders.brpsystems.com/apiserver/api/ver3/services/countries
      '/api/ver3': {
        target: 'https://boulders.brpsystems.com/apiserver',
        changeOrigin: true,
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Forward Accept-Language header from client request, or default to da-DK
            const acceptLanguage = req.headers['accept-language'] || req.headers['Accept-Language'] || 'da-DK';
            proxyReq.setHeader('Accept-Language', acceptLanguage);
            proxyReq.setHeader('Content-Type', 'application/json');
            console.log('[Vite Proxy] Forwarding /api/ver3 request:', req.url, 'with Accept-Language:', acceptLanguage);
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

