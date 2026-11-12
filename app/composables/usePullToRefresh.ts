/**
 * Pull-to-refresh на главном скролле shell.
 * Мягкий refetch (не reloadNuxtApp).
 * Transform пишем в DOM напрямую — без Vue-реактивности на каждый touchmove (длинные списки).
 */

import { hasUiInteractionLock } from '~/utils/uiInteractionLocks'
import { runAppPullRefresh } from '~/composables/useAppPullRefresh'

const THRESHOLD = 68
const MAX_PULL = 112
const AXIS_LOCK = 12
/** Пока палец не ушёл вниз заметно — не трогаем scroll / preventDefault */
const ENGAGE_DY = 28
const EDGE_GUARD = 22

function rubber(dy: number): number {
  if (dy <= 0) return 0
  if (dy <= MAX_PULL) return dy
  return MAX_PULL + (dy - MAX_PULL) * 0.22
}

function isPtrBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      [
        /* Не .swipe-delete: вертикальный PTR с карточки должен работать;
           горизонталь отдаём свайпу через axis-lock + swipe-delete--dragging */
        '[data-no-ptr]',
        '[data-haptic-drag]',
        '.chart-editor',
        'input',
        'textarea',
        'select',
        '[contenteditable="true"]',
      ].join(', '),
    ),
  )
}

export function usePullToRefresh(scrollRef: Ref<HTMLElement | null>) {
  const pull = ref(0)
  const dragging = ref(false)
  const refreshing = ref(false)
  const armed = ref(false)

  let startX = 0
  let startY = 0
  let tracking = false
  let axis: 'h' | 'v' | null = null
  let activeTouch = false
  let blockedTarget = false
  let pullPx = 0
  let rafVisual = 0
  let pendingVisual = false

  const progress = computed(() => Math.min(1, pull.value / THRESHOLD))
  const visible = computed(() => pull.value > 2 || refreshing.value)

  function scrollEl() {
    return scrollRef.value
  }

  function writeTransform(y: number, withTransition: boolean) {
    const el = scrollEl()
    if (!el) return
    if (y > 0.5) {
      el.style.transform = `translate3d(0, ${y}px, 0)`
    } else {
      el.style.transform = 'translate3d(0, 0, 0)'
    }
    el.style.transition = withTransition
      ? 'transform 220ms var(--app-ease, ease)'
      : 'none'
  }

  function scheduleVisual() {
    if (pendingVisual) return
    pendingVisual = true
    rafVisual = requestAnimationFrame(() => {
      pendingVisual = false
      rafVisual = 0
      pull.value = pullPx
      writeTransform(
        refreshing.value ? Math.min(pullPx, THRESHOLD) : pullPx,
        false,
      )
    })
  }

  function setPull(next: number, opts?: { immediate?: boolean; transition?: boolean }) {
    pullPx = Math.max(0, next)
    if (opts?.immediate) {
      if (rafVisual) cancelAnimationFrame(rafVisual)
      pendingVisual = false
      rafVisual = 0
      pull.value = pullPx
      writeTransform(
        refreshing.value ? Math.min(pullPx, THRESHOLD) : pullPx,
        Boolean(opts.transition),
      )
      return
    }
    scheduleVisual()
  }

  function resetPull(opts?: { transition?: boolean }) {
    tracking = false
    axis = null
    activeTouch = false
    blockedTarget = false
    dragging.value = false
    armed.value = false
    if (!refreshing.value) {
      setPull(0, { immediate: true, transition: opts?.transition ?? true })
    }
  }

  async function commitRefresh() {
    if (refreshing.value) return
    if (hasUiInteractionLock()) {
      resetPull({ transition: true })
      return
    }
    refreshing.value = true
    setPull(THRESHOLD, { immediate: true, transition: true })
    dragging.value = false
    armed.value = false
    useHaptics().impact('medium')

    try {
      await runAppPullRefresh()
    } finally {
      refreshing.value = false
      armed.value = false
      tracking = false
      axis = null
      activeTouch = false
      blockedTarget = false
      dragging.value = false
      setPull(0, { immediate: true, transition: true })
    }
  }

  function begin(clientX: number, clientY: number, target: EventTarget | null) {
    const el = scrollEl()
    if (!el || refreshing.value || hasUiInteractionLock()) return
    if (el.scrollTop > 1) return
    if (clientX < EDGE_GUARD) return
    if (isPtrBlockedTarget(target)) {
      blockedTarget = true
      return
    }
    blockedTarget = false
    tracking = true
    axis = null
    startX = clientX
    startY = clientY
  }

  function move(clientX: number, clientY: number): boolean {
    if (blockedTarget || !tracking || refreshing.value) return false
    if (hasUiInteractionLock()) {
      resetPull({ transition: true })
      return false
    }
    const dx = clientX - startX
    const dy = clientY - startY

    if (!axis) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return false
      // Горизонталь → свайп карточки / edge-back; PTR не претендует
      if (Math.abs(dx) >= Math.abs(dy) * 0.85) {
        tracking = false
        axis = 'h'
        return false
      }
      if (dy < ENGAGE_DY) return false
      const el = scrollEl()
      if (!el || el.scrollTop > 1 || hasUiInteractionLock()) {
        tracking = false
        return false
      }
      axis = 'v'
      dragging.value = true
      el.classList.add('app-shell__content--ptr')
    }

    if (axis !== 'v') return false

    // Во время PTR горизонтальный увод — отдаём жест (открытый свайп и т.п.)
    if (Math.abs(dx) > Math.abs(dy) * 0.9 && pullPx < THRESHOLD * 0.45) {
      resetPull({ transition: true })
      return false
    }

    const next = rubber(Math.max(0, dy - ENGAGE_DY * 0.35))
    setPull(next)
    dragging.value = next > 0
    if (next >= THRESHOLD) {
      if (!armed.value) {
        armed.value = true
        useHaptics().tick()
      }
    } else {
      armed.value = false
    }
    return next > 2
  }

  function end() {
    if (!tracking && !dragging.value) return
    tracking = false
    axis = null
    const el = scrollEl()
    el?.classList.remove('app-shell__content--ptr')
    if (hasUiInteractionLock()) {
      dragging.value = false
      armed.value = false
      setPull(0, { immediate: true, transition: true })
      return
    }
    const shouldRefresh = pullPx >= THRESHOLD && !refreshing.value
    dragging.value = false
    if (shouldRefresh) {
      void commitRefresh()
      return
    }
    armed.value = false
    setPull(0, { immediate: true, transition: true })
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    if (!t) return
    activeTouch = true
    begin(t.clientX, t.clientY, e.target)
  }

  function onTouchMove(e: TouchEvent) {
    if (!activeTouch || e.touches.length !== 1) {
      resetPull({ transition: true })
      return
    }
    const t = e.touches[0]
    if (!t) return
    if (move(t.clientX, t.clientY)) {
      e.preventDefault()
    }
  }

  function onTouchEnd() {
    if (!activeTouch) return
    activeTouch = false
    end()
  }

  function onTouchCancel() {
    activeTouch = false
    if (refreshing.value) {
      dragging.value = false
      setPull(THRESHOLD, { immediate: true, transition: false })
      return
    }
    resetPull({ transition: true })
  }

  let wheelArmed = false
  let wheelIdle: ReturnType<typeof setTimeout> | null = null

  function onWheel(e: WheelEvent) {
    if (refreshing.value || e.ctrlKey || activeTouch) return
    const el = scrollEl()
    if (!el || el.scrollTop > 1 || hasUiInteractionLock()) {
      if (wheelArmed || dragging.value) resetPull({ transition: true })
      return
    }

    const scale =
      e.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? 400
          : 1
    const dy = e.deltaY * scale
    if (dy >= 0 && !wheelArmed) return

    const pullDelta = dy < 0 ? -dy : 0
    if (!wheelArmed) {
      if (pullDelta < 8) return
      wheelArmed = true
      dragging.value = true
      el.classList.add('app-shell__content--ptr')
    }

    e.preventDefault()
    setPull(rubber(pullPx + pullDelta * 0.55), { immediate: true })
    if (pullPx >= THRESHOLD) {
      if (!armed.value) {
        armed.value = true
        useHaptics().tick()
      }
    } else {
      armed.value = false
    }

    if (wheelIdle) clearTimeout(wheelIdle)
    wheelIdle = setTimeout(() => {
      wheelIdle = null
      wheelArmed = false
      end()
    }, 100)
  }

  function bind(el: HTMLElement) {
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchCancel)
    el.addEventListener('wheel', onWheel, { passive: false })
  }

  function unbind(el: HTMLElement) {
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchCancel)
    el.removeEventListener('wheel', onWheel)
    el.classList.remove('app-shell__content--ptr')
    el.style.transform = ''
    el.style.transition = ''
  }

  watch(
    scrollRef,
    (el, prev) => {
      if (prev) unbind(prev)
      if (el) bind(el)
    },
    { flush: 'post' },
  )

  onBeforeUnmount(() => {
    if (wheelIdle) clearTimeout(wheelIdle)
    if (rafVisual) cancelAnimationFrame(rafVisual)
    const el = scrollEl()
    if (el) unbind(el)
  })

  return reactive({
    pull,
    progress,
    visible,
    dragging,
    refreshing,
    armed,
  })
}
