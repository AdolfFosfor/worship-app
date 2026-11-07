import type { Session, SupabaseClient, User } from '@supabase/supabase-js'

/** Mint a session without sending email (admin generateLink + verifyOtp). */
export async function createSessionForUser(
  supabase: SupabaseClient,
  user: User,
): Promise<Session> {
  if (!user.email) {
    throw createError({ statusCode: 500, statusMessage: 'User has no email' })
  }

  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  })
  if (linkError || !link.properties?.hashed_token) {
    throw createError({
      statusCode: 500,
      statusMessage: linkError?.message ?? 'Failed to mint session',
    })
  }

  const { data, error } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: link.properties.hashed_token,
  })
  if (error || !data.session) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Failed to verify session',
    })
  }

  return data.session
}
