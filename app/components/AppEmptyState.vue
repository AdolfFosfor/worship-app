<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="app-empty">
    <p class="app-empty__title">{{ title }}</p>
    <p v-if="description" class="app-empty__desc">{{ description }}</p>
    <div v-if="$slots.action" class="app-empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.app-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  padding: var(--app-space-6) var(--app-space-4);
  text-align: center;
  color: var(--app-muted);
}

.app-empty__title {
  margin: 0;
  font-size: var(--app-text-md);
  font-weight: 600;
  color: var(--app-ink);
}

.app-empty__desc {
  margin: 0;
  max-width: 16rem;
  font-size: var(--app-text-sm);
  line-height: 1.45;
}

.app-empty__action {
  margin-top: var(--app-space-3);
}
</style>
