import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'autoinv',
        short_name: 'autoinv',
        description: 'Gestión de facturas y gastos para autónomos',
        lang: 'es',
        theme_color: '#0E1014',
        background_color: '#0E1014',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Listeners de push/notificationclick. Se importan en el SW generado
        // para no tener que pasar toda la PWA a injectManifest.
        // Ruta absoluta a propósito: relativa depende del scope del SW.
        importScripts: ['/push-sw.js'],
        // Un service worker antiguo sirve su index.html cacheado, que apunta a
        // ficheros JS con hash que ya no existen tras el redespliegue → pantalla
        // en blanco. Estas tres opciones hacen que el SW nuevo tome el control
        // de inmediato y borre las cachés viejas en vez de esperar a que se
        // cierren todas las pestañas.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache' },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,   // accesible desde la red local (móvil vía WiFi)
    port: 5173,
  },
})
