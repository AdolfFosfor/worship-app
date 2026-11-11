import type { AppLocale } from './locales'
import { normalizeAppLocale } from './locales'

/** Короткие строки бота (Menu Button ≤16 символов). */
const BOT_MESSAGES = {
  open: {
    ru: 'Открыть',
    ro: 'Deschide',
    en: 'Open',
  },
  start: {
    ru: 'Откройте приложение, чтобы работать с песнями и сет-листами команды.',
    ro: 'Deschideți aplicația pentru a lucra cu cântările și setlist-urile echipei.',
    en: "Open the app to manage your team's songs and setlists.",
  },
} as const satisfies Record<string, Record<AppLocale, string>>

export type BotMessageKey = keyof typeof BOT_MESSAGES

/** Пустой / неизвестный language_code Telegram → en (не язык устройства). */
export function resolveBotLocale(languageCode: string | null | undefined): AppLocale {
  return normalizeAppLocale(languageCode) ?? 'en'
}

export function botMessage(key: BotMessageKey, languageCode: string | null | undefined): string {
  const locale = resolveBotLocale(languageCode)
  return BOT_MESSAGES[key][locale]
}
