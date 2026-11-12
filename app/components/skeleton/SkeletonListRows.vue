<script setup lang="ts">
withDefaults(
  defineProps<{
    rows?: number
    /** С датой слева — как сет-листы */
    withDate?: boolean
  }>(),
  { rows: 6, withDate: false },
)

const { t } = useAppLocale()
</script>

<template>
  <div
    class="sk-list app-panel"
    role="status"
    aria-live="polite"
    :aria-label="t('common.loading')"
  >
    <div
      v-for="n in rows"
      :key="n"
      class="sk-list__row"
      :class="{ 'sk-list__row--date': withDate }"
      aria-hidden="true"
    >
      <div v-if="withDate" class="sk-list__date">
        <AppSkeleton variant="line" width="1.6rem" height="0.55rem" />
        <AppSkeleton width="1.5rem" height="1.15rem" />
      </div>
      <div class="sk-list__main">
        <AppSkeleton variant="line" :width="n % 2 === 0 ? '68%' : '52%'" height="0.85rem" />
        <AppSkeleton variant="line" width="38%" height="0.6rem" />
      </div>
      <AppSkeleton variant="circle" width="1.05rem" height="1.05rem" class="sk-list__chevron" />
    </div>
  </div>
</template>

<style scoped>
.sk-list {
  display: flex;
  flex-direction: column;
  padding: 0.15rem 0;
  overflow: hidden;
}

.sk-list__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--app-space-3);
  min-height: 3.35rem;
  padding: 0.65rem var(--app-space-4);
  border-bottom: 1px solid var(--app-border);
}

.sk-list__row:last-child {
  border-bottom: 0;
}

.sk-list__row--date {
  grid-template-columns: 2.75rem minmax(0, 1fr) auto;
}

.sk-list__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.sk-list__main {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.sk-list__chevron {
  opacity: 0.55;
}
</style>
