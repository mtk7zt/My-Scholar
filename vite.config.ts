import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(process.env.COMMIT_REF || process.env.VITE_BUILD_ID || 'local-development'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'theme-init.js'],
      workbox: {
        // Precache only versioned application-shell assets produced by Vite.
        // Gemini requests, uploaded documents, and user data are never cached.
        globPatterns: ['**/*.{html,js,css,mjs,svg,png,ico,woff2}'],
        globIgnores: ['tesseract/**', 'tessdata/**', '**/*.map'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'My Scholar',
        short_name: 'My Scholar',
        description: 'AI-powered learning and research assistant',
        id: '/',
        start_url: '/',
        scope: '/',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
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
    ],
  },
  optimizeDeps: {
    include: ['mammoth', 'jszip'],
    exclude: ['pdfjs-dist'],
  },
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
          if (id.includes('mammoth') || id.includes('exceljs') || id.includes('jszip')) {
            return 'office';
          }
        },
      },
    },
    chunkSizeWarningLimit: 3000,
  },
})
