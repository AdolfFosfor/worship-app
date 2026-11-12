/**
 * Жесты shell (PTR, edge-swipe), которые нельзя начинать / продолжать
 * во время drag, sheet, диалога и т.п.
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
  '.app-shell--swiping',
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
