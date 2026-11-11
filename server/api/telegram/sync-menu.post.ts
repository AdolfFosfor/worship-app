import { botMessage } from '../../../shared/i18n/botMessages'
import { isDevAuthAllowed } from '../../utils/devAuthGate'
import { setChatMenuButtonWebApp, TelegramBotApiError } from '../../utils/telegramBotApi'
import { validateTelegramInitData } from '../../utils/telegramAuth'

/**
 * Локализует Menu Button для чата пользователя по language_code из initData.
 * Вызывается при открытии Mini App (не только на /start).
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
  const webAppUrl = (
    (config.telegramMiniAppUrl as string) ||
    process.env.NUXT_TELEGRAM_MINI_APP_URL ||
    getRequestURL(event).origin
  )
    .trim()
    .replace(/\/$/, '')

  const buttonText = botMessage('open', validated.user.language_code)

  try {
    // В личке chat_id === user.id
    await setChatMenuButtonWebApp({
      botToken,
      chatId: validated.user.id,
      buttonText,
      webAppUrl,
    })
  } catch (err) {
    const detail = err instanceof TelegramBotApiError ? err.message : 'sync-menu failed'
    console.error('[telegram/sync-menu]', detail)
    throw createError({ statusCode: 502, statusMessage: 'Failed to update menu button' })
  }

  return {
    ok: true,
    buttonText,
    languageCode: validated.user.language_code ?? null,
  }
})
