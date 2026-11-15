/**
 * Свайп вверх по PrimeVue Toast → закрыть (как баннеры iOS).
 * Крестик остаётся; жест не трогает статичную фикстуру /dev/ui.
 */
export function useToastSwipeDismiss() {
  if (!import.meta.client) return

  const bound = new WeakSet<HTMLElement>()
  let observer: MutationObserver | null = null

  const AXIS_LOCK = 8
  const DISMISS_PX = 36
  const DISMISS_VELOCITY = 0.45
  const DOWN_RUBBER = 18

  function dismiss(msg: HTMLElement) {
    const btn = msg.querySelector<HTMLButtonElement>('.p-toast-close-button')
    if (btn) {
      btn.click()
      return
    }
    msg.remove()
  }

  function bind(msg: HTMLElement) {
    if (bound.has(msg)) return
    if (msg.closest('.ui-lab-toast-fixture')) return
    bound.add(msg)
    msg.dataset.toastSwipe = '1'

    let startX = 0
    let startY = 0
    let startT = 0
    let dy = 0
    let tracking = false
    let axis: 'h' | 'v' | null = null
    let pointerId: number | null = null

    function clearTransform(animate: boolean) {
      msg.classList.remove('p-toast-message--swiping')
      msg.style.transition = animate
        ? 'transform 200ms var(--app-ease), opacity 200ms var(--app-ease)'
        : ''
      msg.style.transform = ''
      msg.style.opacity = ''
    }

    function detachWindow() {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if ((e.target as Element | null)?.closest?.('.p-toast-close-button')) return

      startX = e.clientX
      startY = e.clientY
      startT = performance.now()
      dy = 0
      tracking = true
      axis = null
      pointerId = e.pointerId

      window.addEventListener('pointermove', onPointerMove, { passive: false })
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerCancel)

      try {
        msg.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!tracking || pointerId !== e.pointerId) return
      const rawX = e.clientX - startX
      const rawY = e.clientY - startY

      if (!axis) {
        if (Math.abs(rawX) < AXIS_LOCK && Math.abs(rawY) < AXIS_LOCK) return
        axis = Math.abs(rawY) >= Math.abs(rawX) ? 'v' : 'h'
        if (axis === 'h') {
          tracking = false
          pointerId = null
          detachWindow()
          return
        }
        msg.classList.add('p-toast-message--swiping')
        msg.style.transition = 'none'
      }

      if (axis !== 'v') return
      e.preventDefault()

      // Вверх — свободно; вниз — лёгкий резиновый оттяг
      if (rawY < 0) {
        dy = rawY
      } else {
        dy = Math.min(DOWN_RUBBER, rawY * 0.35)
      }

      const h = msg.offsetHeight || 48
      const fade =
        dy < 0 ? Math.max(0.25, 1 - Math.abs(dy) / (h * 1.4)) : 1
      msg.style.transform = `translate3d(0, ${dy}px, 0)`
      msg.style.opacity = String(fade)
    }

    function finishDismiss() {
      const out = -((msg.offsetHeight || 56) + 48)
      msg.classList.remove('p-toast-message--swiping')
      msg.classList.add('p-toast-message--swipe-out')
      msg.style.transition =
        'transform 180ms var(--app-ease), opacity 180ms var(--app-ease)'
      msg.style.transform = `translate3d(0, ${out}px, 0)`
      msg.style.opacity = '0'
      window.setTimeout(() => dismiss(msg), 180)
    }

    function onPointerUp(e: PointerEvent) {
      if (!tracking || pointerId !== e.pointerId) return
      tracking = false
      pointerId = null
      detachWindow()
      try {
        msg.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }

      if (axis !== 'v') {
        clearTransform(false)
        axis = null
        return
      }

      const dt = Math.max(16, performance.now() - startT)
      const up = Math.max(0, -dy)
      const velocity = up / dt
      const shouldDismiss = up >= DISMISS_PX || velocity >= DISMISS_VELOCITY

      if (!shouldDismiss) {
        clearTransform(true)
        axis = null
        dy = 0
        return
      }

      finishDismiss()
      axis = null
      dy = 0
    }

    function onPointerCancel(e: PointerEvent) {
      if (pointerId !== e.pointerId) return
      tracking = false
      pointerId = null
      axis = null
      dy = 0
      detachWindow()
      clearTransform(true)
    }

    msg.addEventListener('pointerdown', onPointerDown)
  }

  function scan() {
    document
      .querySelectorAll<HTMLElement>(
        '.p-toast:not(.ui-lab-toast-fixture) .p-toast-message',
      )
      .forEach(bind)
  }

  onMounted(() => {
    scan()
    observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })
}
