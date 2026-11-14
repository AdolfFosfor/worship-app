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

/** Visual line boxes of the text node (wrap-aware), not the full-width <p>. */
function textLineBoxes(textEl: HTMLElement): DOMRect[] {
  const node = textNode(textEl)
  if (!node?.length) {
    const r = textEl.getBoundingClientRect()
    return r.width || r.height ? [r] : []
  }
  const range = document.createRange()
  try {
    range.selectNodeContents(node)
    return Array.from(range.getClientRects()).filter((r) => r.width > 0 || r.height > 0)
  } catch {
    const r = textEl.getBoundingClientRect()
    return r.width || r.height ? [r] : []
  } finally {
    range.detach?.()
  }
}

/** Ink line box nearest to clientY (for wrapped lyrics). */
function lineBoxAtY(textEl: HTMLElement, clientY: number): DOMRect | null {
  const boxes = textLineBoxes(textEl)
  if (!boxes.length) return null
  let best = boxes[0]!
  let bestDist = Infinity
  for (const box of boxes) {
    const dist =
      clientY < box.top ? box.top - clientY : clientY > box.bottom ? clientY - box.bottom : 0
    if (dist < bestDist) {
      bestDist = dist
      best = box
    }
  }
  return best
}

function nearestGlyphOffset(textEl: HTMLElement, clientX: number, clientY: number): number {
  const text = textEl.textContent ?? ''
  const node = textNode(textEl)
  if (!node || !text.length) return 0
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
      // Prefer X; Y is secondary so chord-band drift is forgiving
      const d = (cx - clientX) ** 2 + (cy - clientY) ** 2 * 0.2
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

/**
 * Map pointer → character offset.
 * Clamps to real glyph ink (not full-width block) so drags don't snap to EOL.
 */
export function offsetAtClientPoint(textEl: HTMLElement, clientX: number, clientY: number): number {
  const text = textEl.textContent ?? ''
  if (!text.length) return 0

  const box = lineBoxAtY(textEl, clientY)
  if (!box) return 0

  // Clamp into this visual row's ink — <p> is often wider than the text
  const x = Math.max(box.left + 0.5, Math.min(box.right - 0.5, clientX))
  const y = (box.top + box.bottom) / 2

  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }

  let fromCaret: number | null = null
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y)
    if (pos?.offsetNode && textEl.contains(pos.offsetNode)) {
      fromCaret = Math.max(0, Math.min(text.length, pos.offset))
    }
  } else if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y)
    if (range && textEl.contains(range.startContainer)) {
      fromCaret = Math.max(0, Math.min(text.length, range.startOffset))
    }
  }

  if (fromCaret != null) {
    // Caret APIs love returning text.length when X is near the right padding of a short line
    if (fromCaret >= text.length) {
      const nearEnd = x >= box.right - 3
      if (!nearEnd) return nearestGlyphOffset(textEl, x, y)
      // Truly at end of this visual row — place after last char of that row's content.
      // Prefer last character index for left-aligned chord over "ghost" after EOL.
      return Math.max(0, text.length - 1)
    }
    return fromCaret
  }

  return nearestGlyphOffset(textEl, x, y)
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
