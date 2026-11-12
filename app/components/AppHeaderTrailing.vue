<script setup lang="ts">
/**
 * Trailing в shell-header через Teleport.
 * KeepAlive: disabled, не v-if — иначе кнопки/title залипают в layout.
 */
const pageActive = usePageActive()
</script>

<template>
  <Teleport
    defer
    :disabled="!pageActive"
    to="[data-app-header-trailing]"
  >
    <div class="app-header__trailing-inner">
      <slot />
    </div>
  </Teleport>
</template>
