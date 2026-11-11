import { isDevAuthAllowed } from '../../utils/devAuthGate'
import {
  resolveTelegramMiniAppUrl,
  syncTelegramMenuButtonForChat,
} from '../../utils/telegramMenuButton'
import { validateTelegramInitData } from '../../utils/telegramAuth'

/**
 * Локализует Menu Button для чата пользователя по language_code из initData.
 * Вызывается при открытии Mini App (не только на /start).
 * Soft-fail: без чата с ботом Telegram отвечает "chat not found" — не 502.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ initData?: string }>(event)
  const initData = body?.initData?.trim()
  if (!initData) {
    throw createError({ statusCode: 400, statusMessage: 'initData is required' })
  }

  const config = useRuntimeConfig()
  const botToken =
    (config.telegramBotToken as string) || process.env.NUXT_TELEGRAM_BOT_TOKEN || ''
  const allowDevMock = isDevAuthAllowed(config)

  if (!botToken || botToken === 'dev-token') {
    if (allowDevMock) return { ok: true, skipped: true }
    throw createError({ statusCode: 503, statusMessage: 'Bot token is not configured' })
  }

  const validated = validateTelegramInitData(initData, botToken, { allowDevMock })
  const webAppUrl = resolveTelegramMiniAppUrl(
    (config.telegramMiniAppUrl as string) || process.env.NUXT_TELEGRAM_MINI_APP_URL || '',
    getRequestURL(event).origin,
  )

  // В личке chat_id === user.id
  const synced = await syncTelegramMenuButtonForChat({
    botToken,
    chatId: validated.user.id,
    languageCode: validated.user.language_code,
    webAppUrl,
  })

  if (!synced.ok) {
    console.error('[telegram/sync-menu]', synced.reason)
    return {
      ok: false,
      reason: synced.reason,
      languageCode: validated.user.language_code ?? null,
    }
  }

  return {
    ok: true,
    buttonText: synced.buttonText,
    languageCode: validated.user.language_code ?? null,
  }
})
