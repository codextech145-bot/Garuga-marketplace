import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json' with { type: 'json' }

const buildVersion = `${packageJson.version}-${Date.now()}`

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion)
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      cleanupOutdatedCaches: true,
      injectRegister: false,
      manifestFilename: 'manifest.json',
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        importScripts: ['/push-sw.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest}'],
        navigateFallbackDenylist: [/^\/__/]
      },
      manifest: {
        name: 'Garuga Marketplace',
        short_name: 'Garuga',
        description: 'Buy and sell items in Uganda - Electronics, Clothing, Food, Vehicles and more',
        start_url: '/',
        display: 'standalone',
        theme_color: '#f97316',
        background_color: '#0b0b0b',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    }),
    {
      name: 'garuga-build-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ version: buildVersion }, null, 2)
        })
      }
    }
  ],
  server: {
    port: 5173
  }
})
