import { readTelegramLocaleFromClient } from '~/utils/telegram/localeFromInitData'

const SYNCED_KEY = 'worship-menu-synced-lang'

/**
 * Menu Button всегда по language_code Telegram (initData), не по языку системы.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const { isTelegramEnvironment, getInitDataRaw, user } = useTelegramApp()
  if (!isTelegramEnvironment.value) return

  async function syncMenu() {
    const initData = getInitDataRaw()?.trim()
    if (!initData) return

    const tg = readTelegramLocaleFromClient()
    const lang = (
      tg?.languageCode ||
      user.value?.language_code ||
      tg?.locale ||
      'en'
    ).toLowerCase()

    try {
      if (sessionStorage.getItem(SYNCED_KEY) === lang) return
    } catch {
      // continue without dedupe
    }

    try {
      const res = await $fetch<{ ok?: boolean }>('/api/telegram/sync-menu', {
        method: 'POST',
        body: { initData },
      })
      if (res?.ok === false) return
      try {
        sessionStorage.setItem(SYNCED_KEY, lang)
      } catch {
        // ignore
      }
    } catch {
      // retry next open / PTR
    }
  }

  void syncMenu()

  watch(
    () => user.value?.language_code,
    (next, prev) => {
      if (!next || next === prev) return
      try {
        sessionStorage.removeItem(SYNCED_KEY)
      } catch {
        // ignore
      }
      void syncMenu()
    },
  )
})
