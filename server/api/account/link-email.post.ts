import { createSessionForUser } from '../../utils/authSession'
import { requireAuthUser } from '../../utils/authUser'
import {
  findUserByEmail,
  isSyntheticTelegramEmail,
  mergeAuthUserInto,
  upsertTelegramAccount,
} from '../../utils/telegramAccounts'
import { telegramPassword } from '../../utils/telegramPassword'

/**
 * Bind a real email to the current account without Auth email sends
 * (avoids Free-tier rate limit on updateUser / Magic Link confirmation).
 */
export default defineEventHandler(async (event) => {
  const { user, supabase } = await requireAuthUser(event)
  const body = await readBody<{ email?: string }>(event)
  const email = body?.email?.trim().toLowerCase()

  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите корректный email' })
  }
  if (isSyntheticTelegramEmail(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите настоящий email' })
  }

  const currentEmail = user.email?.toLowerCase() ?? ''
  if (!isSyntheticTelegramEmail(currentEmail) && currentEmail === email) {
    return {
      ok: true,
      alreadyLinked: true,
      email,
      access_token: null as string | null,
      refresh_token: null as string | null,
    }
  }

  const existing = await findUserByEmail(supabase, email)
  const telegramId =
    typeof user.user_metadata?.telegram_id === 'number'
      ? (user.user_metadata.telegram_id as number)
      : null

  const config = useRuntimeConfig()
  const botToken = (config.telegramBotToken as string) || 'dev-token'

  // Email already belongs to another account → merge current into it (keep workspace data)
  if (existing && existing.id !== user.id) {
    const meta = {
      ...existing.user_metadata,
      ...(telegramId
        ? {
            telegram_id: telegramId,
            first_name: user.user_metadata?.first_name ?? existing.user_metadata?.first_name,
            last_name: user.user_metadata?.last_name ?? existing.user_metadata?.last_name,
            username: user.user_metadata?.username ?? existing.user_metadata?.username,
            language_code:
              user.user_metadata?.language_code ?? existing.user_metadata?.language_code,
          }
        : {}),
    }

    await mergeAuthUserInto(supabase, user.id, existing.id)

    const patch: {
      email_confirm: boolean
      user_metadata: Record<string, unknown>
      password?: string
    } = {
      email_confirm: true,
      user_metadata: meta,
    }
    if (telegramId) {
      patch.password = telegramPassword(telegramId, botToken)
      await upsertTelegramAccount(supabase, telegramId, existing.id)
    }

    const { data: updated, error } = await supabase.auth.admin.updateUserById(existing.id, patch)
    if (error || !updated.user) {
      throw createError({
        statusCode: 500,
        statusMessage: error?.message ?? 'Не удалось объединить аккаунты',
      })
    }

    const session = await createSessionForUser(supabase, updated.user)
    return {
      ok: true,
      merged: true,
      email: updated.user.email,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }
  }

  // Free email (or already ours) → set directly, confirmed, no mail
  const { data: updated, error } = await supabase.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
    user_metadata: user.user_metadata ?? {},
  })
  if (error || !updated.user) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Не удалось привязать email',
    })
  }

  if (telegramId) {
    await upsertTelegramAccount(supabase, telegramId, updated.user.id)
  }

  // Session may still be valid; mint fresh one on the new email for safety
  const session = await createSessionForUser(supabase, updated.user)
  return {
    ok: true,
    merged: false,
    email: updated.user.email,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  }
})
