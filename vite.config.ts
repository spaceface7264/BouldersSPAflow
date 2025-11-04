import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: true,
    port: 5173,
    strictPort: false
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})

