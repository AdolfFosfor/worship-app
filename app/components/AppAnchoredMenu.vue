<script setup lang="ts">
/**
 * Лёгкое меню у якоря внутри .app-shell.
 * Без PrimeVue Popover — позиция сразу с клампом (safe-area + pad), плавный enter/leave.
 */

const props = withDefaults(
  defineProps<{
    open: boolean
    /** aria-label для role=menu */
    label?: string
    /** Ширина панели, px */
    width?: number
    gap?: number
    pad?: number
  }>(),
  {
    label: undefined,
    width: 232,
    gap: 6,
    /** Отступ от края колонки .app-shell (+ safe-area). */
    pad: 12,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const panelRef = ref<HTMLElement | null>(null)
const pos = ref<{ top: number; left: number; width: number } | null>(null)
const anchorEl = shallowRef<HTMLElement | null>(null)

function cssPx(el: Element, name: string) {
  const raw = getComputedStyle(el).getPropertyValue(name).trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

function shellEl() {
  return document.querySelector<HTMLElement>('.app-shell')
}

function place(anchor: HTMLElement) {
  const shell = shellEl()
  const root = document.documentElement
  const fr = (shell ?? root).getBoundingClientRect()
  const safeL = Math.max(cssPx(root, '--app-safe-left'), cssPx(shell ?? root, '--app-safe-left'))
  const safeR = Math.max(cssPx(root, '--app-safe-right'), cssPx(shell ?? root, '--app-safe-right'))
  const padL = Math.max(props.pad, safeL)
  const padR = Math.max(props.pad, safeR)

  const maxW = Math.max(120, fr.width - padL - padR)
  const width = Math.min(props.width, maxW)

  const ar = anchor.getBoundingClientRect()
  let left = ar.right - width
  let top = ar.bottom + props.gap

  const minL = fr.left + padL
  const maxRight = fr.right - padR
  if (left + width > maxRight) left = maxRight - width
  if (left < minL) left = minL

  const maxBottom = fr.bottom - props.pad
  const estimatedH = panelRef.value?.offsetHeight || 120
  if (top + estimatedH > maxBottom) {
    const above = ar.top - props.gap - estimatedH
    if (above >= fr.top + props.pad) top = above
  }

  pos.value = {
    top: Math.round(top),
    left: Math.round(left),
    width: Math.round(width),
  }
}

function openAt(anchor: HTMLElement) {
  anchorEl.value = anchor
  place(anchor)
  emit('update:open', true)
  nextTick(() => {
    if (anchorEl.value) place(anchorEl.value)
  })
}

function close() {
  emit('update:open', false)
}

function toggle(event: Event) {
  const el = (event.currentTarget as HTMLElement | null) ?? (event.target as HTMLElement | null)
  if (!el) return
  if (props.open) {
    close()
    return
  }
  openAt(el)
}

function onPointerDown(event: PointerEvent) {
  if (!props.open) return
  const target = event.target as Node | null
  if (!target) return
  if (panelRef.value?.contains(target)) return
  if (anchorEl.value?.contains(target)) return
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}

function onReposition() {
  if (!props.open || !anchorEl.value) return
  place(anchorEl.value)
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      // оставляем pos до конца leave-анимации
      return
    }
    if (anchorEl.value) place(anchorEl.value)
  },
)

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onReposition)
  window.visualViewport?.addEventListener('resize', onReposition)
  window.visualViewport?.addEventListener('scroll', onReposition)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onReposition)
  window.visualViewport?.removeEventListener('resize', onReposition)
  window.visualViewport?.removeEventListener('scroll', onReposition)
})

defineExpose({ openAt, close, toggle })
</script>

<template>
  <Teleport to="body">
    <Transition name="app-anchored-menu">
      <div
        v-if="open && pos"
        ref="panelRef"
        class="app-anchored-menu"
        role="menu"
        :aria-label="label"
        :style="{
          top: `${pos.top}px`,
          left: `${pos.left}px`,
          width: `${pos.width}px`,
        }"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-anchored-menu {
  position: fixed;
  z-index: 1200;
  box-sizing: border-box;
  padding: 0.35rem;
  border: 0;
  border-radius: var(--app-radius-lg);
  background: var(--app-surface);
  color: var(--app-ink);
  box-shadow: var(--app-shadow-soft);
  transform-origin: top right;
  will-change: opacity, transform;
}

.app-anchored-menu-enter-active,
.app-anchored-menu-leave-active {
  transition:
    opacity 180ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 180ms cubic-bezier(0.32, 0.72, 0, 1);
}

.app-anchored-menu-enter-from,
.app-anchored-menu-leave-to {
  opacity: 0;
  transform: translate3d(0, -6px, 0) scale(0.96);
}

.app-anchored-menu-enter-to,
.app-anchored-menu-leave-from {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .app-anchored-menu-enter-active,
  .app-anchored-menu-leave-active {
    transition: none;
  }
}
</style>
