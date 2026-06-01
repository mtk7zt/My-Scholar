import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: [
      // Force zustand to use its CJS build — avoids Rollup ESM parse issues
      {
        find: /^zustand$/,
        replacement: resolve(__dirname, 'node_modules/zustand/index.js'),
      },
      {
        find: /^zustand\/(.+)$/,
        replacement: resolve(__dirname, 'node_modules/zustand/$1.js'),
      },
      // Force xlsx to use its CJS build
      {
        find: /^xlsx$/,
        replacement: resolve(__dirname, 'node_modules/xlsx/xlsx.js'),
      },
    ],
  },
  optimizeDeps: {
    include: ['mammoth', 'jszip'],
    exclude: ['pdfjs-dist'],
  },
  assetsInclude: ['**/*.mjs'],
  build: {
    outDir: 'dist',
    sourcemap: false,
    commonjsOptions: {
      transformMixedEsModules: true,
      requireReturnsDefault: 'preferred',
    },
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
