// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'
import { localeRu } from './app/theme/localeRu'
import { PremiumPreset } from './app/theme/premium'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  ssr: false,

  nitro: {
    preset: 'cloudflare_pages',
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },
  },

  // Early paint fallbacks (critical boot also injected via server/plugins/html-boot-theme.ts)
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Worship',
      meta: [
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no, interactive-widget=overlays-content',
        },
        { name: 'theme-color', content: '#efeff4' },
        { name: 'color-scheme', content: 'light dark' },
      ],
    },
  },

  modules: ['@primevue/nuxt-module', '@pinia/nuxt', '@vueuse/nuxt', '@nuxt/eslint'],

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        '@iconify/vue',
        '@supabase/supabase-js',
        '@tma.js/sdk-vue',
        '@vue/devtools-core',
      ],
    },
    server: {
      // Cloudflare quick tunnels use rotating *.trycloudflare.com hosts
      allowedHosts: ['.trycloudflare.com'],
    },
  },

  runtimeConfig: {
    supabaseServiceRoleKey: process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY || '',
    telegramBotToken: process.env.NUXT_TELEGRAM_BOT_TOKEN || '',
    public: {
      supabaseUrl:
        process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
      supabaseAnonKey:
        process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY ||
        '',
      // Explicit opt-in only — production Cloudflare must not enable this by default
      allowTelegramDevMock: process.env.NUXT_PUBLIC_ALLOW_TELEGRAM_DEV_MOCK === 'true',
    },
  },

  primevue: {
    options: {
      ripple: true,
      locale: localeRu,
      theme: {
        preset: PremiumPreset,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: false,
        },
      },
    },
  },
})
