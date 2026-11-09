import { backButton } from '@tma.js/sdk-vue'
import { safeInternalPath } from '~/utils/safeInternalPath'

/** Корневые вкладки и публичные экраны — без Telegram BackButton. */
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

function fallbackParent(path: string): string {
  if (path.startsWith('/songs/')) return '/songs'
  if (path.startsWith('/setlists/')) return '/setlists'
  if (path.startsWith('/repertoire/songs/')) return '/repertoire'
  if (path.startsWith('/repertoire')) return '/'
  if (path.startsWith('/account/')) return '/account'
  if (path.startsWith('/members')) return '/account'
  if (path.startsWith('/invite/')) return '/'
  return '/'
}

/**
 * Нативный Telegram BackButton (fullscreen / header).
 * Вызывать один раз из layout — без дублирующих кнопок в UI.
 */
export function useTelegramBackButton() {
  const route = useRoute()
  const router = useRouter()

  function sync() {
    if (!import.meta.client) return
    try {
      if (!backButton.isSupported()) return
      if (!backButton.isMounted()) {
        backButton.mount()
      }
      if (isRootPath(route.path)) {
        backButton.hide()
      } else {
        backButton.show()
      }
    } catch {
      // вне TMA / старый клиент
    }
  }

  function goBack() {
    const { markPopNavigation } = useNavigationDirection()
    markPopNavigation()
    useHaptics().impact('soft')

    const from = safeInternalPath(route.query.from, '')
    if (from) {
      void navigateTo(from)
      return
    }

    const before = route.fullPath
    const fallback = fallbackParent(route.path)
    if (import.meta.client && window.history.length > 1) {
      router.back()
      window.setTimeout(() => {
        if (useRoute().fullPath === before) {
          markPopNavigation()
          void navigateTo(fallback)
        }
      }, 120)
      return
    }
    void navigateTo(fallback)
  }

  onMounted(() => {
    sync()
    try {
      if (backButton.isSupported()) {
        if (!backButton.isMounted()) backButton.mount()
        backButton.onClick(goBack)
      }
    } catch {
      // ignore
    }
  })

  watch(() => route.fullPath, sync)

  onBeforeUnmount(() => {
    try {
      if (backButton.isSupported()) {
        backButton.offClick(goBack)
        backButton.hide()
      }
    } catch {
      // ignore
    }
  })
}
