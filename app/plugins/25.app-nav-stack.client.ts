import {
  ensureAppNavStack,
  trackAppNavForward,
} from '~/composables/useAppNavStack'
import { navigateAppBack } from '~/composables/useTelegramBackButton'

const ROOT_PATHS = new Set([
  '/',
  '/songs',
  '/setlists',
  '/account',
  '/login',
  '/onboarding',
])

function isRootPath(path: string): boolean {
  if (ROOT_PATHS.has(path)) return true
  if (path.startsWith('/auth')) return true
  return false
}

/**
 * Синхронизирует sessionStorage-стек с роутером и подстраховывает history,
 * чтобы системный Back в Telegram не закрывал Mini App после reload.
 */
export default defineNuxtPlugin({
  name: 'app-nav-stack',
  setup() {
    const router = useRouter()
    const { consumePopNavigation } = useNavigationDirection()

    void router.isReady().then(() => {
      ensureAppNavStack(router.currentRoute.value.fullPath)
      installTelegramHistoryGuard()
    })

    router.afterEach((to, from) => {
      if (consumePopNavigation()) {
        ensureAppNavStack(to.fullPath)
        return
      }
      if (to.fullPath === from.fullPath) return
      trackAppNavForward(to.fullPath, from.fullPath, isRootPath)
    })
  },
})

function installTelegramHistoryGuard() {
  const state = history.state
  if (!state || state.worshipNavGuard !== 2) {
    try {
      history.replaceState({ ...(state || {}), worshipNavGuard: 1 }, '', location.href)
      history.pushState({ worshipNavGuard: 2 }, '', location.href)
    } catch {
      return
    }
  }

  window.addEventListener('popstate', () => {
    // WebView пытается уйти с единственной «реальной» записи → закрытие Mini App.
    // Возвращаем sentinel и отдаём жест нашему navigateAppBack.
    try {
      if (history.state?.worshipNavGuard !== 2) {
        history.pushState({ worshipNavGuard: 2 }, '', location.href)
      }
    } catch {
      /* ignore */
    }

    const path = useRoute().path
    if (isRootPath(path)) return
    navigateAppBack()
  })
}
