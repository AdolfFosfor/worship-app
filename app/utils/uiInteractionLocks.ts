/**
 * Жесты shell (PTR, edge-swipe), которые нельзя начинать / продолжать
 * во время drag, sheet, диалога и т.п.
 *
 * Важно: `.app-shell--swiping` сюда НЕ входит — иначе edge-swipe гасит сам себя
 * на следующем touchmove (класс вешает layout при старте жеста).
 */
const BLOCKING_SELECTOR = [
  '.app-sheet',
  '.app-top-sheet',
  '.create-setlist-sheet-mask',
  '.member-sheet-mask',
  '.p-dialog-mask',
  '.chord-stage--fullscreen',
  /* Горизонтальный свайп уже захвачен / панель открыта */
  '.swipe-delete--dragging',
  '.swipe-delete--open',
  '.p-toast-message--swiping',
  '.app-shell--keyboard-open',
  '.app-shell--chord-kb-open',
  '[data-no-edge-swipe]',
  /* Drag / reorder — по всему приложению */
  '.setlist-item--arming',
  '.setlist-item--drag',
  '.setlist-item--chosen',
  '.setlist-item--fallback',
  '.sortable-drag',
  '.sortable-chosen',
  '.sortable-ghost',
  '.chart-editor--dragging',
  '.lyric-chord--dragging',
  '[data-app-dragging]',
].join(', ')

const HTML_LOCK_CLASSES = ['setlist-drag-freeze', 'app-drag-active'] as const

export function hasUiInteractionLock(): boolean {
  if (!import.meta.client) return false
  const root = document.documentElement
  for (const cls of HTML_LOCK_CLASSES) {
    if (root.classList.contains(cls)) return true
  }
  return Boolean(document.querySelector(BLOCKING_SELECTOR))
}

/** PTR: блокируем и на время edge-swipe назад. */
export function hasShellGestureLock(): boolean {
  if (hasUiInteractionLock()) return true
  if (!import.meta.client) return false
  return Boolean(document.querySelector('.app-shell--swiping'))
}
