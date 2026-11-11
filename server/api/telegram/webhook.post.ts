import { botMessage } from '../../../shared/i18n/botMessages'
import { sendWebAppOpenMessage, TelegramBotApiError } from '../../utils/telegramBotApi'
import {
  resolveTelegramMiniAppUrl,
  syncTelegramMenuButtonForChat,
} from '../../utils/telegramMenuButton'

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

interface TelegramChatMemberUpdated {
  chat: TelegramChat
  from: TelegramUser
  new_chat_member: {
    status: string
    user: TelegramUser
  }
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  my_chat_member?: TelegramChatMemberUpdated
}

function isStartCommand(text: string | undefined): boolean {
  if (!text) return false
  const trimmed = text.trim()
  // /start or /start@BotName (+ optional payload)
  return /^\/start(?:@\w+)?(?:\s|$)/i.test(trimmed)
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  // Cloudflare Pages injects secrets at runtime — prefer env over build-time default
  const botToken =
    (config.telegramBotToken as string) || process.env.NUXT_TELEGRAM_BOT_TOKEN || ''
  const webhookSecret = (
    (config.telegramWebhookSecret as string) ||
    process.env.NUXT_TELEGRAM_WEBHOOK_SECRET ||
    ''
  ).trim()

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
  const webAppUrl = resolveTelegramMiniAppUrl(
    (config.telegramMiniAppUrl as string) || process.env.NUXT_TELEGRAM_MINI_APP_URL || '',
    getRequestURL(event).origin,
  )

  // Старт / разблокировка бота — сразу локализуем Menu Button
  const memberUpdate = update?.my_chat_member
  if (memberUpdate?.chat.type === 'private' && !memberUpdate.from.is_bot) {
    const status = memberUpdate.new_chat_member?.status
    if (status === 'member' || status === 'restricted') {
      const languageCode = memberUpdate.from.language_code ?? null
      const synced = await syncTelegramMenuButtonForChat({
        botToken,
        chatId: memberUpdate.chat.id,
        languageCode,
        webAppUrl,
      })
      if (!synced.ok) {
        console.error('[telegram/webhook] my_chat_member menu', synced.reason)
      }
    }
    return { ok: true }
  }

  const message = update?.message

  // Always 200 for unknown updates — Telegram retries on non-OK
  if (!message?.from || message.from.is_bot) {
    return { ok: true }
  }

  if (message.chat.type !== 'private') {
    return { ok: true }
  }

  const languageCode = message.from.language_code ?? null
  const openLabel = botMessage('open', languageCode)
  const startText = botMessage('start', languageCode)
  const isStart = isStartCommand(message.text)

  try {
    // Menu Button всегда по language_code клиента (не только на /start)
    const synced = await syncTelegramMenuButtonForChat({
      botToken,
      chatId: message.chat.id,
      languageCode,
      webAppUrl,
    })
    if (!synced.ok) {
      console.error('[telegram/webhook] menu', synced.reason)
    }
    if (isStart) {
      await sendWebAppOpenMessage({
        botToken,
        chatId: message.chat.id,
        text: startText,
        buttonText: openLabel,
        webAppUrl,
      })
    }
  } catch (err) {
    const detail = err instanceof TelegramBotApiError ? err.message : 'Webhook handler failed'
    console.error('[telegram/webhook]', detail)
    // Still 200 so Telegram does not hammer retries on transient UI failures
  }

  return { ok: true }
})
