import { normalizeAppLocale, type AppLocale } from '~~/shared/i18n/locales'
import {
  isDevMockInitData,
  parseTelegramUserFromInitData,
  readTelegramWebAppLanguageCode,
} from '~/utils/telegram/readInitDataUser'

/**
 * Язык UI/бота из Telegram initData.
 * Не использует navigator/систему.
 *
 * Пустой language_code у пользователя Telegram часто = English.
 * Неподдерживаемые IETF (de, uk…) → en (наш fallback среди ru/ro/en).
 */
export function resolveTelegramUiLocale(
  languageCode: string | null | undefined,
): AppLocale {
  return normalizeAppLocale(languageCode) ?? 'en'
}

/** Сырой language_code + готовая app-locale из актуального initData. */
export function readTelegramLocaleFromClient(): {
  languageCode: string | null
  locale: AppLocale
  hasUser: boolean
} | null {
  if (!import.meta.client) return null

  let languageCode: string | null = null
  let hasUser = false

  try {
    const telegram = useTelegramApp()
    const raw = telegram.getInitDataRaw()
    if (raw && !isDevMockInitData(raw)) {
      const user = parseTelegramUserFromInitData(raw)
      if (user?.id) {
        hasUser = true
        if (user.language_code?.trim()) languageCode = user.language_code.trim()
      }
    }
    if (!languageCode && telegram.isTelegramEnvironment.value) {
      const code = telegram.user.value?.language_code
      if (telegram.user.value?.id) hasUser = true
      if (code?.trim()) languageCode = code.trim()
    }
  } catch {
    // ignore
  }

  if (!languageCode) {
    const fromWebApp = readTelegramWebAppLanguageCode()
    if (fromWebApp?.trim()) {
      languageCode = fromWebApp.trim()
      hasUser = true
    }
  }

  if (!hasUser && !languageCode) return null

  return {
    languageCode,
    locale: resolveTelegramUiLocale(languageCode),
    hasUser: hasUser || Boolean(languageCode),
  }
}
