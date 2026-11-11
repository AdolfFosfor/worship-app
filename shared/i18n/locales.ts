export const APP_LOCALES = ['ru', 'ro', 'en'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const APP_LOCALE_STORAGE_KEY = 'worship-locale'

/** Последний language_code Telegram — если клиент сменил язык, UI тоже переключаем. */
export const APP_LOCALE_TG_KEY = 'worship-locale-tg'

/** Native labels — always shown in their own language in the picker. */
export const APP_LOCALE_OPTIONS: { value: AppLocale; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'ro', label: 'Română' },
  { value: 'en', label: 'English' },
]

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'ru' || value === 'ro' || value === 'en'
}

export function normalizeAppLocale(raw: string | null | undefined): AppLocale | null {
  if (!raw) return null
  const base = raw.trim().toLowerCase().split('-')[0]
  return isAppLocale(base) ? base : null
}
