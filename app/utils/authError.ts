import {
  APP_LOCALE_STORAGE_KEY,
  isAppLocale,
  type AppLocale,
} from '~~/shared/i18n/locales'
import { translate } from '~~/shared/i18n/messages'

function currentLocale(): AppLocale {
  if (!import.meta.client) return 'en'
  try {
    const stored = localStorage.getItem(APP_LOCALE_STORAGE_KEY)
    if (isAppLocale(stored)) return stored
  } catch {
    // private mode
  }
  const lang = document.documentElement.lang
  return isAppLocale(lang) ? lang : 'en'
}

/** Human-readable auth / API error for toasts. */
export function authErrorMessage(error: unknown, fallbackKey = 'common.error'): string {
  const locale = currentLocale()
  const fallback = translate(locale, fallbackKey)

  if (!error) return fallback

  if (typeof error === 'string' && error.trim()) return error

  if (error instanceof Error) {
    const msg = error.message || fallback
    if (/rate.?limit/i.test(msg) || /over_email_send_rate_limit/i.test(msg)) {
      return translate(locale, 'auth.rateLimit')
    }
    return msg
  }

  if (typeof error === 'object') {
    const obj = error as {
      message?: string
      statusMessage?: string
      data?: { message?: string; statusMessage?: string; code?: string }
      code?: string
    }
    const raw =
      obj.data?.statusMessage ||
      obj.data?.message ||
      obj.statusMessage ||
      obj.message ||
      fallback
    if (obj.code === 'over_email_send_rate_limit' || /rate.?limit/i.test(raw)) {
      return translate(locale, 'auth.rateLimit')
    }
    return raw
  }

  return fallback
}
