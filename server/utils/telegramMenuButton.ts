import { botMessage } from '../../shared/i18n/botMessages'
import { setChatMenuButtonWebApp, TelegramBotApiError } from './telegramBotApi'

/**
 * Per-chat Menu Button по language_code.
 * Default (без chat_id) у Main Mini App через BotFather API не перебивается —
 * локализация только через chat_id.
 */
export async function syncTelegramMenuButtonForChat(params: {
  botToken: string
  chatId: number
  languageCode: string | null | undefined
  webAppUrl: string
}): Promise<{ ok: true; buttonText: string } | { ok: false; reason: string }> {
  const { botToken, chatId, languageCode, webAppUrl } = params
  const buttonText = botMessage('open', languageCode)

  try {
    await setChatMenuButtonWebApp({
      botToken,
      chatId,
      buttonText,
      webAppUrl,
    })
    return { ok: true, buttonText }
  } catch (err) {
    const reason = err instanceof TelegramBotApiError ? err.message : 'sync menu failed'
    return { ok: false, reason }
  }
}

export function resolveTelegramMiniAppUrl(
  configured: string | undefined | null,
  fallbackOrigin: string,
): string {
  const fromEnv = (configured || '').trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  return fallbackOrigin.replace(/\/$/, '')
}
