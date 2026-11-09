<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    /** Плотнее в Dialog / узких панелях — меньше вертикальных отступов. */
    compact?: boolean
  }>(),
  { description: undefined, compact: false },
)
</script>

<template>
  <div class="app-empty" :class="{ 'app-empty--compact': compact }">
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
  align-items: stretch;
  justify-content: center;
  gap: var(--app-space-2);
  width: 100%;
  padding: var(--app-space-5) 0;
  text-align: center;
  color: var(--app-muted);
}

.app-empty--compact {
  gap: var(--app-space-1);
  padding: var(--app-space-2) 0 var(--app-space-1);
}

.app-empty__title {
  margin: 0;
  font-size: var(--app-text-lg);
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--app-ink);
}

.app-empty__desc {
  margin: 0;
  width: 100%;
  font-size: var(--app-text-sm);
  line-height: 1.45;
}

.app-empty__action {
  display: flex;
  justify-content: center;
  margin-top: var(--app-space-3);
}

.app-empty--compact .app-empty__action {
  margin-top: var(--app-space-6);
}
</style>