import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/osmani-admin-proxy': {
        target: 'https://osmani-admin-api.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osmani-admin-proxy/, ''),
      },
      '/osmani-tv-proxy': {
        target: 'https://osmani-tv.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osmani-tv-proxy/, ''),
      },
    },
  },
})
