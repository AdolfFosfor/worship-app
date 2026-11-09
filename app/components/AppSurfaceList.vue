<template>
  <div class="app-surface-list">
    <slot />
  </div>
</template>

<style scoped>
.app-surface-list {
  overflow: hidden;
  border-radius: var(--app-radius-lg);
  background: var(--app-surface);
}

.app-surface-list :deep(.app-list-row:last-child)::after {
  display: none;
}
</style>
