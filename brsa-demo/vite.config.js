import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'https://brsa-demo.klipklop.co.za',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
