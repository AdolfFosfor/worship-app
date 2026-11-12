<script setup lang="ts">
/**
 * Teleport в слот shell-header с учётом KeepAlive.
 */
defineProps<{
  to: '[data-app-header-title]' | '[data-app-header-subtitle]' | '[data-app-header-trailing]'
}>()

const pageActive = usePageActive()
</script>

<template>
  <Teleport
    v-if="pageActive"
    defer
    :to="to"
  >
    <slot />
  </Teleport>
</template>
