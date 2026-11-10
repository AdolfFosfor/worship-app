import { createSessionForUser } from '../../utils/authSession'
import { isDevAuthAllowed } from '../../utils/devAuthGate'
import { createServiceClient } from '../../utils/supabase'
import { findUserByEmail } from '../../utils/telegramAccounts'

/**
 * Dev-only: mint a session without sending Magic Link mail.
 * Local only — blocked in production even if the public flag leaks.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!isDevAuthAllowed(config)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const body = await readBody<{ email?: string }>(event)
  const email = body?.email?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'email is required' })
  }

  const supabase = createServiceClient()
  const user = await findUserByEmail(supabase, email)
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const session = await createSessionForUser(supabase, user)
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user,
  }
})
