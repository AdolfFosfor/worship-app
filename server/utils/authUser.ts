import type { H3Event } from 'h3'
import type { User } from '@supabase/supabase-js'
import { createServiceClient } from './supabase'

type AuthUserResponse = {
  id?: string
  email?: string
  phone?: string
  role?: string
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

/**
 * Validate access token via Auth HTTP API (publishable key as apikey).
 * Avoids supabase-js server "Auth session missing!" when there is no local session.
 */
async function fetchAuthUser(accessToken: string): Promise<User> {
  const config = useRuntimeConfig()
  const url = (config.public.supabaseUrl as string || '').replace(/\/$/, '')
  const anonKey = config.public.supabaseAnonKey as string
  if (!url || !anonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase public credentials are not configured',
    })
  }

  try {
    const user = await $fetch<AuthUserResponse>(`${url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
    })
    if (!user?.id) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid session' })
    }
    return user as unknown as User
  } catch (err: unknown) {
    const statusCode =
      typeof err === 'object' && err && 'statusCode' in err
        ? Number((err as { statusCode?: number }).statusCode)
        : typeof err === 'object' && err && 'status' in err
          ? Number((err as { status?: number }).status)
          : 401
    const message =
      typeof err === 'object' && err && 'data' in err
        ? String(
            (err as { data?: { msg?: string; message?: string } }).data?.msg
              || (err as { data?: { message?: string } }).data?.message
              || '',
          )
        : ''
    throw createError({
      statusCode: statusCode === 403 ? 401 : statusCode || 401,
      statusMessage: message || 'Invalid session',
    })
  }
}

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

  const user = await fetchAuthUser(accessToken)
  return {
    user,
    accessToken,
    supabase: createServiceClient(),
  }
}
