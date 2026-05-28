import Aura from '@primevue/themes/aura';

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-01-01',
  future: { compatibilityVersion: 4 },
  modules: ['@primevue/nuxt-module', '@pinia/nuxt'],
  primevue: {
    options: {
      theme: {
        preset: Aura,
      },
    },
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3020',
    },
  },
  css: ['primeicons/primeicons.css', '~/assets/css/layout.css'],
  devtools: { enabled: true },
  // i18n will be added in later phase
});
