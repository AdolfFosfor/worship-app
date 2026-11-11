/**
 * В Mini App язык UI = language_code из свежего initData.
 * Синкаем при старте, после auth и при появлении user/initData.
 */
export default defineNuxtPlugin(() => {
  const { initLocale, syncLocaleFromTelegram } = useAppLocale()
  initLocale()

  const telegram = useTelegramApp()

  watch(
    () => [
      telegram.user.value?.language_code,
      telegram.getInitDataRaw()?.slice(0, 80),
      telegram.isTelegramEnvironment.value,
    ],
    () => {
      syncLocaleFromTelegram()
    },
    { flush: 'post' },
  )

  try {
    const auth = useAuthStore()
    watch(
      () => auth.user?.languageCode,
      () => {
        syncLocaleFromTelegram()
      },
    )
  } catch {
    // auth store may be unavailable in edge cases
  }

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => syncLocaleFromTelegram())
  }
  // Ещё один проход после auth plugin / гидрации
  setTimeout(() => syncLocaleFromTelegram(), 0)
})
