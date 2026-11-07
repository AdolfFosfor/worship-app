import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export function createSupabaseBrowserClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!import.meta.client) {
    throw new Error('Supabase browser client is only available on the client')
  }
  if (browserClient) return browserClient

  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl as string
  const anonKey = config.public.supabaseAnonKey as string

  if (!url || !anonKey) {
    throw new Error('Missing NUXT_PUBLIC_SUPABASE_URL or NUXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  browserClient = createSupabaseBrowserClient(url, anonKey)
  return browserClient
}
