import { primeLocaleFor } from '~/theme/primeLocales'

export default defineNuxtPlugin(() => {
  const { locale } = useAppLocale()
  const primevue = usePrimeVue()

  function apply() {
    primevue.config.locale = {
      ...primevue.config.locale,
      ...primeLocaleFor(locale.value),
    }
  }

  apply()
  watch(locale, apply)
})
