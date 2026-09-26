// @ts-check
import { defineConfig } from 'astro/config';
import AstroPWA from "@vite-pwa/astro";
import spotlightjs from '@spotlightjs/astro';
import node from "@astrojs/node";
import playformCompress from '@playform/compress';
import playformInline from '@playform/inline';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';


// https://astro.build/config
export default defineConfig({
  server: {
    port: 7777,
    host: true
  },
  build: {
    format: 'directory', // Ensures proper fallback support
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [react(), spotlightjs(), AstroPWA({
    mode: 'production',
    includeAssets: ['favicon.svg'],
    registerType: 'autoUpdate',
    manifest: {
      id: 'mandolinbalaji',
      name: 'Mandolin Balaji',
      short_name: 'Mandolin Balaji',
      theme_color: '#ffffff',
      screenshots: [
        {
          "src": "/screenshots/desktop.png",
          "sizes": "1280x720",
          "type": "image/png",
          "form_factor": "wide"
        },
        {
          "src": "/screenshots/mobile.png",
          "sizes": "750x1334",
          "type": "image/png"
        }
      ],
      icons: [
        {
          src: 'pwa-64x64.png',
          sizes: '64x64',
          type: 'image/png',
        },
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        }
      ],
    },
    workbox: {
      maximumFileSizeToCacheInBytes: 5000000,
      // No navigateFallback: serving 404.html for every uncached navigation
      // made the homepage (and new/SSR pages) show "Reload" for returning visitors.
      navigateFallback: null,
      // Pages are fetched from the network first so users always get fresh HTML;
      // the cache is only used when offline.
      globPatterns: ['**/*.{css,js,svg,png,ico,txt,webmanifest}'],
      runtimeCaching: [{
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 50 },
        },
      }],
      cleanupOutdatedCaches: true,
      skipWaiting: true,
      clientsClaim: true,
    },
    experimental: {
      directoryAndTrailingSlashHandler: true,
    }
  }), playformCompress(), playformInline()],
  adapter: node({
    mode: 'standalone'
  })
});