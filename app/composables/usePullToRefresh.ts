/**
 * Pull-to-refresh как в мобильных браузерах — на главном скролле shell.
 * Срабатывает только при scrollTop ≈ 0; не конфликтует с edge-swipe / оверлеями / drag.
 */

import { hasUiInteractionLock } from '~/utils/uiInteractionLocks'

const THRESHOLD = 68
const MAX_PULL = 112
const AXIS_LOCK = 10
const EDGE_GUARD = 22

function rubber(dy: number): number {
  if (dy <= 0) return 0
  if (dy <= MAX_PULL) return dy
  return MAX_PULL + (dy - MAX_PULL) * 0.22
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

    // Как «обновить» в браузере — полный reload с сохранением pinia/state где возможно
    await nextTick()
    try {
      await reloadNuxtApp({
        persistState: true,
        force: true,
      })
    } catch {
      if (import.meta.client) window.location.reload()
    }
  }

  function begin(clientX: number, clientY: number) {
    const el = scrollRef.value
    if (!el || refreshing.value || hasUiInteractionLock()) return
    if (el.scrollTop > 1) return
    if (clientX < EDGE_GUARD) return
    tracking = true
    axis = null
    startX = clientX
    startY = clientY
  }

  function move(clientX: number, clientY: number): boolean {
    if (!tracking || refreshing.value) return false
    // Drag/sheet начались уже во время pull — сразу гасим refresh
    if (hasUiInteractionLock()) {
      resetPull()
      return false
    }
    const dx = clientX - startX
    const dy = clientY - startY

    if (!axis) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return false
      axis = Math.abs(dy) > Math.abs(dx) * 1.15 ? 'v' : 'h'
      if (axis === 'h') {
        tracking = false
        return false
      }
      // тянем вниз от верха
      if (dy <= 0) {
        tracking = false
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
    const next = rubber(Math.max(0, dy))
    pull.value = next
    if (next >= THRESHOLD) {
      if (!armed.value) {
        armed.value = true
        useHaptics().tick()
      }
    } else {
      armed.value = false
    }
    return true
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
    begin(t.clientX, t.clientY)
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

  // ПК: wheel вниз у верха — тот же жест
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
    // тянем контент вниз = отрицательный deltaY на трекпаде «swipe down»… в браузерах
    // scroll up at top often gives negative deltaY. Pull-to-refresh = overscroll at top
    // when user scrolls "up" further (finger moves down) → deltaY < 0 in many browsers.
    if (dy >= 0 && !wheelArmed) return

    const pullDelta = dy < 0 ? -dy : 0
    if (!wheelArmed) {
      if (pullDelta < 4) return
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
