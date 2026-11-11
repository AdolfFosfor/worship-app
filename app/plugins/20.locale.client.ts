/**
 * Синк локали: смена language_code Telegram → новый UI-язык;
 * иначе сохраняется выбор из настроек.
 */
export default defineNuxtPlugin(() => {
  const { initLocale, syncLocaleFromTelegram } = useAppLocale()
  initLocale()

  const telegram = useTelegramApp()

  watch(
    () => telegram.user.value?.language_code,
    () => {
      syncLocaleFromTelegram()
    },
    { flush: 'post' },
  )

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => syncLocaleFromTelegram())
  }
})
