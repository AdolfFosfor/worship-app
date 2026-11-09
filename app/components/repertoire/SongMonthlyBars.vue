<script setup lang="ts">
import type { RepertoirePeriodKey } from '~~/shared/repertoire/thresholds'
import type { RepertoireMonthlyBucket } from '~~/shared/types'
import {
  fillMonthlyHistory,
  monthlyBarHeightPct,
  monthlySeriesMax,
} from '~/utils/repertoire/monthly'

const props = defineProps<{
  monthly: RepertoireMonthlyBucket[]
  period: RepertoirePeriodKey
  firstDate?: string | null
  locale?: string
}>()

const LOCALE_TAG: Record<string, string> = {
  ru: 'ru-RU',
  ro: 'ro-RO',
  en: 'en-GB',
}

const series = computed(() =>
  fillMonthlyHistory(props.monthly, props.period, {
    firstDate: props.firstDate,
  }),
)

const dataMax = computed(() => monthlySeriesMax(series.value))

const spansYears = computed(() => {
  const first = series.value[0]?.ym
  const last = series.value.at(-1)?.ym
  if (!first || !last) return false
  return first.slice(0, 4) !== last.slice(0, 4)
})

const compact = computed(() => series.value.length > 6)

const bars = computed(() =>
  series.value.map((row) => ({
    ym: row.ym,
    c: row.c,
    height: `${monthlyBarHeightPct(row.c, dataMax.value)}%`,
    label: formatMonthLabel(row.ym),
  })),
)

function formatMonthLabel(ym: string): string {
  const tag = LOCALE_TAG[props.locale ?? 'en'] ?? props.locale ?? 'en-GB'
  const date = new Date(`${ym}-01T12:00:00`)
  if (Number.isNaN(date.getTime())) return ym

  if (compact.value && spansYears.value) {
    const month = new Intl.DateTimeFormat(tag, { month: 'short' }).format(date)
    const year = String(date.getFullYear()).slice(2)
    return `${month.replace(/\.$/, '')}’${year}`
  }

  if (compact.value) {
    return new Intl.DateTimeFormat(tag, { month: 'short' }).format(date).replace(/\.$/, '')
  }

  return new Intl.DateTimeFormat(tag, { month: 'short' }).format(date)
}
</script>

<template>
  <div
    v-if="bars.length"
    class="month-bars"
    :class="{ 'month-bars--scroll': bars.length > 8 }"
    role="img"
    :aria-label="bars.map((b) => `${b.label}: ${b.c}`).join(', ')"
  >
    <div
      v-for="bar in bars"
      :key="bar.ym"
      class="month-bars__col"
      :aria-label="`${bar.label}: ${bar.c}`"
    >
      <span class="month-bars__value" :class="{ 'month-bars__value--empty': bar.c <= 0 }">
        {{ bar.c > 0 ? bar.c : '' }}
      </span>
      <div class="month-bars__track">
        <div
          v-if="bar.c > 0"
          class="month-bars__fill"
          :style="{ height: bar.height }"
        />
        <div v-else class="month-bars__zero" aria-hidden="true" />
      </div>
      <span class="month-bars__label">{{ bar.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.month-bars {
  display: flex;
  align-items: flex-end;
  gap: 0.3rem;
  min-height: 7.25rem;
  padding: var(--app-space-2) 0 0;
}

.month-bars--scroll {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 0.15rem;
}

.month-bars--scroll::-webkit-scrollbar {
  display: none;
}

.month-bars__col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  flex: 1 1 0;
  min-width: 0;
}

.month-bars--scroll .month-bars__col {
  flex: 0 0 2.1rem;
  min-width: 2.1rem;
}

.month-bars__value {
  min-height: 1rem;
  font-size: var(--app-text-2xs);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--app-ink);
}

.month-bars__value--empty {
  visibility: hidden;
}

.month-bars__track {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  max-width: 1.85rem;
  height: 4.5rem;
}

.month-bars__fill {
  width: 100%;
  border-radius: 0.3rem 0.3rem 0.15rem 0.15rem;
  background: var(--app-accent);
  min-height: 0;
}

.month-bars__zero {
  width: 100%;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--app-ink) 12%, transparent);
}

.month-bars__label {
  max-width: 100%;
  font-size: 0.62rem;
  font-weight: 600;
  line-height: 1.15;
  color: var(--app-muted);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

@media (max-width: 380px) {
  .month-bars--scroll .month-bars__col {
    flex-basis: 1.85rem;
    min-width: 1.85rem;
  }

  .month-bars__label {
    font-size: 0.55rem;
  }
}
</style>
