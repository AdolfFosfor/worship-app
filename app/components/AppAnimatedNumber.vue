<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    value: number
    /** мс */
    duration?: number
    cacheKey?: string
  }>(),
  { duration: 1100, cacheKey: undefined },
)

const animated = useSmoothNumber(() => props.value, {
  duration: () => props.duration,
  cacheKey: () => props.cacheKey,
})

const display = computed(() => Math.round(animated.value))
</script>

<template>{{ display }}</template>
