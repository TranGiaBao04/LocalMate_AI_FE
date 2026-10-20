import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // package.json là "type": "module" nên không có __dirname, lấy đường dẫn theo import.meta.url
      'lucide-react': fileURLToPath(new URL('./src/components/common/LucideShim.jsx', import.meta.url)),
    },
  },
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
