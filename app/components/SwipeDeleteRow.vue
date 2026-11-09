<script setup lang="ts">
import { icons, type AppIconName } from '~/utils/icons'

/**
 * Горизонтальный свайп:
 * - влево (end) → удаление
 * - вправо (start) → доп. действие (например в сет-лист)
 * ПК: wheel / Shift+колёсико над строкой.
 */
const props = withDefaults(
  defineProps<{
    disabled?: boolean
    threshold?: number
    /** Свайп влево → commit (по умолчанию удаление) */
    endEnabled?: boolean
    /** Свайп вправо → start */
    startEnabled?: boolean
    endLabel?: string
    startLabel?: string
    endIcon?: AppIconName
    startIcon?: AppIconName
  }>(),
  {
    disabled: false,
    threshold: 72,
    endEnabled: true,
    startEnabled: false,
    endLabel: undefined,
    startLabel: undefined,
    endIcon: undefined,
    startIcon: undefined,
  },
)

const emit = defineEmits<{
  /** @deprecated используй end — оставлен для совместимости */
  commit: []
  end: []
  start: []
}>()

const { t } = useAppLocale()
const haptics = useHaptics()

/** >0 влево (удаление), <0 вправо (start) */
const offset = ref(0)
const dragging = ref(false)

let startX = 0
let startY = 0
let tracking = false
let axis: 'h' | 'v' | null = null
let armed: 'end' | 'start' | null = null
let moved = false
let wheelTracking = false
let wheelIdleTimer: ReturnType<typeof setTimeout> | null = null
const EDGE_GUARD = 28
const MAX = 104
const WHEEL_START = 6
const WHEEL_IDLE_MS = 90

const endLabelText = computed(() => props.endLabel ?? t('common.delete'))
const startLabelText = computed(() => props.startLabel ?? t('songs.addToSetShort'))
const endIconName = computed(() => props.endIcon ?? icons.trash)
const startIconName = computed(() => props.startIcon ?? icons.playlist)

const contentStyle = computed(() => ({
  transform: offset.value ? `translate3d(${-offset.value}px, 0, 0)` : undefined,
  transition: dragging.value ? 'none' : 'transform 220ms var(--app-ease)',
}))

const showEndAction = computed(() => offset.value > 0.5 || (dragging.value && offset.value >= 0))
const showStartAction = computed(() => offset.value < -0.5 || (dragging.value && offset.value <= 0))

function clearWheelIdle() {
  if (wheelIdleTimer !== null) {
    clearTimeout(wheelIdleTimer)
    wheelIdleTimer = null
  }
}

function reset() {
  tracking = false
  axis = null
  armed = null
  moved = false
  wheelTracking = false
  clearWheelIdle()
  dragging.value = false
  offset.value = 0
}

function clampSigned(next: number) {
  let v = next
  if (!props.endEnabled) v = Math.min(0, v)
  if (!props.startEnabled) v = Math.max(0, v)
  return v
}

function rubber(v: number) {
  const sign = v < 0 ? -1 : 1
  const abs = Math.abs(v)
  const soft = abs <= MAX ? abs : MAX + (abs - MAX) * 0.28
  return sign * soft
}

function applyOffset(next: number) {
  offset.value = rubber(clampSigned(next))
  const abs = Math.abs(offset.value)
  if (offset.value >= props.threshold) {
    if (armed !== 'end') {
      armed = 'end'
      haptics.tick()
    }
  } else if (offset.value <= -props.threshold) {
    if (armed !== 'start') {
      armed = 'start'
      haptics.tick()
    }
  } else if (armed && abs < props.threshold * 0.75) {
    armed = null
  }
}

function commitIfArmed() {
  const which =
    offset.value >= props.threshold
      ? 'end'
      : offset.value <= -props.threshold
        ? 'start'
        : null
  dragging.value = false
  wheelTracking = false
  tracking = false
  axis = null
  offset.value = 0
  armed = null
  if (which === 'end' && props.endEnabled) {
    haptics.warning()
    emit('end')
    emit('commit')
  } else if (which === 'start' && props.startEnabled) {
    haptics.impact('medium')
    emit('start')
  }
}

function onPointerDown(e: PointerEvent) {
  if (props.disabled || e.button !== 0) return
  if (e.clientX < EDGE_GUARD) return
  if (wheelTracking) return
  tracking = true
  axis = null
  armed = null
  moved = false
  startX = e.clientX
  startY = e.clientY
}

function onPointerMove(e: PointerEvent) {
  if (!tracking || props.disabled || wheelTracking) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY

  if (!axis) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
    axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'h' : 'v'
    if (axis === 'v') {
      tracking = false
      return
    }
    // dx < 0 → end (влево), dx > 0 → start (вправо)
    if (dx < 0 && !props.endEnabled) {
      tracking = false
      return
    }
    if (dx > 0 && !props.startEnabled) {
      tracking = false
      return
    }
    dragging.value = true
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  if (axis !== 'h') return
  e.preventDefault()
  moved = true
  // dx>0 → offset отрицательный (контент вправо)
  applyOffset(-dx)
}

function finish(e: PointerEvent) {
  if (!tracking && !dragging.value) return
  if (wheelTracking) return
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  tracking = false
  axis = null
  commitIfArmed()
}

function onClickCapture(e: MouseEvent) {
  if (!moved) return
  e.preventDefault()
  e.stopPropagation()
  moved = false
}

function onLostCapture() {
  if (dragging.value && !wheelTracking) reset()
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
    // Shift+вниз → влево (end); Shift+вверх → вправо (start)
    pull = -horizontal
    absX = Math.abs(horizontal)
    absY = 0
  } else {
    // Natural: палец влево → deltaX>0 → offset+ (end)
    pull = rawX
    absX = Math.abs(rawX)
    absY = Math.abs(rawY)
  }

  if (!wheelTracking) {
    if (absX < WHEEL_START || absY > absX * 1.25) return
    if (pull > 0 && !props.endEnabled) return
    if (pull < 0 && !props.startEnabled) return
    if (pull === 0) return
    wheelTracking = true
    dragging.value = true
    armed = null
  } else if (!e.shiftKey && absY > absX * 1.6 && Math.abs(offset.value) < props.threshold * 0.35) {
    reset()
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

onBeforeUnmount(() => {
  clearWheelIdle()
})

defineExpose({ reset })
</script>

<template>
  <div
    class="swipe-delete"
    :class="{
      'swipe-delete--disabled': disabled,
      'swipe-delete--dragging': dragging,
      'swipe-delete--armed-end': offset >= threshold,
      'swipe-delete--armed-start': offset <= -threshold,
    }"
    @wheel.capture="onWheel"
  >
    <div
      v-if="endEnabled"
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
      class="swipe-delete__content"
      :style="contentStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="finish"
      @pointercancel="finish"
      @lostpointercapture="onLostCapture"
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

.swipe-delete__content {
  position: relative;
  z-index: 1;
  border-radius: inherit;
  background: var(--app-surface);
}

.swipe-delete--dragging {
  touch-action: none;
}
</style>
