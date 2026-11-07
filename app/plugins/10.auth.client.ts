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

  watch(
    () => auth.isAuthenticated,
    async (ok) => {
      if (ok) {
        await workspace.loadCurrent()
        await openPendingInvite()
      } else {
        workspace.clear()
      }
    },
  )
})
