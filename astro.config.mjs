// @ts-check
import { defineConfig } from 'astro/config';
import AstroPWA from "@vite-pwa/astro";
import spotlightjs from '@spotlightjs/astro';
import node from "@astrojs/node";
import playformCompress from '@playform/compress';
import playformInline from '@playform/inline';


// https://astro.build/config
export default defineConfig({
  build: {
    format: 'directory', // Ensures proper fallback support
  },
  integrations: [spotlightjs(), AstroPWA({
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
      additionalManifestEntries: [{ url: '/404.html', revision: null }],
      maximumFileSizeToCacheInBytes: 5000000,
      navigateFallback: '/404.html',
      globPatterns: ['**/*.{css,js,html,svg,png,ico,txt,webmanifest}'],
    },
    experimental: {
      directoryAndTrailingSlashHandler: true,
    }
  }), playformCompress(), playformInline()],
  adapter: node({
    mode: 'standalone'
  })
});