import type { RouterConfig } from '@nuxt/schema'

/**
 * Telegram passes launch parameters in the URL hash.
 * HTML5 history mode keeps the hash intact for the TMA SDK.
 * Скролл восстанавливаем вручную (layout main + useShellScrollMemory) —
 * Nuxt не должен прыгать наверх при back / KeepAlive.
 * @see https://docs.telegram-mini-apps.com/packages/tma-js-sdk-vue
 */
export default {
  scrollBehavior() {
    return false
  },
} satisfies RouterConfig
