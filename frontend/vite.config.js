import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcoords from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcoords()],
  build: {
    // rolldownOptions replaces rollupOptions in Vite 8.1+ (rolldown ≥ 1.1).
    // manualChunks (object & function forms) is fully removed in rolldown 1.1.x;
    // use codeSplitting.groups with regex patterns instead.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react',  test: /node_modules[\\/](react|react-dom|react-router-dom)[\\/]/ },
            { name: 'vendor-charts', test: /node_modules[\\/](recharts|victory|d3)[\\/]/ },
            { name: 'vendor-pdf',    test: /node_modules[\\/](jspdf|html2canvas)[\\/]/ },
            { name: 'vendor-ocr',    test: /node_modules[\\/](tesseract\.js)[\\/]/ },
            { name: 'vendor-motion', test: /node_modules[\\/](framer-motion)[\\/]/ },
          ],
        },
      },
    },
  },
})
