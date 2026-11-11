import {
  APP_LOCALE_OPTIONS,
  APP_LOCALE_STORAGE_KEY,
  APP_LOCALE_TG_KEY,
  isAppLocale,
  normalizeAppLocale,
  type AppLocale,
} from '~~/shared/i18n/locales'
import { localizeSessionTitle, translate } from '~~/shared/i18n/messages'
import { readTelegramLocaleFromClient } from '~/utils/telegram/localeFromInitData'

const DEFAULT_LOCALE: AppLocale = 'en'

function detectFromNavigator(): AppLocale | null {
  const candidates = [...(navigator.languages ?? []), navigator.language]
  for (const raw of candidates) {
    const match = normalizeAppLocale(raw)
    if (match) return match
  }
  return null
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function readTelegramLocale(): AppLocale | null {
  return readTelegramLocaleFromClient()?.locale ?? null
}

function isTelegramClient(): boolean {
  try {
    const telegram = useTelegramApp()
    if (telegram.isTelegramEnvironment.value) return true
    return Boolean(telegram.getInitDataRaw())
  } catch {
    return false
  }
}

/**
 * Порядок:
 * 1) В Telegram: смена language_code (или первый снимок) → язык Telegram
 * 2) Сохранённый выбор в настройках (пока TG-язык тот же)
 * 3) Вне Telegram: настройки → система → en
 *
 * Navigator/система в Mini App не используются.
 */
function detectLocale(): AppLocale {
  if (!import.meta.client) return DEFAULT_LOCALE

  const fromTg = readTelegramLocale()
  const lastTg = readStorage(APP_LOCALE_TG_KEY)
  const stored = readStorage(APP_LOCALE_STORAGE_KEY)
  const inTelegram = isTelegramClient() || fromTg !== null

  if (fromTg) {
    // Первый снимок или реальная смена языка Telegram → всегда следуем TG
    if (!lastTg || fromTg !== lastTg) {
      writeStorage(APP_LOCALE_TG_KEY, fromTg)
      writeStorage(APP_LOCALE_STORAGE_KEY, fromTg)
      return fromTg
    }
    // TG не менялся — уважаем ручной выбор в настройках
    if (isAppLocale(stored)) return stored
    return fromTg
  }

  if (inTelegram) {
    // InitData есть/TMA, но locale не прочитали — не падаем в язык системы
    if (isAppLocale(stored)) return stored
    return DEFAULT_LOCALE
  }

  if (isAppLocale(stored)) return stored
  return detectFromNavigator() ?? DEFAULT_LOCALE
}

function applyDocumentLang(locale: AppLocale) {
  if (!import.meta.client) return
  document.documentElement.lang = locale
}

/**
 * App UI language (ru / ro / en).
 * Относительно языка Telegram-клиента; ручной выбор живёт, пока TG не сменится.
 */
export function useAppLocale() {
  const locale = useState<AppLocale>('app-locale', () => DEFAULT_LOCALE)
  const ready = useState('app-locale-ready', () => false)

  function setLocale(next: AppLocale) {
    if (!isAppLocale(next)) return
    locale.value = next
    if (import.meta.client) {
      writeStorage(APP_LOCALE_STORAGE_KEY, next)
      const fromTg = readTelegramLocale()
      if (fromTg) writeStorage(APP_LOCALE_TG_KEY, fromTg)
      applyDocumentLang(next)
    }
  }

  function syncLocaleFromTelegram() {
    if (!import.meta.client) return locale.value
    const next = detectLocale()
    locale.value = next
    applyDocumentLang(next)
    ready.value = true
    // Menu Button — строго по language_code Telegram, не по системному языку
    void syncTelegramMenuButton()
    return next
  }

  function initLocale() {
    if (!import.meta.client) return
    syncLocaleFromTelegram()
  }

  function t(key: string, vars?: Record<string, string | number>) {
    return translate(locale.value, key, vars)
  }

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

/** Per-chat Menu Button по language_code из initData. */
async function syncTelegramMenuButton() {
  if (!import.meta.client) return
  try {
    const telegram = useTelegramApp()
    if (!telegram.isTelegramEnvironment.value) return
    const initData = telegram.getInitDataRaw()?.trim()
    if (!initData) return

    const tg = readTelegramLocaleFromClient()
    const langKey = (tg?.languageCode || tg?.locale || 'en').toLowerCase()

    try {
      if (sessionStorage.getItem('worship-menu-synced-lang') === langKey) return
    } catch {
      // continue
    }

    const res = await $fetch<{ ok?: boolean }>('/api/telegram/sync-menu', {
      method: 'POST',
      body: { initData },
    })
    if (res?.ok === false) return
    try {
      sessionStorage.setItem('worship-menu-synced-lang', langKey)
    } catch {
      // ignore
    }
  } catch {
    // retry next open
  }
}
