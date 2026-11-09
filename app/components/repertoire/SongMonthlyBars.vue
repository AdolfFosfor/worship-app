<script setup lang="ts">
import type { RepertoireMonthlyBucket } from '~~/shared/types'

const props = defineProps<{
  monthly: RepertoireMonthlyBucket[]
}>()

const max = computed(() => Math.max(1, ...props.monthly.map((m) => m.c)))

const bars = computed(() => {
  // Последние 12 месяцев с данными или все, если меньше
  const rows = props.monthly.slice(-12)
  return rows.map((row) => ({
    ym: row.ym,
    c: row.c,
    height: `${Math.max(8, Math.round((row.c / max.value) * 100))}%`,
    label: row.ym.slice(2), // YY-MM compact
  }))
})
</script>

<template>
  <div v-if="bars.length" class="month-bars" role="img">
    <div v-for="bar in bars" :key="bar.ym" class="month-bars__col">
      <div class="month-bars__track">
        <div class="month-bars__fill" :style="{ height: bar.height }" :title="`${bar.ym}: ${bar.c}`" />
      </div>
      <span class="month-bars__label">{{ bar.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.month-bars {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
  min-height: 5.5rem;
  padding: var(--app-space-3) 0 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

.month-bars__col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  flex: 1 0 1.6rem;
  min-width: 1.4rem;
}

.month-bars__track {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 4rem;
  border-radius: 0.25rem;
  background: color-mix(in srgb, var(--app-ink) 6%, transparent);
  overflow: hidden;
}

.month-bars__fill {
  width: 100%;
  border-radius: 0.25rem 0.25rem 0 0;
  background: var(--app-accent);
  min-height: 0.25rem;
}

.month-bars__label {
  font-size: 0.55rem;
  font-weight: 600;
  color: var(--app-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
</style>
