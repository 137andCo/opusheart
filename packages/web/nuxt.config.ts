export default defineNuxtConfig({
  future: { compatibilityVersion: 4 },
  ssr: true,
  devtools: { enabled: true },
  modules: ['@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      // Must match the server's default port (3020). Override in production with
      // NUXT_PUBLIC_API_BASE. (Was :3000, which is dead on a fresh clone.)
      apiBase: 'http://localhost:3020/api',
    },
  },
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      htmlAttrs: { lang: 'en' },
    },
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'OpusHeart',
      short_name: 'OpusHeart',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#4f46e5',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      navigateFallback: undefined, // SSR mode, no SPA fallback
      runtimeCaching: [
        {
          urlPattern: /^https?:\/\/.*\/api\/resources\/public/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'resources-cache',
            expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
          },
        },
        {
          urlPattern: /^https?:\/\/.*\/api\/events\/public/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'events-cache',
            expiration: { maxEntries: 30, maxAgeSeconds: 1800 },
          },
        },
        {
          urlPattern: /^https?:\/\/.*\/api\/sermons\/public/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'sermons-cache',
            expiration: { maxEntries: 50, maxAgeSeconds: 7200 },
          },
        },
      ],
    },
  },
  compatibilityDate: '2026-03-06',
});
