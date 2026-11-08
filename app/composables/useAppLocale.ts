import {
  APP_LOCALE_OPTIONS,
  APP_LOCALE_STORAGE_KEY,
  isAppLocale,
  normalizeAppLocale,
  type AppLocale,
} from '~~/shared/i18n/locales'
import { translate } from '~~/shared/i18n/messages'

const DEFAULT_LOCALE: AppLocale = 'en'

function detectFromNavigator(): AppLocale | null {
  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ]
  for (const raw of candidates) {
    const match = normalizeAppLocale(raw)
    if (match) return match
  }
  return null
}

/**
 * Порядок: сохранённый выбор → Telegram → язык системы → English.
 */
function detectLocale(): AppLocale {
  if (!import.meta.client) return DEFAULT_LOCALE

  const stored = localStorage.getItem(APP_LOCALE_STORAGE_KEY)
  if (isAppLocale(stored)) return stored

  try {
    const telegram = useTelegramApp()
    const fromTg = normalizeAppLocale(telegram.user.value?.language_code)
    if (fromTg) return fromTg
  } catch {
    // Telegram SDK may be unavailable during early boot.
  }

  return detectFromNavigator() ?? DEFAULT_LOCALE
}

function applyDocumentLang(locale: AppLocale) {
  if (!import.meta.client) return
  document.documentElement.lang = locale
}

/**
 * App UI language (ru / ro / en). Persisted in localStorage.
 */
export function useAppLocale() {
  const locale = useState<AppLocale>('app-locale', () => DEFAULT_LOCALE)
  const ready = useState('app-locale-ready', () => false)

  function setLocale(next: AppLocale) {
    if (!isAppLocale(next)) return
    locale.value = next
    if (import.meta.client) {
      localStorage.setItem(APP_LOCALE_STORAGE_KEY, next)
      applyDocumentLang(next)
    }
  }

  function initLocale() {
    if (!import.meta.client || ready.value) return
    const next = detectLocale()
    locale.value = next
    applyDocumentLang(next)
    ready.value = true
  }

  function t(key: string, vars?: Record<string, string | number>) {
    return translate(locale.value, key, vars)
  }

  return {
    locale,
    ready,
    localeOptions: APP_LOCALE_OPTIONS,
    setLocale,
    initLocale,
    t,
  }
}
