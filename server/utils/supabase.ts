import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function createServiceClient(): SupabaseClient {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl as string
  const serviceKey = config.supabaseServiceRoleKey as string

  if (!url || !serviceKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase service credentials are not configured',
    })
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
