/**
 * Глобальный хаптик на интерактивные тапы (кнопки, nav, chips, CTA).
 * Спец. жесты (DnD аккордов) добавляют свои вызовы в компонентах.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const { tap } = useHaptics()

  const SELECTOR = [
    'button:not(:disabled):not([aria-disabled="true"])',
    'a.app-header-action',
    'a.app-cta',
    'a.app-press',
    'a.app-bottom-nav__item',
    '[role="menuitem"]',
    '[role="tab"]',
    '[role="button"]:not([aria-disabled="true"])',
    '.p-button:not(.p-disabled)',
    '.chart-chip',
    '.chart-insert',
    '.chart-editor__add-pill',
    '.chord-kb__chip',
    '.chord-kb__tab',
    '.chord-kb__next',
    '.chord-kb__close',
    '.chord-kb__add',
    '.chord-kb__more',
    '.chord-kb__composer-cta',
    '.capo-stepper__btn',
    '.key-stepper__btn',
    '.app-list-row',
    '.home-action',
    '.setlists-card',
    '.setlists-hero__link',
    '.songs-card',
    '.account-action',
  ].join(',')

  let lastAt = 0
  const THROTTLE_MS = 40

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('[data-haptic="off"]')) return
    const hit = target.closest(SELECTOR)
    if (!hit) return
    // Drag handles / long-press chips: свой grab в компоненте
    if (hit.closest('[data-haptic-drag]')) return

    const now = Date.now()
    if (now - lastAt < THROTTLE_MS) return
    lastAt = now
    tap()
  }

  document.addEventListener('pointerdown', onPointerDown, {
    capture: true,
    passive: true,
  })
})
