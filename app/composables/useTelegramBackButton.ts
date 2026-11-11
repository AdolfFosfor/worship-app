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
  if (path === '/songs/new' || path.startsWith('/songs/new/')) return '/songs'
  if (path.startsWith('/songs/')) return '/songs'
  if (path.startsWith('/setlists/')) return '/setlists'
  if (path.startsWith('/repertoire/songs/')) return '/repertoire'
  if (path.startsWith('/repertoire')) return '/'
  if (path.startsWith('/account/')) return '/account'
  if (path.startsWith('/members')) return '/account'
  if (path.startsWith('/dev')) return '/account'
  if (path.startsWith('/invite/')) return '/'
  return '/'
}

/**
 * Единый «назад» для TMA BackButton и edge-swipe.
 *
 * В Telegram WebView `history.length` почти всегда > 1, поэтому `router.back()`
 * непредсказуем (петли, уход «мимо» родителя). Всегда ведём на известный экран
 * через `replace`.
 */
export function navigateAppBack() {
  const route = useRoute()
  const { markPopNavigation } = useNavigationDirection()
  markPopNavigation()
  useHaptics().impact('soft')

  const from = safeInternalPath(route.query.from, '')
  const key = typeof route.query.key === 'string' ? route.query.key : ''

  const editMatch = route.path.match(/^\/songs\/([^/]+)\/edit\/?$/)
  if (editMatch) {
    void navigateTo(
      {
        path: `/songs/${editMatch[1]}`,
        query: {
          ...(from ? { from } : {}),
          ...(key ? { key } : {}),
        },
      },
      { replace: true },
    )
    return
  }

  if (from) {
    void navigateTo(from, { replace: true })
    return
  }

  void navigateTo(fallbackParent(route.path), { replace: true })
}

/**
 * Нативный Telegram BackButton (fullscreen / header).
 * Вызывать один раз из layout — без дублирующих кнопок в UI.
 */
export function useTelegramBackButton() {
  const route = useRoute()

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

  onMounted(() => {
    sync()
    try {
      if (backButton.isSupported()) {
        if (!backButton.isMounted()) backButton.mount()
        backButton.onClick(navigateAppBack)
      }
    } catch {
      // ignore
    }
  })

  watch(() => route.fullPath, sync)

  onBeforeUnmount(() => {
    try {
      if (backButton.isSupported()) {
        backButton.offClick(navigateAppBack)
        backButton.hide()
      }
    } catch {
      // ignore
    }
  })
}
