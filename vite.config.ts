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
    
    // Copy functions directory
    if (fs.existsSync(functionsDir)) {
      // Create dist/functions directory if it doesn't exist
      if (!fs.existsSync(distFunctionsDir)) {
        fs.mkdirSync(distFunctionsDir, { recursive: true });
      }
      
      // Copy all files from functions to dist/functions
      const files = fs.readdirSync(functionsDir);
      files.forEach((file: string) => {
        const srcFile = path.join(functionsDir, file);
        const destFile = path.join(distFunctionsDir, file);
        fs.copyFileSync(srcFile, destFile);
        console.log(`[Vite] Copied ${file} to dist/functions/`);
      });
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
      '/api': {
        target: 'https://api-join.boulders.dk',
        changeOrigin: true,
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Add required headers for API requests
            proxyReq.setHeader('Accept-Language', 'da-DK');
            proxyReq.setHeader('Content-Type', 'application/json');
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

