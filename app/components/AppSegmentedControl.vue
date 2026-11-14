<script setup lang="ts" generic="T extends string">
export type SegmentOption<V extends string = string> = {
  value: V
  label: string
}

const props = defineProps<{
  modelValue: T
  options: SegmentOption<T>[]
  ariaLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()

const rootEl = ref<HTMLElement | null>(null)
const thumbX = ref(0)
const thumbW = ref(0)
const thumbReady = ref(false)

let resizeObserver: ResizeObserver | null = null

function measure() {
  const root = rootEl.value
  if (!root) return
  const idx = props.options.findIndex((o) => o.value === props.modelValue)
  const items = root.querySelectorAll<HTMLElement>('[data-seg-item]')
  const btn = items[idx] ?? null
  if (!btn) {
    thumbReady.value = false
    return
  }
  const rootRect = root.getBoundingClientRect()
  const btnRect = btn.getBoundingClientRect()
  thumbX.value = btnRect.left - rootRect.left
  thumbW.value = btnRect.width
  thumbReady.value = true
}

function select(value: T) {
  if (value === props.modelValue) return
  emit('update:modelValue', value)
}

watch(
  () => [props.modelValue, props.options.map((o) => o.value).join('|'), props.options.map((o) => o.label).join('|')] as const,
  async () => {
    await nextTick()
    measure()
  },
  { flush: 'post' },
)

onMounted(async () => {
  await nextTick()
  measure()
  if (!rootEl.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => measure())
  resizeObserver.observe(rootEl.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <div
    ref="rootEl"
    class="app-seg"
    role="radiogroup"
    :aria-label="ariaLabel"
    :style="{ '--seg-cols': String(options.length) }"
  >
    <span
      class="app-seg__thumb"
      :class="{ 'app-seg__thumb--ready': thumbReady }"
      :style="{
        width: `${thumbW}px`,
        transform: `translateX(${thumbX}px)`,
      }"
      aria-hidden="true"
    />
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="app-seg__item"
      :class="{ 'app-seg__item--on': modelValue === opt.value }"
      data-seg-item
      role="radio"
      :aria-checked="modelValue === opt.value"
      @click="select(opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.app-seg {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--seg-cols, 2), minmax(0, 1fr));
  gap: 0.28rem;
  padding: 0.22rem;
  border-radius: var(--app-radius-lg);
  background: var(--app-hover);
}

.app-seg__thumb {
  position: absolute;
  top: 0.22rem;
  bottom: 0.22rem;
  left: 0;
  z-index: 0;
  border-radius: var(--app-radius);
  background: var(--app-surface);
  box-shadow: var(--app-shadow-soft);
  opacity: 0;
  pointer-events: none;
  will-change: transform, width;
}

.app-seg__thumb--ready {
  opacity: 1;
  transition:
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
    width 280ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 120ms ease;
}

.app-seg__item {
  position: relative;
  z-index: 1;
  min-height: 1.9rem;
  padding: 0.2rem 0.2rem;
  border: 0;
  border-radius: var(--app-radius);
  background: transparent;
  color: var(--app-muted);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.15;
  text-align: center;
  white-space: normal;
  cursor: pointer;
  transition: color 180ms ease;
}

.app-seg__item--on {
  color: var(--app-ink);
}

@media (prefers-reduced-motion: reduce) {
  .app-seg__thumb--ready {
    transition: none;
  }
}
</style>
