import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function stripProxyHeaders(proxy: {
  on: (
    event: 'proxyReq',
    listener: (proxyReq: { removeHeader: (name: string) => void }) => void,
  ) => void
}) {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.removeHeader('origin')
    proxyReq.removeHeader('referer')
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/osmani-admin-payment-proxy': {
        target: 'https://osmani-admin-api.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osmani-admin-payment-proxy/, ''),
        configure: stripProxyHeaders,
      },
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
