/**
 * Окно DOM для длинных списков при скролле в `.app-shell__content`.
 * Данные уже в памяти — монтируем порциями у низа viewport (rootMargin),
 * сверху не «дырявим» скролл. Для restore глубокой позиции — ensureForOffset.
 */

const SHELL_SCROLL = '.app-shell__content'

export function useShellRevealWindow(
  totalCount: MaybeRefOrGetter<number>,
  options?: {
    /** Сколько строк сразу после появления данных */
    initial?: number
    /** Сколько добираем при приближении к низу */
    step?: number
    /** Запас до низа viewport, чтобы подгрузка была незаметной */
    rootMargin?: string
    /** Оценка высоты строки — для restore scroll */
    estimateRowPx?: number
  },
) {
  const initial = options?.initial ?? 20
  const step = options?.step ?? 20
  const rootMargin = options?.rootMargin ?? '480px 0px'
  const estimateRowPx = options?.estimateRowPx ?? 56

  const limit = ref(initial)
  const sentinel = ref<HTMLElement | null>(null)

  const count = computed(() => Math.max(0, toValue(totalCount)))
  const hasMore = computed(() => limit.value < count.value)

  function clampLimit(next: number) {
    const max = count.value
    limit.value = Math.max(0, Math.min(max, next))
  }

  function reset() {
    clampLimit(Math.min(initial, count.value))
  }

  function revealMore() {
    if (!hasMore.value) return
    clampLimit(limit.value + step)
  }

  /** Дорисовать достаточно DOM под scrollTop (KeepAlive / back). */
  function ensureForOffset(scrollTop: number, viewport = 0) {
    const view = viewport || (shellScroll()?.clientHeight ?? 640)
    const needed = Math.ceil((scrollTop + view * 1.35) / estimateRowPx) + step
    if (needed > limit.value) clampLimit(needed)
  }

  function shellScroll() {
    if (!import.meta.client) return null
    return document.querySelector<HTMLElement>(SHELL_SCROLL)
  }

  watch(
    count,
    (n, prev) => {
      if (prev == null) {
        reset()
        return
      }
      // Фильтр / новый список короче окна — сжимаем; иначе не откатываем прогресс
      if (n < limit.value) clampLimit(n)
      if (n > 0 && limit.value === 0) reset()
    },
    { immediate: true },
  )

  let observer: IntersectionObserver | null = null

  function bindObserver() {
    observer?.disconnect()
    observer = null
    const el = sentinel.value
    const root = shellScroll()
    if (!el || !root || !hasMore.value) return

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) revealMore()
      },
      { root, rootMargin, threshold: 0 },
    )
    observer.observe(el)
  }

  watch([sentinel, hasMore], () => {
    void nextTick(bindObserver)
  })

  onMounted(() => {
    void nextTick(() => {
      const root = shellScroll()
      if (root) ensureForOffset(root.scrollTop, root.clientHeight)
      bindObserver()
    })
  })

  onActivated(() => {
    void nextTick(() => {
      const root = shellScroll()
      if (root) ensureForOffset(root.scrollTop, root.clientHeight)
      bindObserver()
    })
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  // После async-restore скролла layout снова просит догнать DOM
  const restoreTick = useState('app-shell-scroll-restore-tick', () => 0)
  watch(restoreTick, () => {
    void nextTick(() => {
      const root = shellScroll()
      if (root) ensureForOffset(root.scrollTop, root.clientHeight)
    })
  })

  return {
    limit: computed(() => limit.value),
    hasMore,
    sentinel,
    reset,
    revealMore,
    ensureForOffset,
  }
}
