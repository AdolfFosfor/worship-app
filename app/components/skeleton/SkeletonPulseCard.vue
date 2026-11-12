<script setup lang="ts">
const { t } = useAppLocale()
</script>

<template>
  <div
    class="sk-pulse app-panel"
    role="status"
    aria-live="polite"
    :aria-label="t('common.loading')"
  >
    <AppSkeleton variant="pill" class="sk-pulse__period" width="6.5rem" />
    <div class="sk-pulse__head">
      <AppSkeleton variant="title" width="9rem" />
      <AppSkeleton variant="line" width="4.5rem" height="0.7rem" />
    </div>
    <div class="sk-pulse__metrics" aria-hidden="true">
      <div v-for="n in 3" :key="n" class="sk-pulse__metric">
        <AppSkeleton width="2.25rem" height="1.55rem" />
        <AppSkeleton variant="line" width="70%" height="0.55rem" />
      </div>
    </div>
    <div class="sk-pulse__favs" aria-hidden="true">
      <AppSkeleton variant="line" width="7rem" height="0.6rem" class="sk-pulse__favs-label" />
      <div v-for="n in 3" :key="n" class="sk-pulse__fav">
        <AppSkeleton variant="circle" />
        <div class="sk-pulse__fav-body">
          <div class="sk-pulse__fav-row">
            <AppSkeleton variant="line" width="62%" height="0.7rem" />
            <AppSkeleton variant="line" width="2rem" height="0.6rem" />
          </div>
          <AppSkeleton variant="line" width="100%" height="0.35rem" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sk-pulse {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
  padding: var(--app-space-4);
  min-height: 14rem;
}

.sk-pulse__period {
  align-self: flex-start;
}

.sk-pulse__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.sk-pulse__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.sk-pulse__metric {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
  padding: var(--app-space-3);
  border-radius: var(--app-radius);
  background: color-mix(in srgb, var(--app-ink) 3.5%, var(--app-surface));
}

.sk-pulse__favs {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.sk-pulse__favs-label {
  margin-bottom: 0.1rem;
}

.sk-pulse__fav {
  display: grid;
  grid-template-columns: 1.35rem minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem;
}

.sk-pulse__fav-body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.sk-pulse__fav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}
</style>
