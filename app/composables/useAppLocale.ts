import {
  APP_LOCALE_OPTIONS,
  APP_LOCALE_STORAGE_KEY,
  APP_LOCALE_TG_KEY,
  isAppLocale,
  normalizeAppLocale,
  type AppLocale,
} from '~~/shared/i18n/locales'
import { localizeSessionTitle, translate } from '~~/shared/i18n/messages'

const DEFAULT_LOCALE: AppLocale = 'en'

function detectFromNavigator(): AppLocale | null {
  const candidates = [...(navigator.languages ?? []), navigator.language]
  for (const raw of candidates) {
    const match = normalizeAppLocale(raw)
    if (match) return match
  }
  return null
}

function readTelegramLocale(): AppLocale | null {
  try {
    const telegram = useTelegramApp()
    return normalizeAppLocale(telegram.user.value?.language_code)
  } catch {
    return null
  }
}

/**
 * Порядок:
 * 1) язык Telegram-клиента, если он сменился с прошлого захода
 * 2) сохранённый выбор (ручной / прошлый TG)
 * 3) язык системы → English
 *
 * Если зашли из Telegram с другим language_code — UI переключается на него.
 */
function detectLocale(): AppLocale {
  if (!import.meta.client) return DEFAULT_LOCALE

  const fromTg = readTelegramLocale()
  if (fromTg) {
    const lastTg = localStorage.getItem(APP_LOCALE_TG_KEY)
    if (lastTg !== fromTg) {
      localStorage.setItem(APP_LOCALE_TG_KEY, fromTg)
      localStorage.setItem(APP_LOCALE_STORAGE_KEY, fromTg)
      return fromTg
    }
  }

  const stored = localStorage.getItem(APP_LOCALE_STORAGE_KEY)
  if (isAppLocale(stored)) return stored

  if (fromTg) {
    localStorage.setItem(APP_LOCALE_TG_KEY, fromTg)
    localStorage.setItem(APP_LOCALE_STORAGE_KEY, fromTg)
    return fromTg
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

  /** Локализует шаблон названия сессии (не названия песен). */
  function sessionTitle(title: string) {
    return localizeSessionTitle(title, locale.value)
  }

  return {
    locale,
    ready,
    localeOptions: APP_LOCALE_OPTIONS,
    setLocale,
    initLocale,
    t,
    sessionTitle,
  }
}
