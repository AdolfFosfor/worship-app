<script setup lang="ts">
import { pluralForm } from '~/utils/i18n/plural'

const props = withDefaults(
  defineProps<{
    songId: string
    count: number
    duration?: number
    /** Смена epoch = новый прогон анимации с нуля (главная / KeepAlive). */
    epoch?: number
  }>(),
  { duration: 1100, epoch: 0 },
)

const { t, locale } = useAppLocale()

const animated = useSmoothNumber(() => props.count, {
  duration: () => props.duration,
  cacheKey: () => `plays:${props.songId}:${props.epoch}`,
})

const label = computed(() => {
  const n = Math.round(animated.value)
  return t(`repertoire.playsCount_${pluralForm(n, locale.value)}`, { count: n })
})
</script>

<template>{{ label }}</template>
