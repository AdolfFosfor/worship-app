<script setup lang="ts">
/**
 * Teleport в слот shell-header.
 * KeepAlive: disabled уводит контент со слота; сразу снимаем custom*,
 * иначе typed title остаётся v-show=false и хедер пустой.
 */
const props = defineProps<{
  to: '[data-app-header-title]' | '[data-app-header-subtitle]' | '[data-app-header-trailing]'
}>()

const pageActive = usePageActive()
const { clearCustomSlots } = useAppHeader()

watch(
  pageActive,
  (active) => {
    if (active) return
    if (props.to === '[data-app-header-title]') {
      clearCustomSlots({ title: true, subtitle: false })
    } else if (props.to === '[data-app-header-subtitle]') {
      clearCustomSlots({ title: false, subtitle: true })
    }
  },
  { flush: 'sync' },
)
</script>

<template>
  <Teleport
    defer
    :disabled="!pageActive"
    :to="to"
  >
    <slot />
  </Teleport>
</template>
