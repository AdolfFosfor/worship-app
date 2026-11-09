import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const AUTH_STORAGE_KEY = 'worship-auth-token'

type SbGlobal = typeof globalThis & {
  __worshipSupabase?: SupabaseClient
}

export function createSupabaseBrowserClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: AUTH_STORAGE_KEY,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  })
}

/**
 * Singleton across Vite HMR — otherwise a hot reload drops the in-memory
 * session and (if storage was empty/mismatched) leaves the app logged out
 * while the form still looks editable.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!import.meta.client) {
    throw new Error('Supabase browser client is only available on the client')
  }

  const g = globalThis as SbGlobal
  if (g.__worshipSupabase) return g.__worshipSupabase

  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl as string
  const anonKey = config.public.supabaseAnonKey as string

  if (!url || !anonKey) {
    throw new Error('Missing NUXT_PUBLIC_SUPABASE_URL or NUXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  g.__worshipSupabase = createSupabaseBrowserClient(url, anonKey)
  return g.__worshipSupabase
}
