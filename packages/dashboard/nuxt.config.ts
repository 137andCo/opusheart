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
        options: {
          // Opt-in dark mode only. Aura's default darkModeSelector is `system`,
          // which silently activates an undesigned/untested dark palette for any
          // visitor whose OS prefers dark. Pin it to a class that is never applied
          // until dark mode is actually designed, so the dashboard stays in its
          // intended (and tested) light theme.
          darkModeSelector: '.app-dark',
        },
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
