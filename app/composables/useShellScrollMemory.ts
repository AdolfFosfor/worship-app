/**
 * Скролл живёт в layout main, не в page — KeepAlive страницы сам его не хранит.
 * Пишем scrollTop по fullPath при уходе / на scroll, восстанавливаем при входе (в т.ч. back).
 *
 * На мобильных без lock старый scrollTop длинной страницы успевает записаться
 * в позицию новой (главная) — поэтому restore + ignore scroll во время перехода.
 */

/**
 * Корневые вкладки: при обычном переходе (не back) всегда наверх.
 * /songs исключён — длинный список удобнее возвращать с той же позиции.
 */
const ROOT_TAB_PATHS = new Set(['/', '/setlists', '/account'])

/** Страницы после async-load могут дернуть повторный restore. */
export function requestShellScrollRestore() {
  const tick = useState('app-shell-scroll-restore-tick', () => 0)
  tick.value += 1
}

export function useShellScrollMemory(scrollRef: Ref<HTMLElement | null>) {
  const route = useRoute()
  const router = useRouter()
  const { consumePopNavigation } = useNavigationDirection()
  const positions = useState<Record<string, number>>('app-shell-scroll', () => ({}))

  let detachScroll: (() => void) | null = null
  /** Не писать scrollTop в кэш, пока чиним позицию после смены роута */
  let restoring = false
  let restoreToken = 0
  const pendingTimers: number[] = []

  function clearPendingTimers() {
    for (const id of pendingTimers) window.clearTimeout(id)
    pendingTimers.length = 0
  }

  function clampY(el: HTMLElement, y: number) {
    const max = Math.max(0, el.scrollHeight - el.clientHeight)
    return Math.max(0, Math.min(Math.round(y), max))
  }

  function readTargetY(path: string) {
    return positions.value[path] ?? 0
  }

  function apply(path: string) {
    const el = scrollRef.value
    if (!el || !path) return
    const y = clampY(el, readTargetY(path))
    if (el.scrollTop !== y) {
      el.scrollTop = y
    }
  }

  function save(path: string) {
    const el = scrollRef.value
    if (!el || !path || restoring) return
    positions.value[path] = clampY(el, el.scrollTop)
  }

  function restore(path: string) {
    const el = scrollRef.value
    if (!el || !path) return

    clearPendingTimers()
    const token = ++restoreToken
    restoring = true

    const run = () => {
      if (token !== restoreToken) return
      apply(path)
    }

    run()
    void nextTick(() => {
      run()
      requestAnimationFrame(() => {
        run()
        requestAnimationFrame(() => {
          run()
          // iOS/TMA: высота контента и momentum догоняют позже
          pendingTimers.push(
            window.setTimeout(() => {
              run()
            }, 48),
            window.setTimeout(() => {
              run()
              if (token === restoreToken) restoring = false
            }, 120),
            window.setTimeout(() => {
              if (token !== restoreToken) return
              run()
              restoring = false
            }, 280),
          )
        })
      })
    })
  }

  function bindScroll() {
    detachScroll?.()
    detachScroll = null
    const el = scrollRef.value
    if (!el) return
    const onScroll = () => {
      if (restoring) return
      positions.value[route.fullPath] = clampY(el, el.scrollTop)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    detachScroll = () => {
      el.removeEventListener('scroll', onScroll)
    }
  }

  router.beforeEach((to, from) => {
    if (from.fullPath && from.fullPath !== to.fullPath) {
      save(from.fullPath)
    }

    // popstate/back — флаг на один переход; иначе залипает и ломает сброс вкладок
    const isPop = consumePopNavigation()

    // Тап по вкладке / обычный push на корень — всегда наверх (back оставляет память)
    const toRoot = ROOT_TAB_PATHS.has(to.path) && to.fullPath === to.path
    if (toRoot && !isPop) {
      positions.value[to.fullPath] = 0
    }

    // Главная короткоживущая: даже после back не оставляем «хвост» длинной страницы
    if (to.path === '/' && to.fullPath === '/') {
      positions.value[to.fullPath] = 0
    }

    // Синхронно до paint — иначе длинный scrollTop мигает на короткой странице
    const el = scrollRef.value
    if (el) {
      restoring = true
      apply(to.fullPath)
    }
  })

  watch(
    () => route.fullPath,
    (path) => {
      restore(path)
    },
  )

  onMounted(() => {
    bindScroll()
    restore(route.fullPath)
  })

  onBeforeUnmount(() => {
    clearPendingTimers()
    detachScroll?.()
    detachScroll = null
  })

  watch(scrollRef, () => {
    bindScroll()
  })

  const restoreTick = useState('app-shell-scroll-restore-tick', () => 0)
  watch(restoreTick, () => {
    restore(route.fullPath)
  })

  return {
    save,
    restore,
  }
}
