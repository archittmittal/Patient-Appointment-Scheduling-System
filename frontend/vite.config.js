import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcoords from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcoords()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendor libraries into separate chunks so they are loaded
        // on demand alongside the lazy-loaded route pages that use them.
        manualChunks: {
          'vendor-react':     ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts':    ['recharts'],
          'vendor-pdf':       ['jspdf'],
          'vendor-ocr':       ['tesseract.js'],
          'vendor-motion':    ['framer-motion'],
        },
      },
    },
  },
})
