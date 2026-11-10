import { usePreferredReducedMotion } from '@vueuse/core'

/** Мягкий ease-out: быстрый старт, спокойный финиш. */
function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

const displayCache = new Map<string, number>()

/**
 * Плавно ведёт display к target всегда от текущего кадра (не от пропса).
 * cacheKey — чтобы после remount продолжить с последнего показанного значения.
 */
export function useSmoothNumber(
  target: MaybeRefOrGetter<number>,
  options?: {
    duration?: MaybeRefOrGetter<number>
    cacheKey?: MaybeRefOrGetter<string | undefined>
  },
) {
  const reduced = usePreferredReducedMotion()
  const keyOf = () => toValue(options?.cacheKey)

  const initialTarget = toValue(target)
  const cached = keyOf() ? displayCache.get(keyOf()!) : undefined
  const display = ref(cached ?? initialTarget)

  let raf = 0
  let from = display.value
  let to = display.value
  let startedAt = 0
  let durationMs = 1000

  function persist() {
    const key = keyOf()
    if (key) displayCache.set(key, display.value)
  }

  function stop() {
    if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  function tick(now: number) {
    const elapsed = now - startedAt
    const t = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs)
    display.value = from + (to - from) * easeOutCubic(t)
    persist()
    if (t < 1) {
      raf = requestAnimationFrame(tick)
      return
    }
    display.value = to
    raf = 0
    persist()
  }

  function go(next: number) {
    const n = Number.isFinite(next) ? next : 0
    stop()
    if (reduced.value === 'reduce') {
      display.value = n
      persist()
      return
    }
    from = display.value
    to = n
    if (Math.abs(to - from) < 0.001) {
      display.value = to
      persist()
      return
    }
    durationMs = Math.max(0, toValue(options?.duration) ?? 1000)
    startedAt = performance.now()
    raf = requestAnimationFrame(tick)
  }

  watch(
    () => toValue(target),
    (n) => go(n),
  )

  watch(
    () => keyOf(),
    (key, prev) => {
      if (prev) displayCache.set(prev, display.value)
      if (!key) return
      const hit = displayCache.get(key)
      if (hit != null) display.value = hit
      go(toValue(target))
    },
  )

  onMounted(() => {
    if (Math.abs(display.value - toValue(target)) > 0.001) go(toValue(target))
  })

  onBeforeUnmount(() => {
    stop()
    persist()
  })

  return display
}

export function peekSmoothNumber(cacheKey: string) {
  return displayCache.get(cacheKey)
}
