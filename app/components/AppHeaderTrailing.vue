<script setup lang="ts">
/**
 * Trailing в shell-header через Teleport.
 * KeepAlive: без v-if по активности кнопки залипают или пропадают.
 * Без TransitionGroup/appear — стабильные кнопки не «въезжают» при каждом заходе.
 */
const pageActive = usePageActive()
</script>

<template>
  <Teleport
    v-if="pageActive"
    defer
    to="[data-app-header-trailing]"
  >
    <div class="app-header__trailing-inner">
      <slot />
    </div>
  </Teleport>
</template>
