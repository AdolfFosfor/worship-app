/**
 * Скролл живёт в layout main, не в page — KeepAlive страницы сам его не хранит.
 * Пишем scrollTop по fullPath при уходе / на scroll, восстанавливаем при входе (в т.ч. back).
 */

export function useShellScrollMemory(scrollRef: Ref<HTMLElement | null>) {
  const route = useRoute()
  const router = useRouter()
  const positions = useState<Record<string, number>>('app-shell-scroll', () => ({}))

  let detachScroll: (() => void) | null = null

  function save(path: string) {
    const el = scrollRef.value
    if (!el || !path) {
      return
    }
    positions.value[path] = el.scrollTop
  }

  function restore(path: string) {
    const el = scrollRef.value
    if (!el) {
      return
    }
    const y = positions.value[path] ?? 0
    if (el.scrollTop !== y) {
      el.scrollTop = y
    }
  }

  function bindScroll() {
    detachScroll?.()
    detachScroll = null
    const el = scrollRef.value
    if (!el) {
      return
    }
    const onScroll = () => {
      positions.value[route.fullPath] = el.scrollTop
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
  })

  watch(
    () => route.fullPath,
    async (path) => {
      await nextTick()
      // Два кадра: после KeepAlive activate и layout paint
      requestAnimationFrame(() => {
        restore(path)
        requestAnimationFrame(() => {
          restore(path)
        })
      })
    },
  )

  onMounted(() => {
    bindScroll()
    restore(route.fullPath)
  })

  onBeforeUnmount(() => {
    detachScroll?.()
    detachScroll = null
  })

  watch(scrollRef, () => {
    bindScroll()
  })

  return {
    save,
    restore,
  }
}
