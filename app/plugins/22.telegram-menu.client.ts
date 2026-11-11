const SYNCED_KEY = 'worship-menu-synced-lang'

/**
 * При открытии Mini App синхронизирует Menu Button с language_code клиента.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const { isTelegramEnvironment, getInitDataRaw, user } = useTelegramApp()
  if (!isTelegramEnvironment.value) return

  const initData = getInitDataRaw()?.trim()
  if (!initData) return

  const lang = (user.value?.language_code || 'en').toLowerCase()

  // Один раз на language_code за сессию WebView (sessionStorage переживает PTR)
  try {
    if (sessionStorage.getItem(SYNCED_KEY) === lang) return
    sessionStorage.setItem(SYNCED_KEY, lang)
  } catch {
    // continue without dedupe
  }

  void $fetch('/api/telegram/sync-menu', {
    method: 'POST',
    body: { initData },
  }).catch(() => {
    try {
      if (sessionStorage.getItem(SYNCED_KEY) === lang) {
        sessionStorage.removeItem(SYNCED_KEY)
      }
    } catch {
      // ignore
    }
  })
})
