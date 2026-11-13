export interface CaretPoint {
  /** px from left of `rootEl` */
  left: number
  /** px from top of `rootEl` — top of the glyph box */
  top: number
  /** glyph line height */
  height: number
}

function textNode(textEl: HTMLElement): Text | null {
  const node = textEl.firstChild
  return node && node.nodeType === Node.TEXT_NODE ? (node as Text) : null
}

/** Pixel position of caret at `offset`, relative to `rootEl`. */
export function caretPointInElement(
  textEl: HTMLElement,
  rootEl: HTMLElement,
  offset: number,
): CaretPoint {
  const text = textEl.textContent ?? ''
  const root = rootEl.getBoundingClientRect()
  if (!text.length) {
    const tr = textEl.getBoundingClientRect()
    return { left: tr.left - root.left, top: tr.top - root.top, height: tr.height || 16 }
  }

  const clamped = Math.max(0, Math.min(offset, text.length))
  const node = textNode(textEl)
  if (!node) {
    const tr = textEl.getBoundingClientRect()
    return {
      left: clamped <= 0 ? tr.left - root.left : tr.right - root.left,
      top: tr.top - root.top,
      height: tr.height || 16,
    }
  }

  const range = document.createRange()
  try {
    if (clamped >= text.length) {
      // End of line: right edge of last glyph
      const last = Math.max(0, node.length - 1)
      range.setStart(node, last)
      range.setEnd(node, last + 1)
      const rect = range.getBoundingClientRect()
      return {
        left: (rect.width || rect.height ? rect.right : textEl.getBoundingClientRect().right) - root.left,
        top: (rect.height ? rect.top : textEl.getBoundingClientRect().top) - root.top,
        height: rect.height || 16,
      }
    }

    // Left edge of glyph at `clamped`
    range.setStart(node, clamped)
    range.setEnd(node, Math.min(node.length, clamped + 1))
    const rect = range.getBoundingClientRect()
    if (rect.width || rect.height) {
      return {
        left: rect.left - root.left,
        top: rect.top - root.top,
        height: rect.height || 16,
      }
    }

    const tr = textEl.getBoundingClientRect()
    return { left: tr.left - root.left, top: tr.top - root.top, height: tr.height || 16 }
  } catch {
    const tr = textEl.getBoundingClientRect()
    return { left: tr.left - root.left, top: tr.top - root.top, height: tr.height || 16 }
  } finally {
    range.detach?.()
  }
}

/** @deprecated use caretPointInElement */
export function caretLeftInElement(textEl: HTMLElement, offset: number): number {
  return caretPointInElement(textEl, textEl, offset).left
}

function clampIntoTextBox(textEl: HTMLElement, clientX: number, clientY: number) {
  const rect = textEl.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return { x: clientX, y: clientY }
  return {
    x: Math.max(rect.left, Math.min(rect.right - 0.5, clientX)),
    // Keep Y inside the ink box — points in the chord padding above text
    // make caret APIs snap to offset 0.
    y: Math.max(rect.top + 0.5, Math.min(rect.bottom - 0.5, clientY)),
  }
}

/** Map pointer → nearest character offset (wrap-aware via clientY). */
export function offsetAtClientPoint(textEl: HTMLElement, clientX: number, clientY: number): number {
  const text = textEl.textContent ?? ''
  if (!text.length) return 0

  const { x, y } = clampIntoTextBox(textEl, clientX, clientY)

  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y)
    if (pos?.offsetNode && textEl.contains(pos.offsetNode)) {
      return Math.max(0, Math.min(text.length, pos.offset))
    }
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y)
    if (range && textEl.contains(range.startContainer)) {
      return Math.max(0, Math.min(text.length, range.startOffset))
    }
  }

  // Fallback: nearest glyph; weight X higher so vertical drift is forgiving
  const node = textNode(textEl)
  if (!node) return 0
  let best = 0
  let bestDist = Infinity
  const range = document.createRange()
  try {
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const r = range.getBoundingClientRect()
      if (!r.width && !r.height) continue
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const d = (cx - x) ** 2 + (cy - y) ** 2 * 0.25
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
  } finally {
    range.detach?.()
  }
  return best
}

/** Horizontal drag on a locked visual row (Y fixed to glyph band). */
export function offsetAtClientXOnRow(
  textEl: HTMLElement,
  clientX: number,
  rowClientY: number,
): number {
  return offsetAtClientPoint(textEl, clientX, rowClientY)
}

export function offsetAtClientX(textEl: HTMLElement, clientX: number): number {
  const midY = textEl.getBoundingClientRect().top + textEl.getBoundingClientRect().height / 2
  return offsetAtClientPoint(textEl, clientX, midY)
}
