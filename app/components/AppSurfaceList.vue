<template>
  <div class="app-surface-list">
    <slot />
  </div>
</template>

<style scoped>
.app-surface-list {
  overflow: hidden;
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
}

.app-surface-list :deep(.app-list-row:last-child) {
  border-bottom: 0;
}
</style>
