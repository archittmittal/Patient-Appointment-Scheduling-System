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
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('jspdf')) {
              return 'vendor-pdf';
            }
            if (id.includes('tesseract.js')) {
              return 'vendor-ocr';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
          }
        },
      },
    },
  },
})
