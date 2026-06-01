import Aura from '@primevue/themes/aura';
import { definePreset } from '@primevue/themes';

// "Sanctuary" brand: clay/terracotta primary, matching the public site default
// (packages/web/app/assets/css/main.css). The admin themes the public site from
// Settings; the dashboard carries the product brand, so its primary is fixed here.
const Sanctuary = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fbf1ed',
      100: '#f4dccf',
      200: '#e6b69f',
      300: '#d68f6f',
      400: '#c26f4e',
      500: '#a8502f',
      600: '#974730',
      700: '#7c3927',
      800: '#642f21',
      900: '#52281d',
      950: '#2e1510',
    },
  },
});

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-01-01',
  future: { compatibilityVersion: 4 },
  modules: ['@primevue/nuxt-module', '@pinia/nuxt'],
  primevue: {
    options: {
      theme: {
        preset: Sanctuary,
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
