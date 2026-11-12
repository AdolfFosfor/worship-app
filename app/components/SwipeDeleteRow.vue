<script setup lang="ts">
import { icons, type AppIconName } from '~/utils/icons'

export type SwipeActionTone = 'danger' | 'accent' | 'neutral'

export type SwipeAction = {
  id: string
  label: string
  icon?: AppIconName
  tone?: SwipeActionTone
}

/**
 * Горизонтальный свайп:
 * - влево (end) → удаление (commit) или панель кнопок (endActions, как в Telegram)
 * - вправо (start) → доп. действие
 * ПК: wheel / Shift+колёсико над строкой.
 * Мобилка: non-passive touchmove, иначе браузер скроллит и рвёт жест.
 */
const props = withDefaults(
  defineProps<{
    disabled?: boolean
    threshold?: number
    /** Свайп влево → commit (по умолчанию удаление). Игнор., если заданы endActions. */
    endEnabled?: boolean
    /** Свайп вправо → start */
    startEnabled?: boolean
    endLabel?: string
    startLabel?: string
    endIcon?: AppIconName
    startIcon?: AppIconName
    /**
     * Несколько кнопок справа (Telegram-style): свайп открывает панель,
     * действие срабатывает по тапу. Отключает auto-commit влево.
     */
    endActions?: SwipeAction[]
  }>(),
  {
    disabled: false,
    threshold: 64,
    endEnabled: true,
    startEnabled: false,
    endLabel: undefined,
    startLabel: undefined,
    endIcon: undefined,
    startIcon: undefined,
    endActions: undefined,
  },
)

const emit = defineEmits<{
  /** @deprecated используй end — оставлен для совместимости */
  commit: []
  end: []
  start: []
  action: [id: string]
}>()

const { t } = useAppLocale()
const haptics = useHaptics()

/** >0 влево (удаление), <0 вправо (start) */
const offset = ref(0)
const dragging = ref(false)
const open = ref(false)
/** Пока жест горизонтальный/ещё определяется — PTR и edge-swipe на паузе */
const trackingUi = ref(false)
const contentEl = ref<HTMLElement | null>(null)

let startX = 0
let startY = 0
let tracking = false
let axis: 'h' | 'v' | null = null
let armed: 'end' | 'start' | null = null
let moved = false
let activePointerId: number | null = null
let wheelTracking = false
let wheelIdleTimer: ReturnType<typeof setTimeout> | null = null
const EDGE_GUARD = 22
const AXIS_LOCK = 8
const WHEEL_START = 6
const WHEEL_IDLE_MS = 90
const ACTION_BTN_WIDTH = 88
const COMMIT_MAX = 104

const revealMode = computed(() => (props.endActions?.length ?? 0) > 0)
const revealActions = computed(() => props.endActions ?? [])
const revealWidth = computed(() => {
  const n = revealActions.value.length
  if (!n) return 0
  return n * ACTION_BTN_WIDTH + 8
})
const endSideEnabled = computed(() =>
  revealMode.value ? true : props.endEnabled,
)
const maxPull = computed(() =>
  revealMode.value ? Math.max(revealWidth.value + 28, COMMIT_MAX) : COMMIT_MAX,
)
const snapThreshold = computed(() =>
  revealMode.value
    ? Math.min(props.threshold, revealWidth.value * 0.45)
    : props.threshold,
)

const endLabelText = computed(() => props.endLabel ?? t('common.delete'))
const startLabelText = computed(() => props.startLabel ?? t('songs.addToSetShort'))
const endIconName = computed(() => props.endIcon ?? icons.trash)
const startIconName = computed(() => props.startIcon ?? icons.playlist)

const contentStyle = computed(() => ({
  transform: offset.value ? `translate3d(${-offset.value}px, 0, 0)` : undefined,
  transition: dragging.value ? 'none' : 'transform 220ms var(--app-ease)',
}))

const showEndAction = computed(
  () =>
    !revealMode.value
    && (offset.value > 0.5 || (dragging.value && offset.value >= 0)),
)
const showStartAction = computed(
  () => offset.value < -0.5 || (dragging.value && offset.value <= 0),
)
const showRevealPanel = computed(
  () =>
    revealMode.value
    && (offset.value > 0.5 || open.value || (dragging.value && offset.value >= 0)),
)

function clearWheelIdle() {
  if (wheelIdleTimer !== null) {
    clearTimeout(wheelIdleTimer)
    wheelIdleTimer = null
  }
}

function reset() {
  tracking = false
  trackingUi.value = false
  axis = null
  armed = null
  moved = false
  activePointerId = null
  wheelTracking = false
  clearWheelIdle()
  dragging.value = false
  open.value = false
  offset.value = 0
}

function snapOpen() {
  tracking = false
  trackingUi.value = false
  axis = null
  armed = null
  activePointerId = null
  wheelTracking = false
  clearWheelIdle()
  dragging.value = false
  open.value = true
  offset.value = revealWidth.value
  haptics.tick()
}

function clampSigned(next: number) {
  let v = next
  if (!endSideEnabled.value) v = Math.min(0, v)
  if (!props.startEnabled) v = Math.max(0, v)
  return v
}

function rubber(v: number) {
  const sign = v < 0 ? -1 : 1
  const abs = Math.abs(v)
  const cap = maxPull.value
  const soft = abs <= cap ? abs : cap + (abs - cap) * 0.28
  return sign * soft
}

function applyOffset(next: number) {
  offset.value = rubber(clampSigned(next))
  const abs = Math.abs(offset.value)
  const thr = snapThreshold.value
  if (offset.value >= thr) {
    if (armed !== 'end') {
      armed = 'end'
      haptics.tick()
    }
  } else if (offset.value <= -thr) {
    if (armed !== 'start') {
      armed = 'start'
      haptics.tick()
    }
  } else if (armed && abs < thr * 0.75) {
    armed = null
  }
}

function commitIfArmed() {
  const thr = snapThreshold.value
  const which =
    offset.value >= thr
      ? 'end'
      : offset.value <= -thr
        ? 'start'
        : null
  dragging.value = false
  wheelTracking = false
  tracking = false
  trackingUi.value = false
  axis = null
  activePointerId = null
  armed = null

  if (which === 'end' && endSideEnabled.value) {
    if (revealMode.value) {
      snapOpen()
      return
    }
    offset.value = 0
    open.value = false
    haptics.warning()
    emit('end')
    emit('commit')
    return
  }

  if (which === 'start' && props.startEnabled) {
    offset.value = 0
    open.value = false
    haptics.impact('medium')
    emit('start')
    return
  }

  // Ниже порога: если уже были открыты — закрыть; иначе дотянуть к 0
  if (revealMode.value && open.value && offset.value > revealWidth.value * 0.55) {
    snapOpen()
    return
  }
  open.value = false
  offset.value = 0
}

function beginTrack(clientX: number, clientY: number) {
  tracking = true
  trackingUi.value = true
  axis = null
  armed = null
  moved = false
  // Учитываем текущий сдвиг (открытая панель), чтобы жест продолжался от неё
  startX = clientX + offset.value
  startY = clientY
}

function moveTrack(clientX: number, clientY: number): boolean {
  if (!tracking || props.disabled || wheelTracking) return false
  const dx = clientX - startX
  const dy = clientY - startY

  if (!axis) {
    if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return false
    axis = Math.abs(dx) > Math.abs(dy) * 1.1 ? 'h' : 'v'
    if (axis === 'v') {
      tracking = false
      trackingUi.value = false
      return false
    }
    if (dx < 0 && !endSideEnabled.value && !open.value) {
      tracking = false
      trackingUi.value = false
      return false
    }
    if (dx > 0 && !props.startEnabled && !open.value) {
      tracking = false
      trackingUi.value = false
      return false
    }
    dragging.value = true
  }

  if (axis !== 'h') return false
  moved = true
  applyOffset(-dx)
  return true
}

function endTrack() {
  if (!tracking && !dragging.value) return
  if (wheelTracking) return
  tracking = false
  trackingUi.value = false
  axis = null
  commitIfArmed()
}

function onPointerDown(e: PointerEvent) {
  if (props.disabled || e.button !== 0) return
  if (e.clientX < EDGE_GUARD && !open.value) return
  if (wheelTracking) return
  // Touch ведём через touch* (passive: false) — иначе iOS скроллит и шлёт pointercancel
  if (e.pointerType === 'touch') return
  activePointerId = e.pointerId
  beginTrack(e.clientX, e.clientY)
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  if (activePointerId != null && e.pointerId !== activePointerId) return
  if (!moveTrack(e.clientX, e.clientY)) return
  e.preventDefault()
  if (dragging.value && contentEl.value) {
    try {
      contentEl.value.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  if (activePointerId != null && e.pointerId !== activePointerId) return
  if (contentEl.value) {
    try {
      contentEl.value.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }
  endTrack()
}

function onPointerCancel(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  reset()
}

function onTouchStart(e: TouchEvent) {
  if (props.disabled || wheelTracking) return
  if (e.touches.length !== 1) return
  const touch = e.touches[0]
  if (!touch) return
  if (touch.clientX < EDGE_GUARD && !open.value) return
  beginTrack(touch.clientX, touch.clientY)
}

function onTouchMove(e: TouchEvent) {
  if (!tracking || props.disabled || wheelTracking) return
  if (e.touches.length !== 1) {
    reset()
    return
  }
  const touch = e.touches[0]
  if (!touch) return
  if (moveTrack(touch.clientX, touch.clientY)) {
    e.preventDefault()
  }
}

function onTouchEnd() {
  endTrack()
}

function onTouchCancel() {
  // Браузер перехватил жест — просто откат, без ложного commit
  if (dragging.value || tracking) {
    if (open.value) {
      tracking = false
      trackingUi.value = false
      axis = null
      dragging.value = false
      offset.value = revealWidth.value
    } else {
      reset()
    }
  }
}

function onClickCapture(e: MouseEvent) {
  if (moved) {
    e.preventDefault()
    e.stopPropagation()
    moved = false
    return
  }
  if (open.value) {
    e.preventDefault()
    e.stopPropagation()
    reset()
  }
}

function onActionClick(id: string) {
  if (props.disabled) return
  haptics.impact('medium')
  emit('action', id)
  reset()
}

function onWheel(e: WheelEvent) {
  if (props.disabled || e.ctrlKey || tracking) return

  const scale =
    e.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? 400
        : 1
  const rawX = e.deltaX * scale
  const rawY = e.deltaY * scale

  let pull: number
  let absX: number
  let absY: number
  if (e.shiftKey) {
    const horizontal = Math.abs(rawX) >= Math.abs(rawY) ? rawX : rawY
    pull = -horizontal
    absX = Math.abs(horizontal)
    absY = 0
  } else {
    pull = rawX
    absX = Math.abs(rawX)
    absY = Math.abs(rawY)
  }

  if (!wheelTracking) {
    if (absX < WHEEL_START || absY > absX * 1.25) return
    if (pull > 0 && !endSideEnabled.value && !open.value) return
    if (pull < 0 && !props.startEnabled && !open.value) return
    if (pull === 0) return
    wheelTracking = true
    dragging.value = true
    armed = null
  } else if (!e.shiftKey && absY > absX * 1.6 && Math.abs(offset.value) < snapThreshold.value * 0.35) {
    if (open.value) {
      wheelTracking = false
      dragging.value = false
      offset.value = revealWidth.value
    } else {
      reset()
    }
    return
  }

  e.preventDefault()
  e.stopPropagation()

  applyOffset(offset.value + pull)

  clearWheelIdle()
  wheelIdleTimer = setTimeout(() => {
    wheelIdleTimer = null
    if (!wheelTracking) return
    commitIfArmed()
  }, WHEEL_IDLE_MS)
}

watch(
  () => props.disabled,
  (next) => {
    if (next) reset()
  },
)

onMounted(() => {
  const el = contentEl.value
  if (!el) return
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  el.addEventListener('touchend', onTouchEnd)
  el.addEventListener('touchcancel', onTouchCancel)
})

onBeforeUnmount(() => {
  clearWheelIdle()
  const el = contentEl.value
  if (!el) return
  el.removeEventListener('touchstart', onTouchStart)
  el.removeEventListener('touchmove', onTouchMove)
  el.removeEventListener('touchend', onTouchEnd)
  el.removeEventListener('touchcancel', onTouchCancel)
})

defineExpose({ reset })
</script>

<template>
  <div
    class="swipe-delete"
    :class="{
      'swipe-delete--disabled': disabled,
      'swipe-delete--tracking': trackingUi,
      'swipe-delete--dragging': dragging,
      'swipe-delete--open': open,
      'swipe-delete--reveal': revealMode,
      'swipe-delete--armed-end': offset >= snapThreshold,
      'swipe-delete--armed-start': offset <= -snapThreshold,
    }"
    @wheel.capture="onWheel"
  >
    <div
      v-if="revealMode"
      class="swipe-delete__panel swipe-delete__panel--end"
      :class="{ 'swipe-delete__panel--on': showRevealPanel }"
      :style="{ width: `${revealWidth}px` }"
    >
      <button
        v-for="action in revealActions"
        :key="action.id"
        type="button"
        class="swipe-delete__btn"
        :class="`swipe-delete__btn--${action.tone ?? 'neutral'}`"
        :aria-label="action.label"
        @click.stop="onActionClick(action.id)"
      >
        <AppIcon :name="action.icon ?? icons.copy" size="1.15rem" />
        <span>{{ action.label }}</span>
      </button>
    </div>
    <div
      v-else-if="endEnabled"
      class="swipe-delete__action swipe-delete__action--end"
      :class="{ 'swipe-delete__action--on': showEndAction }"
      aria-hidden="true"
    >
      <AppIcon :name="endIconName" size="1.15rem" />
      <span>{{ endLabelText }}</span>
    </div>
    <div
      v-if="startEnabled"
      class="swipe-delete__action swipe-delete__action--start"
      :class="{ 'swipe-delete__action--on': showStartAction }"
      aria-hidden="true"
    >
      <AppIcon :name="startIconName" size="1.15rem" />
      <span>{{ startLabelText }}</span>
    </div>
    <div
      ref="contentEl"
      class="swipe-delete__content"
      :style="contentStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @click.capture="onClickCapture"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.swipe-delete {
  position: relative;
  overflow: hidden;
  border-radius: inherit;
  touch-action: pan-y;
  background: var(--app-surface);
  isolation: isolate;
}

.swipe-delete--disabled {
  touch-action: auto;
}

.swipe-delete__action {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  box-sizing: border-box;
  min-width: 6.5rem;
  width: 42%;
  max-width: 10rem;
  color: #fff;
  font-size: var(--app-text-sm);
  font-weight: 650;
  letter-spacing: -0.01em;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
}

.swipe-delete__action--end {
  left: auto;
  right: 0;
  justify-content: flex-end;
  padding-left: var(--app-space-4);
  padding-right: calc(var(--app-space-6) + var(--app-safe-right));
  background: var(--app-destructive);
}

.swipe-delete__action--start {
  right: auto;
  left: 0;
  justify-content: flex-start;
  padding-right: var(--app-space-4);
  padding-left: calc(var(--app-space-6) + var(--app-safe-left));
  background: var(--app-accent);
  color: var(--app-accent-contrast);
}

.swipe-delete__action--on {
  opacity: 1;
  visibility: visible;
}

.swipe-delete__panel {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 0;
  display: flex;
  align-items: stretch;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.swipe-delete__panel--end {
  right: 0;
}

.swipe-delete__panel--on {
  opacity: 1;
  visibility: visible;
}

.swipe-delete--open .swipe-delete__panel {
  pointer-events: auto;
}

.swipe-delete__btn {
  flex: 1 1 0;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  box-sizing: border-box;
  min-width: 0;
  margin: 0;
  padding: 0.45rem 0.7rem;
  border: 0;
  color: #fff;
  font: inherit;
  font-size: var(--app-text-xs);
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.15;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.swipe-delete__btn--danger {
  background: var(--app-destructive);
}

.swipe-delete__btn--accent {
  background: var(--app-accent);
  color: var(--app-accent-contrast);
}

.swipe-delete__btn--neutral {
  background: color-mix(in srgb, var(--app-muted) 55%, #64748b);
  color: #fff;
}

.swipe-delete__content {
  position: relative;
  z-index: 1;
  border-radius: inherit;
  background: var(--app-surface);
  /* Нужен для non-passive touchmove + блокировки вертикального скролла после lock */
  touch-action: pan-y;
}

.swipe-delete--dragging,
.swipe-delete--dragging .swipe-delete__content {
  touch-action: none;
}
</style>
