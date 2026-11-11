import {
  APP_LOCALE_OPTIONS,
  APP_LOCALE_STORAGE_KEY,
  APP_LOCALE_TG_KEY,
  isAppLocale,
  normalizeAppLocale,
  type AppLocale,
} from '~~/shared/i18n/locales'
import { localizeSessionTitle, translate } from '~~/shared/i18n/messages'
import {
  isDevMockInitData,
  parseTelegramUserFromInitData,
  readTelegramWebAppLanguageCode,
} from '~/utils/telegram/readInitDataUser'

const DEFAULT_LOCALE: AppLocale = 'en'

function detectFromNavigator(): AppLocale | null {
  const candidates = [...(navigator.languages ?? []), navigator.language]
  for (const raw of candidates) {
    const match = normalizeAppLocale(raw)
    if (match) return match
  }
  return null
}

/**
 * Актуальный язык Telegram-клиента.
 * Не завязан только на isTelegramEnvironment — берём любой не-mock initData.
 */
function readTelegramLocale(): AppLocale | null {
  if (!import.meta.client) return null

  const codes: Array<string | null | undefined> = []

  try {
    const telegram = useTelegramApp()
    const raw = telegram.getInitDataRaw()
    if (raw && !isDevMockInitData(raw)) {
      codes.push(parseTelegramUserFromInitData(raw)?.language_code)
    }
    if (telegram.isTelegramEnvironment.value) {
      codes.push(telegram.user.value?.language_code)
    }
  } catch {
    // ignore
  }

  codes.push(readTelegramWebAppLanguageCode())

  try {
    const auth = useAuthStore()
    const fromAuth = auth.user?.languageCode
    // Метаданные сессии — только как доп. источник, если есть признаки TMA
    if (fromAuth && codes.some(Boolean)) {
      codes.push(fromAuth)
    }
  } catch {
    // pinia / auth ещё не готовы
  }

  for (const code of codes) {
    const locale = normalizeAppLocale(code)
    if (locale) return locale
  }
  return null
}

/**
 * Порядок:
 * 1) язык Telegram-клиента из initData (всегда перекрывает кэш)
 * 2) сохранённый выбор — только без Telegram initData
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
 * В Telegram всегда следует language_code из initData.
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
    locale.value = next
    applyDocumentLang(next)
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
