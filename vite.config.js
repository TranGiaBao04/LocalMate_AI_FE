import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api tới backend LocalMateAI.API chạy local (mục 5.7 README backend).
    // Bỏ qua khi VITE_API_BASE_URL đã trỏ thẳng tới một backend khác (staging/prod).
    proxy: {
      '/api': {
        target: 'https://localhost:7144',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
