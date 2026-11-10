import { useAuthStore } from '~/stores/auth'
import { useWorkspaceStore } from '~/stores/workspace'
import { useTelegramApp } from '~/composables/useTelegramApp'
import { useInviteShare } from '~/composables/useInviteShare'

export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  const workspace = useWorkspaceStore()
  const telegram = useTelegramApp()
  const inviteShare = useInviteShare()

  inviteShare.capturePendingInviteFromStartParam()

  await auth.init()

  async function tryTelegramSignIn(): Promise<boolean> {
    if (!telegram.isTelegramEnvironment.value) return false
    const initDataRaw = telegram.getInitDataRaw()
    if (!initDataRaw) return false
    try {
      await auth.signInWithTelegram(initDataRaw)
      return true
    } catch {
      return false
    }
  }

  // Auto Telegram sign-in only inside a real Mini App (not browser mock).
  if (!auth.isAuthenticated) {
    await tryTelegramSignIn()
  }

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
