<script setup lang="ts">
const { t } = useAppLocale()
</script>

<template>
  <div
    class="sk-overview app-panel"
    role="status"
    aria-live="polite"
    :aria-label="t('common.loading')"
  >
    <div class="sk-overview__metrics" aria-hidden="true">
      <div v-for="n in 3" :key="n" class="sk-overview__metric">
        <AppSkeleton width="2.5rem" height="1.7rem" />
        <AppSkeleton variant="line" width="65%" height="0.55rem" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sk-overview {
  padding: var(--app-space-4);
}

.sk-overview__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.sk-overview__metric {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
  padding: var(--app-space-3);
  border-radius: var(--app-radius);
  background: color-mix(in srgb, var(--app-ink) 3.5%, var(--app-surface));
}
</style>
