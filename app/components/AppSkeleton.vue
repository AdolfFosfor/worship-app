<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Форма кости */
    variant?: 'line' | 'title' | 'pill' | 'circle' | 'block'
    width?: string
    height?: string
  }>(),
  {
    variant: 'line',
    width: undefined,
    height: undefined,
  },
)
</script>

<template>
  <span
    class="app-skeleton"
    :class="`app-skeleton--${variant}`"
    :style="{
      width: width || undefined,
      height: height || undefined,
    }"
    aria-hidden="true"
  />
</template>

<style scoped>
.app-skeleton {
  display: block;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  background: color-mix(in srgb, var(--app-ink) 7%, var(--app-surface));
  border-radius: var(--app-radius-sm);
}

.app-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--app-ink) 6%, transparent) 45%,
    transparent 100%
  );
  animation: app-skeleton-shimmer 1.35s ease-in-out infinite;
}

.app-skeleton--line {
  width: 100%;
  height: 0.75rem;
  border-radius: var(--app-radius-xs);
}

.app-skeleton--title {
  width: 55%;
  height: 1.15rem;
  border-radius: var(--app-radius-xs);
}

.app-skeleton--pill {
  width: 5.5rem;
  height: 1.65rem;
  border-radius: var(--app-radius-pill);
}

.app-skeleton--circle {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: var(--app-radius-pill);
}

.app-skeleton--block {
  width: 100%;
  height: 3.5rem;
  border-radius: var(--app-radius);
}

@keyframes app-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-skeleton::after {
    animation: none;
  }
}
</style>
