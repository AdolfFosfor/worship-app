<script setup lang="ts">
import { REPERTOIRE_THRESHOLDS } from '~~/shared/repertoire/thresholds'
import type { ContributionCell } from '~/utils/repertoire/calendar'
import type { RepertoireDayPlay } from '~~/shared/types'
import { isStaleSong } from '~/utils/repertoire/status'
import { localTodayKey } from '~/utils/dates'

const { t } = useAppLocale()
const {
  summary,
  songs,
  loadingSummary,
  loadingSongs,
  error,
  fetchSummary,
  fetchSongs,
  fetchDay,
} = useRepertoirePulse()
const { syncRepertoireOnActivate } = useRepertoirePulseRevision()

const pageReady = ref(Boolean(summary.value && songs.value))
const dayOpen = ref(false)
const selectedDay = ref<string | null>(null)
const dayPlays = ref<RepertoireDayPlay[]>([])
const dayLoading = ref(false)

const calendarFrom = computed(() => summary.value?.from ?? '')
const calendarTo = computed(() => summary.value?.to ?? localTodayKey())

const frequent = computed(() =>
  (songs.value ?? [])
    .filter((s) => s.executionCount > 0)
    .slice(0, REPERTOIRE_THRESHOLDS.frequentListLimit),
)

const stale = computed(() =>
  (songs.value ?? [])
    .filter((s) => isStaleSong(s))
    .sort((a, b) => a.lastDate.localeCompare(b.lastDate))
    .slice(0, 12),
)

const newest = computed(() =>
  (songs.value ?? [])
    .filter((s) => s.isNewInPeriod)
    .sort((a, b) => b.firstDate.localeCompare(a.firstDate) || b.executionCount - a.executionCount)
    .slice(0, 12),
)

async function load(opts?: { quiet?: boolean }) {
  if (!opts?.quiet && !summary.value) pageReady.value = false
  try {
    await Promise.all([fetchSummary({ force: true }), fetchSongs({ force: true })])
    markRepertoireSynced()
  } catch {
    /* error in composable */
  } finally {
    pageReady.value = true
  }
}

const { markRepertoireSynced } = syncRepertoireOnActivate(() => load({ quiet: true }))

onMounted(() => {
  void load()
})

async function onSelectDay(cell: ContributionCell) {
  selectedDay.value = cell.date
  dayOpen.value = true
  dayLoading.value = true
  dayPlays.value = []
  try {
    dayPlays.value = await fetchDay(cell.date)
  } catch {
    dayPlays.value = []
  } finally {
    dayLoading.value = false
  }
}
</script>

<template>
  <div class="app-page">
    <AppHeader
      :title="t('repertoire.title')"
      :subtitle="t('repertoire.subtitle')"
    />

    <AppLoading v-if="!pageReady && (loadingSummary || loadingSongs)" />
    <AppError
      v-else-if="error && !summary"
      :message="error"
      @retry="load"
    />

    <template v-else-if="summary">
      <AppSection :title="t('repertoire.sectionOverview')">
        <div class="pulse-overview app-panel">
          <div class="pulse-overview__metrics">
            <div class="pulse-overview__metric">
              <span class="pulse-overview__value">{{ summary.executionCount }}</span>
              <span class="pulse-overview__label">{{ t('repertoire.metricPlays') }}</span>
            </div>
            <div class="pulse-overview__metric">
              <span class="pulse-overview__value">{{ summary.uniqueSongs }}</span>
              <span class="pulse-overview__label">{{ t('repertoire.metricUnique') }}</span>
            </div>
            <div class="pulse-overview__metric">
              <span class="pulse-overview__value">{{ summary.newSongs }}</span>
              <span class="pulse-overview__label">{{ t('repertoire.metricNew') }}</span>
            </div>
          </div>
          <p class="pulse-overview__note">{{ t('repertoire.overviewNote') }}</p>
        </div>
      </AppSection>

      <AppSection :title="t('repertoire.sectionCalendar')">
        <div class="pulse-calendar app-panel">
          <ContributionCalendar
            :from="calendarFrom"
            :to="calendarTo"
            :activity="summary.activity"
            @select="onSelectDay"
          />
        </div>
      </AppSection>

      <AppSection :title="t('repertoire.sectionFrequent')">
        <AppEmptyState
          v-if="!frequent.length"
          :title="t('repertoire.emptyFrequentTitle')"
          :description="t('repertoire.emptyFrequentDesc')"
        />
        <AppSurfaceList v-else>
          <div
            v-for="(song, index) in frequent"
            :key="song.songId"
            class="pulse-row"
            :class="{ 'pulse-row--split': index < frequent.length - 1 }"
          >
            <SongStatRow
              :song="song"
              :from="calendarFrom"
              :to="calendarTo"
            />
          </div>
        </AppSurfaceList>
      </AppSection>

      <AppSection :title="t('repertoire.sectionStale')">
        <AppEmptyState
          v-if="!stale.length"
          :title="t('repertoire.emptyStaleTitle')"
          :description="t('repertoire.emptyStaleDesc')"
        />
        <AppSurfaceList v-else>
          <div
            v-for="(song, index) in stale"
            :key="song.songId"
            class="pulse-row"
            :class="{ 'pulse-row--split': index < stale.length - 1 }"
          >
            <SongStatRow
              :song="song"
              :from="calendarFrom"
              :to="calendarTo"
            />
          </div>
        </AppSurfaceList>
      </AppSection>

      <AppSection :title="t('repertoire.sectionNew')">
        <AppEmptyState
          v-if="!newest.length"
          :title="t('repertoire.emptyNewTitle')"
          :description="t('repertoire.emptyNewDesc')"
        />
        <AppSurfaceList v-else>
          <div
            v-for="(song, index) in newest"
            :key="song.songId"
            class="pulse-row"
            :class="{ 'pulse-row--split': index < newest.length - 1 }"
          >
            <SongStatRow
              :song="song"
              :from="calendarFrom"
              :to="calendarTo"
              :badge="t('repertoire.badgeNew')"
            />
          </div>
        </AppSurfaceList>
      </AppSection>
    </template>

    <RepertoireDaySheet
      v-model:open="dayOpen"
      :day="selectedDay"
      :plays="dayPlays"
      :loading="dayLoading"
    />
  </div>
</template>

<style scoped>
.pulse-overview {
  padding: var(--app-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.pulse-overview__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.pulse-overview__metric {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.pulse-overview__value {
  font-size: var(--app-text-2xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--app-ink);
  font-variant-numeric: tabular-nums;
}

.pulse-overview__label {
  font-size: var(--app-text-2xs);
  font-weight: 550;
  color: var(--app-muted);
}

.pulse-overview__note {
  margin: 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
  line-height: 1.35;
}

.pulse-calendar {
  padding: var(--app-space-4) var(--app-space-3);
}

.pulse-row--split {
  position: relative;
}

.pulse-row--split::after {
  content: '';
  position: absolute;
  left: var(--app-space-4);
  right: 0;
  bottom: 0;
  height: var(--app-hairline);
  background: var(--app-border);
  pointer-events: none;
}
</style>
