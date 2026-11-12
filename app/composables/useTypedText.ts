/**
 * Печатная смена текста: общий префикс сохраняем, хвост стираем и допечатываем.
 * VueUse typewriter нет — лёгкая своя реализация под заголовок shell.
 */
export function useTypedText(
  source: MaybeRefOrGetter<string>,
  options?: MaybeRefOrGetter<{
    typeMs?: number
    eraseMs?: number
  }>,
) {
  const displayed = ref(toValue(source))
  let generation = 0

  function sleep(ms: number) {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms)
    })
  }

  function speeds() {
    const opts = toValue(options) ?? {}
    return {
      typeMs: opts.typeMs ?? 22,
      eraseMs: opts.eraseMs ?? 14,
    }
  }

  watch(
    () => toValue(source),
    async (next) => {
      const my = ++generation
      const prev = displayed.value
      if (prev === next) return

      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduceMotion) {
        displayed.value = next
        return
      }

      let shared = 0
      const max = Math.min(prev.length, next.length)
      while (shared < max && prev[shared] === next[shared]) shared += 1

      for (let i = prev.length; i > shared; i -= 1) {
        if (my !== generation) return
        displayed.value = prev.slice(0, i - 1)
        await sleep(speeds().eraseMs)
      }

      for (let i = shared; i < next.length; i += 1) {
        if (my !== generation) return
        displayed.value = next.slice(0, i + 1)
        await sleep(speeds().typeMs)
      }

      if (my === generation) displayed.value = next
    },
  )

  const isTyping = computed(() => displayed.value !== toValue(source))

  return { displayed, isTyping }
}
