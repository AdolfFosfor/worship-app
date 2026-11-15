<script setup lang="ts">
/**
 * Teleport в слот shell-header.
 * KeepAlive: disabled (не v-if) уводит контент со слота без orphan DOM.
 * `active` — доп. флаг (reveal editable): тоже через disabled, иначе
 * уничтожение Teleport при ещё enabled залипает title в layout.
 */
const props = withDefaults(
  defineProps<{
    to: '[data-app-header-title]' | '[data-app-header-subtitle]' | '[data-app-header-trailing]'
    /** false → disabled Teleport (контент остаётся на странице, не в слоте). */
    active?: boolean
  }>(),
  { active: true },
)

const pageActive = usePageActive()
const { clearCustomSlots } = useAppHeader()

const portalEnabled = computed(() => pageActive.value && props.active !== false)

watch(
  portalEnabled,
  (enabled) => {
    if (enabled) return
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
    :disabled="!portalEnabled"
    :to="to"
  >
    <slot />
  </Teleport>
</template>
