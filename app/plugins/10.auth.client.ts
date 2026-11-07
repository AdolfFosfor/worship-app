import { useAuthStore } from '~/stores/auth'
import { useWorkspaceStore } from '~/stores/workspace'
import { useTelegramApp } from '~/composables/useTelegramApp'

export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  const workspace = useWorkspaceStore()
  const telegram = useTelegramApp()

  await auth.init()

  // Auto Telegram sign-in only inside a real Mini App (not browser mock).
  // Browser mock uses Magic Link; Telegram button on /login is manual.
  if (!auth.isAuthenticated && telegram.isTelegramEnvironment.value) {
    const initDataRaw = telegram.getInitDataRaw()
    if (initDataRaw) {
      try {
        await auth.signInWithTelegram(initDataRaw)
      } catch {
        // Leave unauthenticated; login page / guards handle UX
      }
    }
  }

  if (auth.isAuthenticated) {
    try {
      await workspace.loadCurrent()
    } catch {
      // ignore; pages show error states
    }
  }

  watch(
    () => auth.isAuthenticated,
    async (ok) => {
      if (ok) {
        await workspace.loadCurrent()
      } else {
        workspace.clear()
      }
    },
  )
})
