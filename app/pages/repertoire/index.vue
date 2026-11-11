<script setup lang="ts">
import { REPERTOIRE_THRESHOLDS, type RepertoirePeriodKey } from '~~/shared/repertoire/thresholds'
import type { RepertoireSongSort, RepertoireSongStat } from '~~/shared/types'
import { icons } from '~/utils/icons'
import { REPERTOIRE_PERIODS, periodLabelKey } from '~/utils/repertoire/period'
import { isStaleSong, staleTierOf } from '~/utils/repertoire/status'

const { t } = useAppLocale()
const route = useRoute()
const {
  summary,
  songs,
  period,
  loadingSummary,
  loadingSongs,
  error,
  fetchSummary,
  fetchSongs,
  setPeriod,
} = useRepertoirePulse()
const { syncRepertoireOnActivate } = useRepertoirePulseRevision()

const pageReady = ref(Boolean(summary.value && songs.value))
const expandFrequent = ref(false)
const expandStale = ref(false)
const expandNew = ref(false)
const allQuery = ref('')
const allSort = ref<RepertoireSongSort>('plays')

function sectionIdFromKey(section: unknown) {
  if (section === 'stale') return 'repertoire-stale'
  if (section === 'new') return 'repertoire-new'
  if (section === 'all') return 'repertoire-all'
  return null
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function focusSectionFromQuery() {
  const id = sectionIdFromKey(route.query.section)
  if (!id) return
  nextTick(() => scrollToSection(id))
}

const preview = REPERTOIRE_THRESHOLDS.sectionPreviewLimit
const rangeFrom = computed(() => summary.value?.from ?? '')
const rangeTo = computed(() => summary.value?.to ?? '')

/** За всё время «новые» бессмысленны — не показываем. */
const showNewMetric = computed(() => period.value !== 'all')

const overviewMetricCount = computed(() => 2 + (showNewMetric.value ? 1 : 0))

const frequentAll = computed(() =>
  (songs.value ?? [])
    .filter((s) => s.executionCount > 0)
    .slice()
    .sort((a, b) => b.executionCount - a.executionCount || a.title.localeCompare(b.title)),
)

const frequent = computed(() =>
  expandFrequent.value ? frequentAll.value : frequentAll.value.slice(0, preview),
)

const frequentMaxPlays = computed(() => frequentAll.value[0]?.executionCount ?? 0)

const staleAll = computed(() =>
  (songs.value ?? [])
    .filter((s) => isStaleSong(s))
    .slice()
    .sort((a, b) => a.lastDate.localeCompare(b.lastDate) || a.title.localeCompare(b.title)),
)

const stale = computed(() =>
  expandStale.value ? staleAll.value : staleAll.value.slice(0, preview),
)

const newestAll = computed(() => {
  if (!showNewMetric.value) return []
  return (songs.value ?? [])
    .filter((s) => s.isNewInPeriod)
    .slice()
    .sort((a, b) => b.firstDate.localeCompare(a.firstDate) || b.executionCount - a.executionCount)
})

const newest = computed(() =>
  expandNew.value ? newestAll.value : newestAll.value.slice(0, preview),
)

const repertoireAll = computed(() => {
  const q = allQuery.value.trim().toLowerCase()
  let rows = (songs.value ?? []).slice()
  if (q) rows = rows.filter((s) => s.title.toLowerCase().includes(q))
  rows.sort((a, b) => compareSongs(a, b, allSort.value))
  return rows
})

function compareSongs(a: RepertoireSongStat, b: RepertoireSongStat, sort: RepertoireSongSort) {
  switch (sort) {
    case 'plays':
      return b.totalAll - a.totalAll || a.title.localeCompare(b.title)
    case 'last':
      return b.lastDate.localeCompare(a.lastDate) || a.title.localeCompare(b.title)
    case 'first':
      return a.firstDate.localeCompare(b.firstDate) || a.title.localeCompare(b.title)
    case 'title':
      return a.title.localeCompare(b.title)
    default:
      return 0
  }
}

function staleBadge(song: RepertoireSongStat) {
  const tier = staleTierOf(song)
  if (!tier) return undefined
  return t(`repertoire.staleTier.${tier}`)
}

async function load(opts?: { quiet?: boolean }) {
  if (!opts?.quiet && !summary.value) pageReady.value = false
  try {
    await Promise.all([
      fetchSummary({ force: true, period: period.value }),
      fetchSongs({ force: true, period: period.value }),
    ])
    markRepertoireSynced()
  } catch {
    /* error in composable */
  } finally {
    pageReady.value = true
  }
}

async function onPeriod(next: RepertoirePeriodKey) {
  if (next === period.value) return
  pageReady.value = false
  try {
    await setPeriod(next)
    markRepertoireSynced()
  } catch {
    /* */
  } finally {
    pageReady.value = true
  }
}

const { markRepertoireSynced } = syncRepertoireOnActivate(() => load({ quiet: true }))
useAppPullRefresh(() => load({ quiet: true }))

watch(
  [pageReady, () => route.query.section],
  ([ready]) => {
    if (ready) focusSectionFromQuery()
  },
  { immediate: true },
)

onMounted(() => {
  void load()
})

const sortOptions = computed(() =>
  (['plays', 'last', 'first', 'title'] as RepertoireSongSort[]).map((value) => ({
    value,
    label: t(`repertoire.sort.${value}`),
  })),
)
</script>

<template>
  <div class="app-page">
    <AppHeader
      :title="t('repertoire.title')"
      :subtitle="t(periodLabelKey(period))"
    />

    <div class="pulse-periods" role="tablist" :aria-label="t('repertoire.periodAria')">
      <button
        v-for="key in REPERTOIRE_PERIODS"
        :key="key"
        type="button"
        class="pulse-periods__chip"
        :class="{ 'pulse-periods__chip--on': period === key }"
        role="tab"
        :aria-selected="period === key"
        @click="onPeriod(key)"
      >
        {{ t(periodLabelKey(key)) }}
      </button>
    </div>

    <AppLoading v-if="!pageReady && (loadingSummary || loadingSongs)" />
    <AppError
      v-else-if="error && !summary"
      :message="error"
      @retry="load"
    />

    <template v-else-if="summary">
      <AppSection :title="t('repertoire.sectionOverview')">
        <div
          class="pulse-overview app-panel"
          :class="`pulse-overview--cols-${overviewMetricCount}`"
        >
          <div class="pulse-overview__metrics">
            <button
              type="button"
              class="pulse-overview__metric pulse-overview__metric--all app-press"
              @click="scrollToSection('repertoire-all')"
            >
              <span class="pulse-overview__value">{{ summary.uniqueSongs }}</span>
              <span class="pulse-overview__label">{{ t('repertoire.metricUnique') }}</span>
            </button>
            <button
              v-if="showNewMetric"
              type="button"
              class="pulse-overview__metric pulse-overview__metric--new app-press"
              @click="scrollToSection('repertoire-new')"
            >
              <span class="pulse-overview__value">{{ summary.newSongs }}</span>
              <span class="pulse-overview__label">{{ t('repertoire.metricNew') }}</span>
            </button>
            <button
              type="button"
              class="pulse-overview__metric pulse-overview__metric--stale app-press"
              @click="scrollToSection('repertoire-stale')"
            >
              <span class="pulse-overview__value">{{ summary.staleCount }}</span>
              <span class="pulse-overview__label">{{ t('repertoire.metricStale') }}</span>
            </button>
          </div>
        </div>
      </AppSection>

      <AppSection :title="t('repertoire.sectionFrequent')">
        <AppEmptyState
          v-if="!frequentAll.length"
          :title="t('repertoire.emptyFrequentTitle')"
          :description="t('repertoire.emptyFrequentDesc')"
        />
        <div v-else class="pulse-list app-panel">
          <SongStatRow
            v-for="song in frequent"
            :key="song.songId"
            variant="frequent"
            :song="song"
            :from="rangeFrom"
            :to="rangeTo"
            :popularity-max="frequentMaxPlays"
          />
          <button
            v-if="frequentAll.length > preview"
            type="button"
            class="pulse-list__more"
            @click="expandFrequent = !expandFrequent"
          >
            {{
              expandFrequent
                ? t('repertoire.showLess')
                : t('repertoire.showAll', { count: frequentAll.length })
            }}
          </button>
        </div>
      </AppSection>

      <AppSection id="repertoire-stale" :title="t('repertoire.sectionStale')">
        <AppEmptyState
          v-if="!staleAll.length"
          :title="t('repertoire.emptyStaleTitle')"
          :description="t('repertoire.emptyStaleDesc')"
        />
        <div v-else class="pulse-list app-panel">
          <SongStatRow
            v-for="song in stale"
            :key="song.songId"
            variant="stale"
            :song="song"
            :from="rangeFrom"
            :to="rangeTo"
            :badge="staleBadge(song)"
          />
          <button
            v-if="staleAll.length > preview"
            type="button"
            class="pulse-list__more"
            @click="expandStale = !expandStale"
          >
            {{
              expandStale
                ? t('repertoire.showLess')
                : t('repertoire.showAll', { count: staleAll.length })
            }}
          </button>
        </div>
      </AppSection>

      <AppSection v-if="showNewMetric" id="repertoire-new" :title="t('repertoire.sectionNew')">
        <AppEmptyState
          v-if="!newestAll.length"
          :title="t('repertoire.emptyNewTitle')"
          :description="t('repertoire.emptyNewDesc')"
        />
        <div v-else class="pulse-list app-panel">
          <SongStatRow
            v-for="song in newest"
            :key="song.songId"
            :song="song"
            :from="rangeFrom"
            :to="rangeTo"
            :badge="t('repertoire.badgeNew')"
          />
          <button
            v-if="newestAll.length > preview"
            type="button"
            class="pulse-list__more"
            @click="expandNew = !expandNew"
          >
            {{
              expandNew
                ? t('repertoire.showLess')
                : t('repertoire.showAll', { count: newestAll.length })
            }}
          </button>
        </div>
      </AppSection>

      <AppSection id="repertoire-all" :title="t('repertoire.sectionAll')">
        <div class="pulse-all-tools">
          <div class="pulse-all-search">
            <AppIcon :name="icons.search" class="pulse-all-search__icon" />
            <InputText
              v-model="allQuery"
              class="w-full pulse-all-search__input"
              :placeholder="t('repertoire.searchPlaceholder')"
            />
          </div>
          <Select
            v-model="allSort"
            :options="sortOptions"
            option-label="label"
            option-value="value"
            class="pulse-all-sort"
          />
        </div>

        <AppEmptyState
          v-if="!repertoireAll.length"
          :title="t('repertoire.emptyAllTitle')"
          :description="t('repertoire.emptyAllDesc')"
        />
        <div v-else class="pulse-list app-panel">
          <SongStatRow
            v-for="song in repertoireAll"
            :key="song.songId"
            :song="song"
            :from="rangeFrom"
            :to="rangeTo"
            plays-mode="total"
          />
        </div>
      </AppSection>
    </template>
  </div>
</template>

<style scoped>
.pulse-periods {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.pulse-periods__chip {
  min-height: 2rem;
  padding: 0 0.75rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-muted);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 650;
  cursor: pointer;
}

.pulse-periods__chip--on {
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
}

.pulse-overview {
  padding: var(--app-space-3);
}

.pulse-overview__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.pulse-overview--cols-2 .pulse-overview__metrics {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pulse-overview__metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-width: 0;
  min-height: 4.1rem;
  padding: 0.65rem 0.45rem;
  border: 0;
  border-radius: var(--app-radius);
  background: var(--app-hover);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-border) 70%, transparent);
  font: inherit;
  text-align: center;
  cursor: pointer;
}

.pulse-overview__metric--all .pulse-overview__value {
  color: var(--app-ink);
}

.pulse-overview__metric--new .pulse-overview__value {
  color: var(--app-accent-text);
}

.pulse-overview__metric--stale .pulse-overview__value {
  color: var(--app-warn);
}

.pulse-overview__value {
  font-size: var(--app-text-xl);
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.pulse-overview__label {
  font-size: var(--app-text-2xs);
  font-weight: 600;
  line-height: 1.25;
  color: var(--app-muted);
  white-space: normal;
}

@media (max-width: 360px) {
  .pulse-overview__metric {
    min-height: 3.75rem;
    padding: 0.55rem 0.3rem;
  }

  .pulse-overview__value {
    font-size: var(--app-text-lg);
  }

  .pulse-overview__label {
    font-size: 0.62rem;
  }
}

.pulse-list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pulse-list :deep(.song-stat:not(:last-child)) {
  box-shadow: inset 0 -1px 0 var(--app-border);
}

.pulse-list__more {
  width: 100%;
  min-height: 2.75rem;
  border: 0;
  border-top: var(--app-hairline) solid var(--app-border);
  background: transparent;
  color: var(--app-accent-text);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 650;
  cursor: pointer;
}

.pulse-all-tools {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  margin-bottom: var(--app-space-2);
}

.pulse-all-search {
  position: relative;
}

.pulse-all-search__icon {
  position: absolute;
  left: 0.9rem;
  top: 50%;
  z-index: 1;
  width: 1.1rem;
  height: 1.1rem;
  transform: translateY(-50%);
  color: var(--app-muted);
  pointer-events: none;
}

.pulse-all-search :deep(.pulse-all-search__input),
.pulse-all-search :deep(input) {
  min-height: 2.75rem;
  padding-left: 2.5rem;
  border-radius: var(--app-radius-pill) !important;
}

.pulse-all-sort {
  width: 100%;
}
</style>
