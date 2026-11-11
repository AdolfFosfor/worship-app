import {
  APP_LOCALE_OPTIONS,
  APP_LOCALE_STORAGE_KEY,
  APP_LOCALE_TG_KEY,
  isAppLocale,
  normalizeAppLocale,
  type AppLocale,
} from '~~/shared/i18n/locales'
import { localizeSessionTitle, translate } from '~~/shared/i18n/messages'
import { parseTelegramUserFromInitData } from '~/utils/telegram/readInitDataUser'

const DEFAULT_LOCALE: AppLocale = 'en'

function detectFromNavigator(): AppLocale | null {
  const candidates = [...(navigator.languages ?? []), navigator.language]
  for (const raw of candidates) {
    const match = normalizeAppLocale(raw)
    if (match) return match
  }
  return null
}

/** Актуальный language_code Telegram: сырой initData (URL) → сигнал SDK. */
function readTelegramLocale(): AppLocale | null {
  try {
    const telegram = useTelegramApp()
    if (!telegram.isTelegramEnvironment.value) return null

    const fromRaw = normalizeAppLocale(
      parseTelegramUserFromInitData(telegram.getInitDataRaw())?.language_code,
    )
    if (fromRaw) return fromRaw

    return normalizeAppLocale(telegram.user.value?.language_code)
  } catch {
    return null
  }
}

/**
 * Порядок:
 * 1) язык Telegram-клиента (всегда в TMA — кэш не перекрывает)
 * 2) сохранённый выбор — только вне Telegram
 * 3) язык системы → English
 */
function detectLocale(): AppLocale {
  if (!import.meta.client) return DEFAULT_LOCALE

  const fromTg = readTelegramLocale()
  if (fromTg) {
    try {
      localStorage.setItem(APP_LOCALE_TG_KEY, fromTg)
      localStorage.setItem(APP_LOCALE_STORAGE_KEY, fromTg)
    } catch {
      // ignore
    }
    return fromTg
  }

  const stored = localStorage.getItem(APP_LOCALE_STORAGE_KEY)
  if (isAppLocale(stored)) return stored

  return detectFromNavigator() ?? DEFAULT_LOCALE
}

function applyDocumentLang(locale: AppLocale) {
  if (!import.meta.client) return
  document.documentElement.lang = locale
}

/**
 * App UI language (ru / ro / en).
 * В Telegram всегда следует language_code клиента.
 */
export function useAppLocale() {
  const locale = useState<AppLocale>('app-locale', () => DEFAULT_LOCALE)
  const ready = useState('app-locale-ready', () => false)

  function setLocale(next: AppLocale) {
    if (!isAppLocale(next)) return
    locale.value = next
    if (import.meta.client) {
      try {
        localStorage.setItem(APP_LOCALE_STORAGE_KEY, next)
      } catch {
        // ignore
      }
      applyDocumentLang(next)
    }
  }

  /** Применить язык из Telegram / fallback. Можно вызывать повторно. */
  function syncLocaleFromTelegram() {
    if (!import.meta.client) return locale.value
    const next = detectLocale()
    if (next !== locale.value) {
      locale.value = next
      applyDocumentLang(next)
    } else {
      applyDocumentLang(next)
    }
    ready.value = true
    return next
  }

  function initLocale() {
    if (!import.meta.client) return
    syncLocaleFromTelegram()
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
    syncLocaleFromTelegram,
    t,
    sessionTitle,
  }
}
