<script setup lang="ts">
import { REPERTOIRE_THRESHOLDS } from '~~/shared/repertoire/thresholds'
import type { RepertoirePulseSummary } from '~~/shared/types'
import { icons } from '~/utils/icons'
import { filterStaleHints } from '~/utils/repertoire/status'
import { localTodayKey } from '~/utils/dates'

const props = defineProps<{
  summary: RepertoirePulseSummary
}>()

const { t } = useAppLocale()

const staleHints = computed(() =>
  filterStaleHints(props.summary.staleHint).slice(
    0,
    REPERTOIRE_THRESHOLDS.homeStaleHintLimit,
  ),
)

const staleText = computed(() => {
  if (!staleHints.value.length) return null
  const titles = staleHints.value.map((s) => s.title)
  if (titles.length === 1) {
    return t('repertoire.staleHintOne', { title: titles[0] })
  }
  return t('repertoire.staleHintMany', {
    titles: titles.join(', '),
  })
})

const calendarTo = computed(() => props.summary.to || localTodayKey())
</script>

<template>
  <NuxtLink to="/repertoire" class="pulse-card app-panel app-press">
    <div class="pulse-card__head">
      <div class="pulse-card__metrics">
        <div class="pulse-card__metric">
          <span class="pulse-card__value">{{ summary.executionCount }}</span>
          <span class="pulse-card__label">{{ t('repertoire.metricPlays') }}</span>
        </div>
        <div class="pulse-card__metric">
          <span class="pulse-card__value">{{ summary.uniqueSongs }}</span>
          <span class="pulse-card__label">{{ t('repertoire.metricUnique') }}</span>
        </div>
        <div class="pulse-card__metric">
          <span class="pulse-card__value">{{ summary.newSongs }}</span>
          <span class="pulse-card__label">{{ t('repertoire.metricNew') }}</span>
        </div>
      </div>
      <span class="pulse-card__more">
        {{ t('repertoire.more') }}
        <AppIcon :name="icons.chevronRight" size="0.95rem" />
      </span>
    </div>

    <ContributionCalendar
      class="pulse-card__cal"
      :from="summary.from"
      :to="calendarTo"
      :activity="summary.activity"
      compact
      :interactive="false"
    />

    <p v-if="staleText" class="pulse-card__hint">{{ staleText }}</p>
    <p v-else-if="summary.executionCount === 0" class="pulse-card__hint">
      {{ t('repertoire.homeEmptyHint') }}
    </p>
  </NuxtLink>
</template>

<style scoped>
.pulse-card {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
  text-decoration: none;
  color: inherit;
}

.pulse-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.pulse-card__more {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  flex-shrink: 0;
  margin-top: 0.15rem;
  font-size: var(--app-text-sm);
  font-weight: 600;
  color: var(--app-accent-text);
}

.pulse-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
  flex: 1;
  min-width: 0;
}

.pulse-card__metric {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.pulse-card__value {
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--app-ink);
  font-variant-numeric: tabular-nums;
}

.pulse-card__label {
  font-size: var(--app-text-2xs);
  font-weight: 550;
  color: var(--app-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pulse-card__cal {
  margin-inline: -0.1rem;
}

.pulse-card__hint {
  margin: 0;
  font-size: var(--app-text-sm);
  font-weight: 450;
  line-height: 1.35;
  color: var(--app-muted);
}
</style>
