export default defineNuxtPlugin(() => {
  const { initLocale } = useAppLocale()
  initLocale()
})