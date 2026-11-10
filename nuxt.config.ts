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
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Worship' },
        { property: 'og:title', content: 'Worship' },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: '/favicon.svg' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'Worship' },
        { name: 'twitter:image', content: '/favicon.svg' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'apple-touch-icon', href: '/favicon.svg' },
        { rel: 'mask-icon', href: '/favicon.svg', color: '#6420b7' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
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
      // Local browser mock only. Server also refuses mock/dev-session when NODE_ENV=production.
      allowTelegramDevMock: process.env.NUXT_PUBLIC_ALLOW_TELEGRAM_DEV_MOCK === 'true',
      // Bot username without @ — for t.me/?startapp= invite links (not secret)
      telegramBotUsername:
        process.env.NUXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'worship_team_helper_bot',
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
