/**
 * iOS-like edge-swipe назад: контент уезжает вправо с сопротивлением,
 * снизу параллакс «предыдущего» экрана.
 * На ПК: трекпад (deltaX) и Shift+колёсико мыши как горизонтальный жест.
 */

import { hasUiInteractionLock } from '~/utils/uiInteractionLocks'

const EDGE_PX = 24
const COMMIT_PX = 72
const COMMIT_RATIO = 0.22
const FLICK_VELOCITY = 0.55 // px/ms
const WHEEL_IDLE_MS = 90
const WHEEL_START_PX = 6
const WHEEL_FLICK = 1.05
const MAX_DRAG_RATIO = 0.96
const UNDERLAY_PARALLAX = 0.22
const SETTLE_MS = 320
const COMMIT_MS = 280
const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)'

/** Корневые вкладки — свайп назад не нужен. */
const ROOT_PATHS = new Set(['/', '/songs', '/setlists', '/account'])

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Горизонтальные скроллеры / свайп-строки — жест «назад» не перехватывает. */
function isHorizontalGestureRegion(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      '.swipe-delete, .month-bars--scroll, .app-chip-row, [data-h-scroll]',
    ),
  )
}

function hasBlockingOverlay(): boolean {
  return hasUiInteractionLock()
}

/** Сопротивление: сначала почти 1:1, ближе к краю — тяжелее. */
function resist(dx: number, width: number): number {
  const max = width * MAX_DRAG_RATIO
  const x = Math.max(0, Math.min(dx, max * 1.15))
  const t = Math.min(1, x / max)
  return max * (1 - (1 - t) ** 1.45)
}

function preferReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useEdgeSwipeBack(shellRef: Ref<HTMLElement | null>) {
  const route = useRoute()
  /** Фуллскрин аккордов — листание сет-листа, не «назад» */
  const stageFullscreen = useState('chord-stage-fullscreen', () => false)

  const swiping = ref(false)
  const progressing = ref(false)

  const canSwipeBack = computed(
    () =>
      !ROOT_PATHS.has(route.path) &&
      !route.path.endsWith('/edit') &&
      !stageFullscreen.value,
  )

  function navigateBack() {
    navigateAppBack()
  }

  let detach: (() => void) | null = null
  let settleTimer: ReturnType<typeof setTimeout> | null = null

  onMounted(() => {
    const shell = shellRef.value
    if (!shell) {
      return
    }

    const layer = shell.querySelector<HTMLElement>('.app-shell__swipe-layer')
    const underlay = shell.querySelector<HTMLElement>(
      '.app-shell__swipe-underlay',
    )
    const shade = shell.querySelector<HTMLElement>('.app-shell__swipe-shade')
    if (!layer) {
      return
    }

    let active = false
    let tracking = false
    let settling = false
    let offset = 0
    let startX = 0
    let startY = 0
    let lastX = 0
    let lastT = 0
    let velocity = 0
    let raf = 0
    let pendingOffset = 0
    let paintScheduled = false

    let wheelTracking = false
    let wheelVelocity = 0
    let lastWheelT = 0
    let wheelIdleTimer: ReturnType<typeof setTimeout> | null = null

    const clearWheelIdle = () => {
      if (wheelIdleTimer !== null) {
        clearTimeout(wheelIdleTimer)
        wheelIdleTimer = null
      }
    }

    const clearSettleTimer = () => {
      if (settleTimer !== null) {
        clearTimeout(settleTimer)
        settleTimer = null
      }
    }

    const widthOf = () => shell.clientWidth || window.innerWidth

    const paint = (x: number, withTransition: boolean, durationMs = SETTLE_MS) => {
      const width = widthOf()
      const progress = Math.min(1, x / Math.max(width * MAX_DRAG_RATIO, 1))
      const transition = withTransition
        ? `transform ${durationMs}ms ${EASE_OUT}, box-shadow ${durationMs}ms ${EASE_OUT}`
        : 'none'
      const shadeTransition = withTransition
        ? `opacity ${durationMs}ms ${EASE_OUT}`
        : 'none'
      const underlayTransition = withTransition
        ? `transform ${durationMs}ms ${EASE_OUT}, opacity ${durationMs}ms ${EASE_OUT}`
        : 'none'

      layer.style.transition = transition
      layer.style.transform = x > 0.5 ? `translate3d(${x}px, 0, 0)` : ''
      layer.style.boxShadow =
        x > 0.5
          ? `${-10 - progress * 8}px 0 ${28 + progress * 20}px color-mix(in srgb, #000 ${14 + progress * 16}%, transparent)`
          : ''
      layer.style.borderRadius = x > 8 ? '0 12px 12px 0' : ''

      if (underlay) {
        const underX = -width * UNDERLAY_PARALLAX * (1 - progress)
        const scale = 0.94 + progress * 0.06
        underlay.style.transition = underlayTransition
        underlay.style.opacity = x > 0.5 ? '1' : '0'
        underlay.style.transform =
          x > 0.5
            ? `translate3d(${underX}px, 0, 0) scale(${scale})`
            : 'translate3d(-8%, 0, 0) scale(0.94)'
      }

      if (shade) {
        shade.style.transition = shadeTransition
        // Обычный фон + лёгкое затемнение поверх
        shade.style.opacity = x > 0.5 ? String(0.18 - progress * 0.06) : '0'
      }
    }

    const schedulePaint = (x: number) => {
      pendingOffset = x
      if (paintScheduled) {
        return
      }
      paintScheduled = true
      raf = window.requestAnimationFrame(() => {
        paintScheduled = false
        paint(pendingOffset, false)
      })
    }

    const hardResetVisual = () => {
      offset = 0
      layer.style.transition = 'none'
      layer.style.transform = ''
      layer.style.boxShadow = ''
      layer.style.borderRadius = ''
      if (underlay) {
        underlay.style.transition = 'none'
        underlay.style.transform = 'translate3d(-8%, 0, 0) scale(0.94)'
        underlay.style.opacity = '0'
      }
      if (shade) {
        shade.style.transition = 'none'
        shade.style.opacity = '0'
      }
    }

    const finishIdle = () => {
      settling = false
      swiping.value = false
      progressing.value = false
    }

    const reset = (animate: boolean) => {
      active = false
      tracking = false
      wheelTracking = false
      wheelVelocity = 0
      clearWheelIdle()
      clearSettleTimer()

      if (!animate || preferReducedMotion() || offset < 1) {
        hardResetVisual()
        finishIdle()
        return
      }

      settling = true
      swiping.value = false
      progressing.value = true
      paint(0, true, SETTLE_MS)
      offset = 0
      settleTimer = setTimeout(() => {
        settleTimer = null
        hardResetVisual()
        finishIdle()
      }, SETTLE_MS + 20)
    }

    const commitBack = () => {
      active = false
      tracking = false
      wheelTracking = false
      wheelVelocity = 0
      clearWheelIdle()
      clearSettleTimer()

      const width = widthOf()
      const remaining = Math.max(0, width - offset)
      const duration = preferReducedMotion()
        ? 0
        : Math.max(
            160,
            Math.min(COMMIT_MS, remaining / Math.max(velocity * 1000, 900) * 1000),
          )

      settling = true
      swiping.value = false
      progressing.value = true

      const finish = () => {
        // Прячем слой на кадр смены роута — иначе старая страница
        // мелькает по центру до замены keepalive-контента.
        layer.style.visibility = 'hidden'
        hardResetVisual()
        finishIdle()
        navigateBack()
        requestAnimationFrame(() => {
          layer.style.visibility = ''
        })
      }

      if (duration <= 0) {
        finish()
        return
      }

      paint(width, true, duration)
      offset = width
      settleTimer = setTimeout(() => {
        settleTimer = null
        finish()
      }, duration + 16)
    }

    const settleGesture = (flick: number) => {
      const width = widthOf()
      const shouldCommit =
        offset >= Math.max(COMMIT_PX, width * COMMIT_RATIO) ||
        flick >= FLICK_VELOCITY

      if (shouldCommit) {
        commitBack()
        return
      }
      reset(true)
    }

    const onStart = (event: TouchEvent) => {
      if (
        !canSwipeBack.value ||
        hasBlockingOverlay() ||
        settling ||
        event.touches.length !== 1
      ) {
        return
      }
      if (
        isEditableTarget(event.target) ||
        isHorizontalGestureRegion(event.target) ||
        wheelTracking
      ) {
        return
      }

      const touch = event.touches[0]
      if (!touch) {
        return
      }

      const rect = shell.getBoundingClientRect()
      if (touch.clientX - rect.left > EDGE_PX) {
        return
      }

      active = true
      tracking = false
      startX = touch.clientX
      startY = touch.clientY
      lastX = touch.clientX
      lastT = event.timeStamp
      velocity = 0
    }

    const onMove = (event: TouchEvent) => {
      if (!active || settling || event.touches.length !== 1) {
        return
      }
      const touch = event.touches[0]
      if (!touch) {
        return
      }

      const dx = touch.clientX - startX
      const dy = touch.clientY - startY

      if (!tracking) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
          return
        }
        if (Math.abs(dy) > Math.abs(dx) || dx < 0) {
          active = false
          return
        }
        tracking = true
        swiping.value = true
        progressing.value = true
        clearSettleTimer()
        layer.style.transition = 'none'
        if (underlay) {
          underlay.style.transition = 'none'
        }
        if (shade) {
          shade.style.transition = 'none'
        }
      }

      event.preventDefault()

      const dt = Math.max(1, event.timeStamp - lastT)
      velocity = (touch.clientX - lastX) / dt
      lastX = touch.clientX
      lastT = event.timeStamp

      offset = resist(dx, widthOf())
      schedulePaint(offset)
    }

    const onEnd = () => {
      if (!active) {
        return
      }
      if (!tracking) {
        reset(false)
        return
      }
      active = false
      tracking = false
      settleGesture(velocity)
    }

    const onCancel = () => {
      if (settling) {
        return
      }
      reset(true)
    }

    const onWheel = (event: WheelEvent) => {
      if (
        !canSwipeBack.value ||
        hasBlockingOverlay() ||
        active ||
        settling
      ) {
        return
      }
      // Pinch-zoom / page zoom
      if (event.ctrlKey) {
        return
      }
      if (isEditableTarget(event.target)) {
        return
      }
      // Горизонтальный скролл / свайп-удаление — не уводить назад
      if (isHorizontalGestureRegion(event.target)) {
        return
      }

      // LINE/PAGE → грубо в пиксели, чтобы жест работал и на мышиных колёсах
      const scale =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? widthOf()
            : 1
      const rawX = event.deltaX * scale
      const rawY = event.deltaY * scale

      // Shift+колёсико = горизонтальный жест (браузер кладёт в deltaX или оставляет deltaY).
      // Трекпад без Shift: natural scroll, палец вправо → deltaX < 0 → экран вправо.
      let pull: number
      let absX: number
      let absY: number
      if (event.shiftKey) {
        const horizontal = Math.abs(rawX) >= Math.abs(rawY) ? rawX : rawY
        pull = horizontal
        absX = Math.abs(horizontal)
        absY = 0
      } else {
        pull = -rawX
        absX = Math.abs(rawX)
        absY = Math.abs(rawY)
      }

      if (!wheelTracking) {
        if (absX < WHEEL_START_PX || absY > absX * 1.25 || pull <= 0) {
          return
        }
        wheelTracking = true
        swiping.value = true
        progressing.value = true
        lastWheelT = event.timeStamp
        wheelVelocity = 0
        clearSettleTimer()
        layer.style.transition = 'none'
        if (underlay) {
          underlay.style.transition = 'none'
        }
        if (shade) {
          shade.style.transition = 'none'
        }
      } else if (
        !event.shiftKey &&
        absY > absX * 1.6 &&
        offset < COMMIT_PX * 0.35
      ) {
        reset(true)
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const dt = Math.max(1, event.timeStamp - lastWheelT)
      wheelVelocity = pull / dt
      lastWheelT = event.timeStamp

      const width = widthOf()
      offset = resist(offset + pull, width)
      schedulePaint(offset)

      clearWheelIdle()
      wheelIdleTimer = setTimeout(() => {
        wheelIdleTimer = null
        if (!wheelTracking) {
          return
        }
        const flick =
          wheelVelocity >= WHEEL_FLICK ? FLICK_VELOCITY : wheelVelocity
        wheelTracking = false
        settleGesture(flick)
      }, WHEEL_IDLE_MS)
    }

    const onRouteDone = () => {
      // Страница уже новая — только подчистить визуал без анимации.
      clearSettleTimer()
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      paintScheduled = false
      active = false
      tracking = false
      wheelTracking = false
      hardResetVisual()
      finishIdle()
    }

    const stopWatch = watch(
      () => route.fullPath,
      () => {
        onRouteDone()
      },
    )

    shell.addEventListener('touchstart', onStart, { passive: true })
    shell.addEventListener('touchmove', onMove, { passive: false })
    shell.addEventListener('touchend', onEnd)
    shell.addEventListener('touchcancel', onCancel)
    // capture: жест «назад» работает и над списками / горизонтальными скроллами
    shell.addEventListener('wheel', onWheel, { passive: false, capture: true })

    detach = () => {
      stopWatch()
      shell.removeEventListener('touchstart', onStart)
      shell.removeEventListener('touchmove', onMove)
      shell.removeEventListener('touchend', onEnd)
      shell.removeEventListener('touchcancel', onCancel)
      shell.removeEventListener('wheel', onWheel, true)
      clearWheelIdle()
      clearSettleTimer()
      if (raf) {
        cancelAnimationFrame(raf)
      }
    }
  })

  onUnmounted(() => {
    detach?.()
    detach = null
  })

  return {
    swiping,
    progressing,
  }
}
