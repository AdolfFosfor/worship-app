<script setup lang="ts">
import { REPERTOIRE_THRESHOLDS } from '~~/shared/repertoire/thresholds'
import type { RepertoirePulseSummary } from '~~/shared/types'
import { icons } from '~/utils/icons'
import { periodLabelKey } from '~/utils/repertoire/period'

const props = defineProps<{
  summary: RepertoirePulseSummary
}>()

const { t } = useAppLocale()
const { period } = useRepertoirePulse()

/** Только RPC-подсказка, без пересчёта топа на клиенте. */
const frequent = computed(() =>
  props.summary.frequentHint.slice(0, REPERTOIRE_THRESHOLDS.homeFrequentHintLimit),
)

const topPlays = computed(() => frequent.value[0]?.total ?? 0)

const periodCaption = computed(() =>
  t('repertoire.forPeriod', { period: t(periodLabelKey(period.value)) }),
)

/** За всё время «новые» бессмысленны — не показываем. */
const showNewMetric = computed(() => period.value !== 'all')

function barWidth(plays: number) {
  if (topPlays.value <= 0 || plays <= 0) return 0
  return Math.round((plays / topPlays.value) * 100)
}

function songLink(id: string) {
  return `/repertoire/songs/${id}`
}
</script>

<template>
  <div class="pulse-card app-panel">
    <div class="pulse-card__head">
      <div class="pulse-card__titles">
        <h3 class="pulse-card__title">{{ t('repertoire.pulseTitle') }}</h3>
        <p class="pulse-card__period">{{ periodCaption }}</p>
      </div>
      <NuxtLink to="/repertoire" class="pulse-card__more app-press">
        {{ t('repertoire.more') }}
        <AppIcon :name="icons.chevronRight" size="0.95rem" />
      </NuxtLink>
    </div>

    <div
      class="pulse-card__metrics"
      :class="{ 'pulse-card__metrics--cols-2': !showNewMetric }"
      role="group"
      :aria-label="t('repertoire.sectionOverview')"
    >
      <NuxtLink
        to="/repertoire?section=all"
        class="pulse-card__metric pulse-card__metric--all app-press"
        :aria-label="`${summary.uniqueSongs} ${t('repertoire.metricUnique')}`"
      >
        <span class="pulse-card__value">{{ summary.uniqueSongs }}</span>
        <span class="pulse-card__label">{{ t('repertoire.metricUnique') }}</span>
      </NuxtLink>

      <NuxtLink
        v-if="showNewMetric"
        to="/repertoire?section=new"
        class="pulse-card__metric pulse-card__metric--new app-press"
        :aria-label="`${summary.newSongs} ${t('repertoire.metricNew')}`"
      >
        <span class="pulse-card__value">{{ summary.newSongs }}</span>
        <span class="pulse-card__label">{{ t('repertoire.metricNew') }}</span>
      </NuxtLink>

      <NuxtLink
        to="/repertoire?section=stale"
        class="pulse-card__metric pulse-card__metric--stale app-press"
        :aria-label="`${summary.staleCount} ${t('repertoire.metricStale')}`"
      >
        <span class="pulse-card__value">{{ summary.staleCount }}</span>
        <span class="pulse-card__label">{{ t('repertoire.metricStale') }}</span>
      </NuxtLink>
    </div>

    <div v-if="frequent.length" class="pulse-card__favorites">
      <span class="pulse-card__block-title">{{ t('repertoire.sectionFavorites') }}</span>
      <ul class="pulse-card__list">
        <li
          v-for="(item, index) in frequent"
          :key="item.id"
          class="pulse-card__fav"
          :class="{ 'pulse-card__fav--lead': index === 0 }"
        >
          <NuxtLink :to="songLink(item.id)" class="pulse-card__fav-link app-press">
            <span class="pulse-card__rank" aria-hidden="true">{{ index + 1 }}</span>
            <div class="pulse-card__fav-body">
              <div class="pulse-card__fav-row">
                <span class="pulse-card__fav-title">{{ item.title }}</span>
                <span class="pulse-card__fav-plays">
                  {{ t('repertoire.playsCount', { count: item.total }) }}
                </span>
              </div>
              <div
                class="pulse-card__bar"
                role="meter"
                :aria-valuenow="barWidth(item.total)"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="t('repertoire.playsCount', { count: item.total })"
              >
                <span
                  class="pulse-card__bar-fill"
                  :style="{ width: `${barWidth(item.total)}%` }"
                />
              </div>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </div>

    <p v-else-if="summary.executionCount === 0" class="pulse-card__hint">
      {{ t('repertoire.homeEmptyHint') }}
    </p>
  </div>
</template>

<style scoped>
.pulse-card {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
  padding: var(--app-space-4);
  min-width: 0;
  color: inherit;
}

.pulse-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.pulse-card__titles {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.pulse-card__title {
  margin: 0;
  font-size: var(--app-text-lg);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--app-ink);
}

.pulse-card__period {
  margin: 0;
  font-size: var(--app-text-xs);
  font-weight: 550;
  color: var(--app-muted);
}

.pulse-card__more {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
  margin-right: -0.25rem;
  padding: 0.15rem 0.25rem;
  border-radius: var(--app-radius-sm);
  font-size: var(--app-text-sm);
  font-weight: 600;
  color: var(--app-accent-text);
  text-decoration: none;
}

.pulse-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
  min-width: 0;
}

.pulse-card__metrics--cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pulse-card__metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-width: 0;
  min-height: 4.1rem;
  padding: 0.65rem 0.45rem;
  border-radius: var(--app-radius);
  text-align: center;
  text-decoration: none;
  color: inherit;
}

.pulse-card__metric--all,
.pulse-card__metric--new,
.pulse-card__metric--stale {
  background: var(--app-hover);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-border) 70%, transparent);
}

.pulse-card__metric--all .pulse-card__value {
  color: var(--app-ink);
}

.pulse-card__metric--all .pulse-card__label {
  color: var(--app-muted);
}

.pulse-card__metric--new .pulse-card__value {
  color: var(--app-accent-text);
}

.pulse-card__metric--new .pulse-card__label {
  color: var(--app-muted);
}

.pulse-card__metric--stale .pulse-card__value {
  color: var(--app-warn);
}

.pulse-card__metric--stale .pulse-card__label {
  color: var(--app-muted);
}

.pulse-card__value {
  font-size: var(--app-text-xl);
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.pulse-card__label {
  font-size: var(--app-text-2xs);
  font-weight: 600;
  line-height: 1.25;
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
  hyphens: auto;
}

.pulse-card__favorites {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.pulse-card__block-title {
  font-size: var(--app-text-2xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.pulse-card__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.pulse-card__fav-link {
  display: grid;
  grid-template-columns: 1.35rem minmax(0, 1fr);
  align-items: start;
  gap: 0.55rem;
  min-width: 0;
  margin: 0 -0.35rem;
  padding: 0.25rem 0.35rem;
  border-radius: var(--app-radius-sm);
  text-decoration: none;
  color: inherit;
}

.pulse-card__rank {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  margin-top: 0.05rem;
  border-radius: var(--app-radius-pill);
  font-size: var(--app-text-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--app-muted);
  background: var(--app-hover);
}

.pulse-card__fav--lead .pulse-card__rank {
  color: var(--app-accent-text);
  background: var(--app-accent-muted);
}

.pulse-card__fav-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.pulse-card__fav-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-width: 0;
}

.pulse-card__fav-title {
  min-width: 0;
  font-size: var(--app-text-sm);
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.25;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pulse-card__fav--lead .pulse-card__fav-title {
  font-weight: 700;
}

.pulse-card__fav-plays {
  flex-shrink: 0;
  font-size: var(--app-text-2xs);
  font-weight: 650;
  color: var(--app-muted);
  font-variant-numeric: tabular-nums;
}

.pulse-card__bar {
  height: 0.28rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  overflow: hidden;
}

.pulse-card__bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: color-mix(in srgb, var(--app-accent) 55%, var(--app-muted));
}

.pulse-card__fav--lead .pulse-card__bar-fill {
  background: var(--app-accent);
}

.pulse-card__hint {
  margin: 0;
  font-size: var(--app-text-sm);
  font-weight: 450;
  line-height: 1.35;
  color: var(--app-muted);
}

@media (max-width: 360px) {
  .pulse-card__metrics {
    gap: var(--app-space-1);
  }

  .pulse-card__metric {
    min-height: 3.75rem;
    padding: 0.55rem 0.3rem;
  }

  .pulse-card__value {
    font-size: var(--app-text-lg);
  }

  .pulse-card__label {
    font-size: 0.62rem;
  }
}
</style>
