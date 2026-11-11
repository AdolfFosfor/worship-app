/**
 * Pull-to-refresh на главном скролле shell.
 * Мягкий refetch (не reloadNuxtApp) — без лагов после обновления.
 * Не перехватывает зажатие/свайп строк списка.
 */

import { hasUiInteractionLock } from '~/utils/uiInteractionLocks'
import { runAppPullRefresh } from '~/composables/useAppPullRefresh'

const THRESHOLD = 68
const MAX_PULL = 112
const AXIS_LOCK = 14
/** Пока палец не ушёл вниз заметно — не трогаем scroll / preventDefault */
const ENGAGE_DY = 22
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
        '.swipe-delete',
        '.setlist-item',
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

  const progress = computed(() => Math.min(1, pull.value / THRESHOLD))
  const visible = computed(() => pull.value > 2 || refreshing.value)

  const contentStyle = computed(() => {
    const y = refreshing.value ? Math.min(pull.value, THRESHOLD) : pull.value
    if (!y) {
      return {
        transform: 'translate3d(0, 0, 0)',
        transition: dragging.value ? 'none' : 'transform 220ms var(--app-ease, ease)',
      }
    }
    return {
      transform: `translate3d(0, ${y}px, 0)`,
      transition: dragging.value ? 'none' : 'transform 220ms var(--app-ease, ease)',
    }
  })

  function resetPull() {
    tracking = false
    axis = null
    activeTouch = false
    blockedTarget = false
    dragging.value = false
    armed.value = false
    if (!refreshing.value) pull.value = 0
  }

  async function commitRefresh() {
    if (refreshing.value) return
    if (hasUiInteractionLock()) {
      resetPull()
      return
    }
    refreshing.value = true
    pull.value = THRESHOLD
    dragging.value = false
    armed.value = false
    useHaptics().impact('medium')

    try {
      await runAppPullRefresh()
    } finally {
      refreshing.value = false
      armed.value = false
      pull.value = 0
      tracking = false
      axis = null
      activeTouch = false
      blockedTarget = false
    }
  }

  function begin(clientX: number, clientY: number, target: EventTarget | null) {
    const el = scrollRef.value
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
      resetPull()
      return false
    }
    const dx = clientX - startX
    const dy = clientY - startY

    if (!axis) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return false
      axis = Math.abs(dy) > Math.abs(dx) * 1.25 ? 'v' : 'h'
      if (axis === 'h') {
        tracking = false
        return false
      }
      if (dy < ENGAGE_DY) {
        // Ещё не явный pull — отдаём жест скроллу / long-press
        return false
      }
      const el = scrollRef.value
      if (!el || el.scrollTop > 1 || hasUiInteractionLock()) {
        tracking = false
        return false
      }
      dragging.value = true
    }

    if (axis !== 'v') return false
    if (dy < ENGAGE_DY && !dragging.value) return false

    const next = rubber(Math.max(0, dy - ENGAGE_DY * 0.35))
    pull.value = next
    dragging.value = next > 0
    if (next >= THRESHOLD) {
      if (!armed.value) {
        armed.value = true
        useHaptics().tick()
      }
    } else {
      armed.value = false
    }
    // preventDefault только когда реально тянем refresh
    return next > 2
  }

  function end() {
    if (!tracking && !dragging.value) return
    tracking = false
    axis = null
    if (hasUiInteractionLock()) {
      dragging.value = false
      armed.value = false
      pull.value = 0
      return
    }
    const shouldRefresh = pull.value >= THRESHOLD && !refreshing.value
    dragging.value = false
    if (shouldRefresh) {
      void commitRefresh()
      return
    }
    armed.value = false
    pull.value = 0
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
      resetPull()
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
      pull.value = THRESHOLD
      return
    }
    resetPull()
  }

  let wheelArmed = false
  let wheelIdle: ReturnType<typeof setTimeout> | null = null

  function onWheel(e: WheelEvent) {
    if (refreshing.value || e.ctrlKey || activeTouch) return
    const el = scrollRef.value
    if (!el || el.scrollTop > 1 || hasUiInteractionLock()) {
      if (wheelArmed || dragging.value) resetPull()
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
    }

    e.preventDefault()
    pull.value = rubber(pull.value + pullDelta * 0.55)
    if (pull.value >= THRESHOLD) {
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
    const el = scrollRef.value
    if (el) unbind(el)
  })

  return reactive({
    pull,
    progress,
    visible,
    dragging,
    refreshing,
    armed,
    contentStyle,
  })
}
