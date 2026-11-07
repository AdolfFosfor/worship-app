import type { H3Event } from 'h3'
import type { User } from '@supabase/supabase-js'
import { createServiceClient } from './supabase'

export async function requireAuthUser(event: H3Event): Promise<{
  user: User
  accessToken: string
  supabase: ReturnType<typeof createServiceClient>
}> {
  const header = getHeader(event, 'authorization')
  const accessToken = header?.replace(/^Bearer\s+/i, '').trim()
  if (!accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Authorization required' })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid session' })
  }

  return { user: data.user, accessToken, supabase }
}
