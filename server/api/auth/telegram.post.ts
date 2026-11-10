import { isDevAuthAllowed } from '../../utils/devAuthGate'
import { createServiceClient } from '../../utils/supabase'
import {
  findOrCreateTelegramUser,
  upsertTelegramAccount,
} from '../../utils/telegramAccounts'
import { syncTelegramAvatar } from '../../utils/telegramAvatar'
import { validateTelegramInitData } from '../../utils/telegramAuth'
import { telegramPassword } from '../../utils/telegramPassword'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ initData?: string }>(event)
  const initData = body?.initData?.trim()
  if (!initData) {
    throw createError({ statusCode: 400, statusMessage: 'initData is required' })
  }

  const config = useRuntimeConfig()
  const botToken = config.telegramBotToken as string
  const allowDevMock = isDevAuthAllowed(config)

  if (!botToken && !allowDevMock) {
    throw createError({
      statusCode: 500,
      statusMessage: 'NUXT_TELEGRAM_BOT_TOKEN is not configured',
    })
  }

  const validated = validateTelegramInitData(initData, botToken || 'dev-token', {
    allowDevMock,
  })

  const supabase = createServiceClient()
  const password = telegramPassword(validated.user.id, botToken || 'dev-token')
  const metadata = {
    telegram_id: validated.user.id,
    first_name: validated.user.first_name,
    last_name: validated.user.last_name ?? null,
    username: validated.user.username ?? null,
    language_code: validated.user.language_code ?? null,
  }

  const user = await findOrCreateTelegramUser(supabase, {
    telegramId: validated.user.id,
    password,
    metadata,
  })

  await upsertTelegramAccount(supabase, validated.user.id, user.id)

  // photo_url из initData почти никогда нет — подтягиваем через Bot API → Storage
  if (botToken) {
    try {
      await syncTelegramAvatar(supabase, {
        botToken,
        telegramId: validated.user.id,
        userId: user.id,
        initPhotoUrl: validated.user.photo_url,
      })
    } catch (e) {
      console.error('[avatar] sync failed', e)
    }
  }

  const email = user.email
  if (!email) {
    throw createError({ statusCode: 500, statusMessage: 'User has no email' })
  }

  const signIn = await supabase.auth.signInWithPassword({ email, password })
  if (signIn.error || !signIn.data.session) {
    throw createError({
      statusCode: 401,
      statusMessage: signIn.error?.message ?? 'Failed to create session',
    })
  }

  return {
    access_token: signIn.data.session.access_token,
    refresh_token: signIn.data.session.refresh_token,
    user: signIn.data.user,
  }
})
