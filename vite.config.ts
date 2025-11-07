import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    https: {
      // Self-signed certificate for local development
      // Required for geolocation API to work on mobile devices
      key: fs.readFileSync(path.resolve(__dirname, 'key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'cert.pem')),
    },
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
})

