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

  try {
    if (sessionStorage.getItem(SYNCED_KEY) === lang) return
  } catch {
    // continue without dedupe
  }

  void $fetch<{ ok?: boolean }>('/api/telegram/sync-menu', {
    method: 'POST',
    body: { initData },
  })
    .then((res) => {
      if (res?.ok === false) return
      try {
        sessionStorage.setItem(SYNCED_KEY, lang)
      } catch {
        // ignore
      }
    })
    .catch(() => {
      // retry next open / PTR
    })
})
