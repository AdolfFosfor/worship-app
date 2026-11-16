import { useAuthStore } from '~/stores/auth'
import { useWorkspaceStore } from '~/stores/workspace'
import { useTelegramApp } from '~/composables/useTelegramApp'
import { useInviteShare } from '~/composables/useInviteShare'
import { DEV_MOCK_USER } from '~/utils/telegram/devMock'

const DEV_EMAIL_KEY = 'worship-dev-email'

export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  const workspace = useWorkspaceStore()
  const telegram = useTelegramApp()
  const inviteShare = useInviteShare()
  const config = useRuntimeConfig()

  inviteShare.capturePendingInviteFromStartParam()

  await auth.init()

  const { syncLocaleFromTelegram } = useAppLocale()

  async function tryTelegramSignIn(): Promise<boolean> {
    if (!telegram.isTelegramEnvironment.value) return false
    const initDataRaw = telegram.getInitDataRaw()
    if (!initDataRaw) return false
    try {
      await auth.signInWithTelegram(initDataRaw)
      syncLocaleFromTelegram()
      return true
    } catch {
      return false
    }
  }

  async function trySavedDevSession(): Promise<boolean> {
    if (!config.public.allowTelegramDevMock) return false
    if (telegram.isTelegramEnvironment.value) return false
    if (import.meta.dev === false && process.env.NODE_ENV === 'production') return false
    let email: string
    try {
      email = localStorage.getItem(DEV_EMAIL_KEY)?.trim() || ''
    } catch {
      return false
    }
    if (!email) return false
    try {
      await auth.signInWithDevSession(email)
      return true
    } catch {
      return false
    }
  }

  function isBrowserMockUser(): boolean {
    return (
      !telegram.isTelegramEnvironment.value
      && auth.user?.telegramId === DEV_MOCK_USER.id
    )
  }

  // Real TMA: always refresh from initData.
  // Browser: never auto-login as mock TG user (id 10001 → empty onboarding).
  // Prefer saved Dev Login email instead.
  if (telegram.isTelegramEnvironment.value && telegram.getInitDataRaw()) {
    await tryTelegramSignIn()
  } else if (!auth.isAuthenticated || isBrowserMockUser()) {
    const restored = await trySavedDevSession()
    if (!restored && isBrowserMockUser()) {
      // Drop useless mock session so /login (Dev Login) is reachable
      try {
        await auth.signOut()
      } catch {
        // ignore
      }
    }
  }

  syncLocaleFromTelegram()

  if (auth.isAuthenticated) {
    try {
      await workspace.loadCurrent()
    } catch {
      // ignore; pages show error states
    }
  }

  async function openPendingInvite() {
    if (!auth.isAuthenticated) return
    const code = inviteShare.takePendingInvite()
    if (!code) return
    const path = `/invite/${encodeURIComponent(code)}`
    const current = useRouter().currentRoute.value.path
    if (current === path || current === `/invite/${code}`) return
    await navigateTo(path)
  }

  await openPendingInvite()

  let recovering = false
  watch(
    () => auth.isAuthenticated,
    async (ok, wasOk) => {
      if (ok) {
        await workspace.loadCurrent()
        await openPendingInvite()
        return
      }

      workspace.clear()

      // Сессия пропала в TMA (refresh fail / storage) — тихо восстановить до /login
      if (wasOk && telegram.isTelegramEnvironment.value && !recovering) {
        recovering = true
        try {
          const restored = await tryTelegramSignIn()
          if (restored) {
            await workspace.loadCurrent()
            await openPendingInvite()
            return
          }
        } finally {
          recovering = false
        }
      }
    },
  )
})