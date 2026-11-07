<script setup lang="ts">
defineProps<{
  label?: string
}>()
</script>

<template>
  <div class="app-loading" role="status" aria-live="polite">
    <span class="app-loading__spinner" aria-hidden="true" />
    <span class="app-loading__label">{{ label ?? 'Загрузка…' }}</span>
  </div>
</template>

<style scoped>
.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-3);
  padding: var(--app-space-6);
  color: var(--app-muted);
  font-size: var(--app-text-sm);
}

.app-loading__spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid color-mix(in srgb, var(--app-accent) 25%, transparent);
  border-top-color: var(--app-accent);
  border-radius: 50%;
  animation: app-spin 0.7s linear infinite;
}

@keyframes app-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
