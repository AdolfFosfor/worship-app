/**
 * Лёгкий scroll к элементу chart внутри .app-shell__content.
 * Не компенсирует OS keyboard (это делает --app-keyboard-inset).
 */

type RevealOptions = {
  force?: boolean
  extraBottom?: number
}

let revealToken = 0

function readCssPx(name: string): number {
  if (!import.meta.client) return 0
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

export function useEditorReveal() {
  function revealElement(el: Element | null | undefined, opts: RevealOptions = {}) {
    if (!import.meta.client || !(el instanceof HTMLElement)) return
    const scroller = document.querySelector<HTMLElement>('.app-shell__content')
    if (!scroller) return

    const token = ++revealToken
    requestAnimationFrame(() => {
      if (token !== revealToken) return

      const chartKb = readCssPx('--chart-kb-inset')
      const kb = readCssPx('--app-keyboard-inset')
      const bottomChrome = chartKb + kb + (opts.extraBottom ?? 0) + 12
      const bandTop = 12
      const bandBottom = window.innerHeight - bottomChrome
      if (bandBottom - bandTop < 80) return

      const rect = el.getBoundingClientRect()
      const margin = Math.min(64, (bandBottom - bandTop) * 0.2)
      const ok =
        rect.top >= bandTop + margin * 0.3 && rect.bottom <= bandBottom - margin * 0.3
      if (!opts.force && ok) return

      const delta = (rect.top + rect.bottom) / 2 - (bandTop + bandBottom) / 2
      if (!opts.force && Math.abs(delta) < 8) return
      scroller.scrollTop += delta
    })
  }

  function revealSelector(selector: string, opts?: RevealOptions) {
    if (!import.meta.client) return
    revealElement(document.querySelector(selector), opts)
  }

  return { revealElement, revealSelector }
}
