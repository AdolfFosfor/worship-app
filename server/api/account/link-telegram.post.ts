import { requireAuthUser } from '../../utils/authUser'
import { isDevAuthAllowed } from '../../utils/devAuthGate'
import {
  findUserIdByTelegramId,
  isSyntheticTelegramEmail,
  mergeAuthUserInto,
  upsertTelegramAccount,
} from '../../utils/telegramAccounts'
import { syncTelegramAvatar } from '../../utils/telegramAvatar'
import { telegramEmail, validateTelegramInitData } from '../../utils/telegramAuth'
import { telegramPassword } from '../../utils/telegramPassword'

export default defineEventHandler(async (event) => {
  const { user, supabase } = await requireAuthUser(event)
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

  const telegramId = validated.user.id
  const password = telegramPassword(telegramId, botToken || 'dev-token')
  const metadata = {
    telegram_id: telegramId,
    first_name: validated.user.first_name,
    last_name: validated.user.last_name ?? null,
    username: validated.user.username ?? null,
    language_code: validated.user.language_code ?? null,
  }

  const mappedUserId = await findUserIdByTelegramId(supabase, telegramId)
  if (mappedUserId && mappedUserId !== user.id) {
    // Orphan / previous TG user owns this telegram_id — merge into current (email) account
    await mergeAuthUserInto(supabase, mappedUserId, user.id)
  } else {
    // Also check classic synthetic email user without mapping row
    const { data: listed } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const synthetic = listed.users.find((u) => u.email === telegramEmail(telegramId))
    if (synthetic && synthetic.id !== user.id) {
      await mergeAuthUserInto(supabase, synthetic.id, user.id)
    }
  }

  const { data: updated, error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: {
      ...user.user_metadata,
      ...metadata,
    },
  })
  if (error || !updated.user) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Failed to link Telegram',
    })
  }

  await upsertTelegramAccount(supabase, telegramId, user.id)

  if (botToken) {
    try {
      await syncTelegramAvatar(supabase, {
        botToken,
        telegramId,
        userId: user.id,
        initPhotoUrl: validated.user.photo_url,
      })
    } catch (e) {
      console.error('[avatar] sync failed', e)
    }
  }

  return {
    ok: true,
    telegramId,
    email: updated.user.email,
    isSyntheticEmail: isSyntheticTelegramEmail(updated.user.email),
  }
})
