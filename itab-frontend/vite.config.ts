import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'generateSW' lets the plugin fully manage the service worker
      // — simpler, no Rolldown compatibility issues
      strategies: 'generateSW',
      registerType: 'autoUpdate',

      // Don't auto-inject manifest link — we handle it in index.html
      manifest: false,

      workbox: {
        // Cache all app shell assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // Network-first for API, cache-first for static assets
        runtimeCaching: [
          {
            // Google Maps tiles — cache for 7 days
            urlPattern: /^https:\/\/maps\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-maps-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Unsplash images (property photos)
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'property-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // API calls — NetworkFirst with offline fallback
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Fallback to index.html for SPA navigation
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],

        // Skip waiting so updates apply immediately
        skipWaiting: true,
        clientsClaim: true,
      },

      devOptions: {
        // Disabled in dev — prevents stale SW cache from blocking UI changes
        enabled: false,
        type: 'module',
        navigateFallback: 'index.html',
      },

      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icons/*.png',
        'icons/*.svg',
      ],
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor';
            if (id.includes('framer-motion') || id.includes('lucide-react')) return 'ui';
            if (id.includes('@react-google-maps') || id.includes('google-maps')) return 'map';
            if (id.includes('@tanstack') || id.includes('axios')) return 'query';
            if (id.includes('react-hook-form') || id.includes('zod')) return 'forms';
            if (id.includes('zustand')) return 'store';
          }
        },
      },
    },
  },
})
