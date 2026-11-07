import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import type { AuthUser as AppAuthUser } from '~~/shared/types'
import { getSupabaseBrowserClient } from '~/utils/supabase/client'

const TELEGRAM_EMAIL_SUFFIX = '@telegram.local'

function isSyntheticTelegramEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(TELEGRAM_EMAIL_SUFFIX))
}

function mapUser(user: User | null): AppAuthUser | null {
  if (!user) return null
  const meta = user.user_metadata ?? {}
  const email = user.email ?? null
  const pendingEmail = user.new_email ?? null
  return {
    id: user.id,
    email,
    pendingEmail,
    firstName: (meta.first_name as string | undefined) ?? null,
    lastName: (meta.last_name as string | undefined) ?? null,
    username: (meta.username as string | undefined) ?? null,
    telegramId: (meta.telegram_id as number | undefined) ?? null,
    languageCode: (meta.language_code as string | undefined) ?? null,
    hasRealEmail: Boolean(email) && !isSyntheticTelegramEmail(email),
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AppAuthUser | null>(null)
  const session = ref<Session | null>(null)
  const ready = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let unsubscribe: (() => void) | null = null

  let initPromise: Promise<void> | null = null

  async function init() {
    if (!import.meta.client) return
    if (ready.value) return
    if (initPromise) return initPromise

    initPromise = (async () => {
      loading.value = true
      error.value = null
      try {
        const config = useRuntimeConfig()
        if (!config.public.supabaseUrl || !config.public.supabaseAnonKey) {
          error.value = 'Supabase не настроен (.env)'
          return
        }
        const supabase = getSupabaseBrowserClient()
        const { data } = await supabase.auth.getSession()
        session.value = data.session
        user.value = mapUser(data.session?.user ?? null)

        if (unsubscribe) unsubscribe()
        const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
          session.value = next
          user.value = mapUser(next?.user ?? null)
        })
        unsubscribe = () => sub.subscription.unsubscribe()
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Auth init failed'
      } finally {
        ready.value = true
        loading.value = false
      }
    })()

    return initPromise
  }

  async function refreshUser() {
    const supabase = getSupabaseBrowserClient()
    const { data, error: getError } = await supabase.auth.getUser()
    if (getError) throw getError
    user.value = mapUser(data.user)
    return user.value
  }

  async function signInWithTelegram(initDataRaw: string) {
    loading.value = true
    error.value = null
    try {
      const result = await $fetch<{
        access_token: string
        refresh_token: string
      }>('/api/auth/telegram', {
        method: 'POST',
        body: { initData: initDataRaw },
      })

      const supabase = getSupabaseBrowserClient()
      const { data, error: setError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      })
      if (setError) throw setError
      session.value = data.session
      user.value = mapUser(data.session?.user ?? null)
      return user.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось войти через Telegram'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function signInWithEmail(email: string) {
    loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      const redirectTo = import.meta.client ? `${window.location.origin}/auth/callback` : undefined
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })
      if (otpError) throw otpError
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось отправить ссылку'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Local/dev login without Magic Link email (needs ALLOW_TELEGRAM_DEV_MOCK). */
  async function signInWithDevSession(email: string) {
    loading.value = true
    error.value = null
    try {
      const result = await $fetch<{
        access_token: string
        refresh_token: string
      }>('/api/auth/dev-session', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      })

      const supabase = getSupabaseBrowserClient()
      const { data, error: setError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      })
      if (setError) throw setError
      session.value = data.session
      user.value = mapUser(data.session?.user ?? null)
      return user.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось войти'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Attach a real inbox via service role (no Auth email send — avoids Free rate limit).
   * May return a refreshed session when accounts were merged.
   */
  async function linkEmail(email: string) {
    loading.value = true
    error.value = null
    try {
      const trimmed = email.trim().toLowerCase()
      if (!trimmed || !trimmed.includes('@')) {
        throw new Error('Укажите корректный email')
      }
      if (isSyntheticTelegramEmail(trimmed)) {
        throw new Error('Укажите настоящий email, не Telegram')
      }
      if (!session.value?.access_token) {
        throw new Error('Нет активной сессии')
      }

      const result = await $fetch<{
        ok: boolean
        email?: string | null
        access_token: string | null
        refresh_token: string | null
      }>('/api/account/link-email', {
        method: 'POST',
        body: { email: trimmed },
        headers: {
          Authorization: `Bearer ${session.value.access_token}`,
        },
      })

      const supabase = getSupabaseBrowserClient()
      if (result.access_token && result.refresh_token) {
        const { data, error: setError } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        })
        if (setError) throw setError
        session.value = data.session
        user.value = mapUser(data.session?.user ?? null)
      } else {
        await refreshUser()
      }
      return user.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось привязать email'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Stamp Telegram identity onto the current (usually email) account. */
  async function linkTelegram(initDataRaw: string) {
    loading.value = true
    error.value = null
    try {
      if (!session.value?.access_token) {
        throw new Error('Нет активной сессии')
      }
      await $fetch('/api/account/link-telegram', {
        method: 'POST',
        body: { initData: initDataRaw },
        headers: {
          Authorization: `Bearer ${session.value.access_token}`,
        },
      })
      await refreshUser()
      return user.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось привязать Telegram'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    session.value = null
    user.value = null
  }

  const isAuthenticated = computed(() => Boolean(session.value && user.value))
  const displayLabel = computed(() => {
    if (!user.value) return ''
    const name = [user.value.firstName, user.value.lastName].filter(Boolean).join(' ')
    if (name) return name
    if (user.value.username) return `@${user.value.username}`
    if (user.value.hasRealEmail && user.value.email) return user.value.email
    return 'Аккаунт'
  })

  return {
    user,
    session,
    ready,
    loading,
    error,
    isAuthenticated,
    displayLabel,
    init,
    refreshUser,
    signInWithTelegram,
    signInWithEmail,
    signInWithDevSession,
    linkEmail,
    linkTelegram,
    signOut,
  }
})
