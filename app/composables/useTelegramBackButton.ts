import { backButton } from '@tma.js/sdk-vue'
import { popAppNavStack, resetAppNavStack } from '~/composables/useAppNavStack'
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
  if (path.match(/^\/songs\/[^/]+\/edit\/?$/)) {
    return path.replace(/\/edit\/?$/, '')
  }
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

function pathOnly(fullPath: string): string {
  return fullPath.split('?')[0] || fullPath
}

let backInFlight = false
let clickBound = false

function goReplace(target: string) {
  // Сбрасываем стек на цель — иначе leftover deep-entry даёт луп A↔parent
  resetAppNavStack(target)
  void navigateTo(target, { replace: true }).finally(() => {
    backInFlight = false
  })
}

/**
 * Единый «назад» для TMA BackButton и edge-swipe.
 *
 * Стек в sessionStorage переживает PTR/reload; иначе — `from` / fallback-родитель.
 * Всегда `replace`, чтобы не плодить history в WebView.
 */
export function navigateAppBack() {
  if (!import.meta.client) return
  if (backInFlight) return

  const route = useRoute()
  if (isRootPath(route.path)) {
    backInFlight = false
    return
  }

  backInFlight = true
  const { markPopNavigation } = useNavigationDirection()
  markPopNavigation()
  useHaptics().impact('soft')

  const from = safeInternalPath(route.query.from, '')
  const key = typeof route.query.key === 'string' ? route.query.key : ''

  const stacked = popAppNavStack()

  const editMatch = route.path.match(/^\/songs\/([^/]+)\/edit\/?$/)
  if (editMatch) {
    const songPrefix = `/songs/${editMatch[1]}`
    if (stacked && pathOnly(stacked).startsWith(songPrefix) && !pathOnly(stacked).includes('/edit')) {
      void navigateTo(stacked, { replace: true }).finally(() => {
        backInFlight = false
      })
      return
    }
    const query = {
      ...(from ? { from } : {}),
      ...(key ? { key } : {}),
    }
    const qs = new URLSearchParams(query).toString()
    const targetFull = qs ? `${songPrefix}?${qs}` : songPrefix
    // Стек мог содержать только /edit — чистим, иначе луп edit↔song
    resetAppNavStack(targetFull)
    void navigateTo({ path: songPrefix, query }, { replace: true }).finally(() => {
      backInFlight = false
    })
    return
  }

  if (stacked && pathOnly(stacked) !== route.path) {
    // stacked уже вершина после pop — не reset в один элемент, сохраняем хвост истории
    void navigateTo(stacked, { replace: true }).finally(() => {
      backInFlight = false
    })
    return
  }

  // Стек пуст / рассинхрон / тот же path — идём на from или родителя и ЧИСТИМ стек
  // (иначе leftover `/songs/1` + navigate `/songs` → снова Back на `/songs/1`)
  if (from && pathOnly(from) !== route.path) {
    goReplace(from)
    return
  }

  const parent = fallbackParent(route.path)
  if (parent === route.path) {
    resetAppNavStack(parent)
    backInFlight = false
    return
  }
  goReplace(parent)
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
        if (!clickBound) {
          backButton.onClick(navigateAppBack)
          clickBound = true
        }
      }
    } catch {
      // ignore
    }
  })

  watch(() => route.fullPath, sync)

  onBeforeUnmount(() => {
    // Layout обычно живёт весь сеанс — не снимаем onClick при HMR-ремоунте родителя
    // с другим инстансом. Скрытие кнопки на корне делает sync().
    try {
      if (backButton.isSupported() && isRootPath(route.path)) {
        backButton.hide()
      }
    } catch {
      // ignore
    }
  })
}
