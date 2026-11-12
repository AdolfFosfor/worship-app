<script setup lang="ts">
const { t } = useAppLocale()
</script>

<template>
  <div
    class="sk-hero app-panel app-panel--accent"
    role="status"
    aria-live="polite"
    :aria-label="t('common.loading')"
  >
    <div class="sk-hero__top">
      <div class="sk-hero__pills">
        <AppSkeleton variant="pill" width="7rem" />
        <AppSkeleton variant="pill" width="4.5rem" />
      </div>
      <AppSkeleton variant="title" width="70%" height="1.35rem" />
    </div>
    <div class="sk-hero__songs" aria-hidden="true">
      <AppSkeleton v-for="n in 4" :key="n" variant="pill" width="5.25rem" />
    </div>
  </div>
</template>

<style scoped>
.sk-hero {
  overflow: hidden;
  min-height: 8.5rem;
}

.sk-hero__top {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--app-space-2);
  padding: var(--app-space-5);
  padding-bottom: var(--app-space-3);
  padding-right: 2.5rem;
}

.sk-hero__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.sk-hero__songs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0 var(--app-space-5) var(--app-space-5);
}
</style>
