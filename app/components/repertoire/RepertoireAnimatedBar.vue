<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { pulseBarCache } from '~/utils/repertoire/pulseAnimCache'

const props = withDefaults(
  defineProps<{
    songId: string
    percent: number
    lead?: boolean
    /** Смена epoch = новый прогон анимации с нуля (главная / KeepAlive). */
    epoch?: number
  }>(),
  { lead: false, epoch: 0 },
)

const reduced = usePreferredReducedMotion()
const ready = ref(false)

function clamp(n: number) {
  return Math.max(0, Math.min(100, n))
}

function barCacheKey(songId: string, epoch: number) {
  return `${songId}:${epoch}`
}

/** Без кэша — с 0, чтобы первая загрузка морфила полоску как при смене периода. */
const shown = ref(clamp(pulseBarCache.get(barCacheKey(props.songId, props.epoch)) ?? 0))

function persist(n: number) {
  pulseBarCache.set(barCacheKey(props.songId, props.epoch), n)
}

function applyTarget(n: number) {
  shown.value = clamp(n)
  persist(shown.value)
}

watch(
  () => props.percent,
  (n) => {
    if (!ready.value) return
    applyTarget(n)
  },
)

watch(
  () => [props.songId, props.epoch] as const,
  ([id, epoch], prev) => {
    if (prev) pulseBarCache.set(barCacheKey(prev[0], prev[1]), shown.value)
    shown.value = clamp(pulseBarCache.get(barCacheKey(id, epoch)) ?? 0)
    if (ready.value) applyTarget(props.percent)
  },
)

onMounted(() => {
  if (reduced.value === 'reduce') {
    ready.value = true
    applyTarget(props.percent)
    return
  }

  const needsMorph = Math.abs(shown.value - props.percent) > 0.05
  if (!needsMorph) {
    ready.value = true
    persist(shown.value)
    return
  }

  // Двойной rAF: сначала кадр без transition, потом цель — плавный morph с кэша.
  requestAnimationFrame(() => {
    ready.value = true
    requestAnimationFrame(() => applyTarget(props.percent))
  })
})

onBeforeUnmount(() => {
  persist(shown.value)
})

const scale = computed(() => shown.value / 100)
</script>

<template>
  <span
    class="pulse-anim-bar"
    :class="{
      'pulse-anim-bar--lead': lead,
      'pulse-anim-bar--ready': ready && reduced !== 'reduce',
    }"
    :style="{ transform: `scaleX(${scale})` }"
  />
</template>

<style scoped>
.pulse-anim-bar {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: color-mix(in srgb, var(--app-accent) 55%, var(--app-muted));
  transform-origin: left center;
  will-change: transform;
}

.pulse-anim-bar--lead {
  background: var(--app-accent);
}

.pulse-anim-bar--ready {
  transition: transform 1.1s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .pulse-anim-bar--ready {
    transition: none;
  }
}
</style>
