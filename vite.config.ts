import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = env.VITE_API_BASE_URL || ''
  const backendOrigin =
    env.VITE_SOCKET_URL ||
    apiBaseUrl.replace(/\/api\/?$/, '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3000,
      proxy: backendOrigin
        ? {
            '/api': {
              target: backendOrigin,
              changeOrigin: true,
            },
            '/socket.io': {
              target: backendOrigin,
              ws: true,
              changeOrigin: true,
            },
          }
        : undefined,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-charts': ['recharts'],
            'vendor-socket': ['socket.io-client'],
            'vendor-ui': ['lucide-react', 'clsx'],
          },
        },
      },
    },
  }
})
