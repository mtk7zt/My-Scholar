import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    // Copy the pdf.js worker from node_modules into /dist at build time.
    // This eliminates the CDN fetch on every upload (Fix #1).
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          dest: 'assets',
        },
      ],
    }),
  ],
  optimizeDeps: {
    include: ['pdfjs-dist', 'mammoth', 'xlsx', 'jszip'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('react-syntax-highlighter')) {
            return 'markdown';
          }
          if (id.includes('pdfjs-dist')) {
            return 'pdf';
          }
          if (id.includes('mammoth') || id.includes('xlsx') || id.includes('jszip')) {
            return 'office';
          }
        },
      },
    },
    chunkSizeWarningLimit: 3000,
  },
})
