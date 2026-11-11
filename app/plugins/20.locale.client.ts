/**
 * В Mini App язык UI всегда = language_code Telegram (свежий initData).
 * Следим за сигналом user — на случай, если initData доезжает после первого тика.
 */
export default defineNuxtPlugin(() => {
  const { initLocale, syncLocaleFromTelegram } = useAppLocale()
  initLocale()

  const telegram = useTelegramApp()
  if (!telegram.isTelegramEnvironment.value) return

  watch(
    () => [
      telegram.user.value?.language_code,
      telegram.getInitDataRaw()?.slice(0, 64),
    ],
    () => {
      syncLocaleFromTelegram()
    },
    { flush: 'post' },
  )

  // Ещё раз после mount — initData/URL уже точно на месте
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => syncLocaleFromTelegram())
  }
})
