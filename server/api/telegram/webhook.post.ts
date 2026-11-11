import { botMessage } from '../../../shared/i18n/botMessages'
import {
  sendWebAppOpenMessage,
  setChatMenuButtonWebApp,
  TelegramBotApiError,
} from '../../utils/telegramBotApi'

interface TelegramUser {
  id: number
  language_code?: string
  is_bot?: boolean
}

interface TelegramChat {
  id: number
  type: string
}

interface TelegramMessage {
  message_id: number
  text?: string
  from?: TelegramUser
  chat: TelegramChat
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

function isStartCommand(text: string | undefined): boolean {
  if (!text) return false
  const trimmed = text.trim()
  // /start or /start@BotName (+ optional payload)
  return /^\/start(?:@\w+)?(?:\s|$)/i.test(trimmed)
}

function resolveMiniAppUrl(event: Parameters<typeof getRequestURL>[0], configured: string): string {
  const fromEnv = configured.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  const url = getRequestURL(event)
  return url.origin
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const botToken = config.telegramBotToken as string
  const webhookSecret = (config.telegramWebhookSecret as string | undefined)?.trim() || ''

  if (webhookSecret) {
    const header = getHeader(event, 'x-telegram-bot-api-secret-token')
    if (header !== webhookSecret) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid webhook secret' })
    }
  }

  if (!botToken || botToken === 'dev-token') {
    throw createError({ statusCode: 503, statusMessage: 'Bot token is not configured' })
  }

  const update = await readBody<TelegramUpdate>(event)
  const message = update?.message

  // Always 200 for unknown updates — Telegram retries on non-OK
  if (!message?.from || message.from.is_bot) {
    return { ok: true }
  }

  if (message.chat.type !== 'private' || !isStartCommand(message.text)) {
    return { ok: true }
  }

  const languageCode = message.from.language_code ?? null
  const openLabel = botMessage('open', languageCode)
  const startText = botMessage('start', languageCode)
  const webAppUrl = resolveMiniAppUrl(event, (config.telegramMiniAppUrl as string) || '')

  try {
    await setChatMenuButtonWebApp({
      botToken,
      chatId: message.chat.id,
      buttonText: openLabel,
      webAppUrl,
    })
    await sendWebAppOpenMessage({
      botToken,
      chatId: message.chat.id,
      text: startText,
      buttonText: openLabel,
      webAppUrl,
    })
  } catch (err) {
    const detail = err instanceof TelegramBotApiError ? err.message : 'Webhook handler failed'
    console.error('[telegram/webhook]', detail)
    // Still 200 so Telegram does not hammer retries on transient UI failures
  }

  return { ok: true }
})
