/**
 * Один безопасный reload при битом чанке после деплоя.
 * Без этого (и при закэшированном HTML в Telegram) Nuxt может крутить reload бесконечно.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const KEY = 'worship:chunk-reload'

  nuxtApp.hook('app:chunkError', () => {
    let last = 0
    try {
      last = Number(sessionStorage.getItem(KEY) || 0)
    } catch {
      /* sessionStorage may be blocked in some WebViews */
    }

    const now = Date.now()
    // Не чаще одного раза в минуту на вкладку / WebView.
    if (last && now - last < 60_000) return

    try {
      sessionStorage.setItem(KEY, String(now))
    } catch {
      // ignore
    }

    reloadNuxtApp({
      persistState: true,
      ttl: 60_000,
    })
  })
})
