/**
 * Кламп fixed/absolute оверлея (Popover и т.п.) внутрь колонки .app-shell.
 * На ПК .app-frame на весь viewport — клампить нужно к shell, не к frame.
 */

const PAD = 8

/** Корень видимого Popover после appendTo / teleport. */
export function resolvePopoverEl(
  instance: { $el?: unknown; container?: unknown } | null | undefined,
): HTMLElement | null {
  if (!import.meta.client || !instance) return null

  const fromContainer = instance.container
  if (fromContainer instanceof HTMLElement) return fromContainer

  const raw = instance.$el
  if (raw instanceof HTMLElement) {
    if (raw.classList.contains('p-popover')) return raw
    const nested = raw.querySelector?.('.p-popover')
    if (nested instanceof HTMLElement) return nested
  }

  return (
    document.querySelector<HTMLElement>('.app-shell .p-popover.app-create-popover') ??
    document.querySelector<HTMLElement>('.app-shell > .p-popover')
  )
}

function boundsEl(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('.app-shell') ??
    document.querySelector<HTMLElement>('.app-frame')
  )
}

export function clampOverlayToFrame(el: HTMLElement | null | undefined, pad = PAD) {
  if (!import.meta.client || !el) return

  const frame = boundsEl()
  if (!frame) return

  const fr = frame.getBoundingClientRect()
  if (fr.width < 32) return

  const maxW = Math.max(120, fr.width - pad * 2)
  if (el.getBoundingClientRect().width > maxW + 0.5) {
    el.style.width = `${Math.floor(maxW)}px`
    el.style.maxWidth = `${Math.floor(maxW)}px`
  }

  const r = el.getBoundingClientRect()
  if (r.width < 8) return

  let dx = 0
  let dy = 0

  if (r.right > fr.right - pad) dx = fr.right - pad - r.right
  if (r.left + dx < fr.left + pad) dx = fr.left + pad - r.left
  if (r.bottom > fr.bottom - pad) dy = fr.bottom - pad - r.bottom
  if (r.top + dy < fr.top + pad) dy = fr.top + pad - r.top

  if (!dx && !dy) return

  const style = el.style

  if (dx) {
    // PrimeVue absolutePosition → insetInlineStart (не left)
    const insetRaw = style.insetInlineStart
    const leftRaw = style.left
    if (insetRaw && insetRaw !== 'auto') {
      const n = Number.parseFloat(insetRaw)
      if (Number.isFinite(n)) {
        style.insetInlineStart = `${Math.round(n + dx)}px`
        style.removeProperty('left')
      }
    } else if (leftRaw && leftRaw !== 'auto') {
      const n = Number.parseFloat(leftRaw)
      if (Number.isFinite(n)) style.left = `${Math.round(n + dx)}px`
    } else {
      style.insetInlineStart = `${Math.round(r.left + dx)}px`
    }
  }

  if (dy) {
    const topRaw = style.top
    const n = topRaw && topRaw !== 'auto' ? Number.parseFloat(topRaw) : r.top
    if (Number.isFinite(n)) style.top = `${Math.round(n + dy)}px`
  }
}

/** После show PrimeVue — догоняем ResizeObserver realign. */
export function clampOverlayToFrameAfterShow(el: HTMLElement | null | undefined) {
  if (!import.meta.client || !el) return

  const run = () => clampOverlayToFrame(el)
  run()
  requestAnimationFrame(() => {
    run()
    requestAnimationFrame(() => {
      run()
      window.setTimeout(run, 32)
      window.setTimeout(run, 120)
    })
  })
}
