<script setup lang="ts">
import type { RepertoirePeriodKey } from '~~/shared/repertoire/thresholds'
import type { RepertoireSongDetail, RepertoireSongPerformance } from '~~/shared/types'
import { isDefaultSessionTitle } from '~~/shared/i18n/messages'
import {
  formatListDayParts,
  formatMonthYearHeading,
  formatServiceDatePill,
  monthKeyFromIso,
} from '~/utils/dates'
import { icons } from '~/utils/icons'
import { REPERTOIRE_PERIODS, periodLabelKey } from '~/utils/repertoire/period'
import { formatSinceLast } from '~/utils/repertoire/status'

const route = useRoute()
const { t, locale, sessionTitle } = useAppLocale()
const { fetchSongDetail, loadingDetail, period } = useRepertoirePulse()

const id = computed(() => String(route.params.id))
const detail = ref<RepertoireSongDetail | null>(null)
const error = ref<string | null>(null)
const ready = ref(false)

interface HistoryMonthGroup {
  key: string
  label: string
  items: RepertoireSongPerformance[]
}

function onPeriod(next: RepertoirePeriodKey) {
  if (next === period.value) return
  period.value = next
}

async function load() {
  ready.value = false
  error.value = null
  try {
    detail.value = await fetchSongDetail(id.value)
    if (!detail.value) error.value = t('songs.notFound')
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    ready.value = true
  }
}

onMounted(() => {
  void load()
})

watch(id, () => {
  void load()
})

function formatDate(iso: string) {
  return formatServiceDatePill(iso, {
    locale: locale.value,
    todayPrefix: (date) => t('dates.todayPrefix', { date }),
  })
}

function dayParts(iso: string) {
  return formatListDayParts(iso, locale.value)
}

function isEvent(title: string) {
  return !isDefaultSessionTitle(title)
}

const sinceLabel = computed(() => {
  if (!detail.value?.lastDate) return null
  return formatSinceLast(detail.value.lastDate, t)
})

const historyGroups = computed((): HistoryMonthGroup[] => {
  const plays = detail.value?.performances ?? []
  const groups: HistoryMonthGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const play of plays) {
    const key = monthKeyFromIso(play.serviceDate)
    let idx = indexByKey.get(key)
    if (idx == null) {
      idx = groups.length
      indexByKey.set(key, idx)
      groups.push({
        key,
        label: formatMonthYearHeading(play.serviceDate, locale.value),
        items: [],
      })
    }
    groups[idx]!.items.push(play)
  }

  return groups
})
useAppHeader(() => ({
  title: detail.value?.title ?? t('repertoire.title'),
  subtitle: detail.value ? t('repertoire.songAnalytics') : null,
}))
</script>

<template>
  <div class="app-page">
    <AppLoading v-if="!ready || loadingDetail" />
    <AppError v-else-if="error" :message="error" @retry="load" />

    <template v-else-if="detail">
      <section class="song-pulse__stats app-panel">
        <div class="song-pulse__metric">
          <span class="song-pulse__value">{{ detail.totalAll }}</span>
          <span class="song-pulse__label">{{ t('repertoire.metricPlays') }}</span>
        </div>
        <div class="song-pulse__metric">
          <span class="song-pulse__value song-pulse__value--sm">
            {{ detail.firstDate ? formatDate(detail.firstDate) : '—' }}
          </span>
          <span class="song-pulse__label">{{ t('repertoire.firstPlayed') }}</span>
        </div>
        <div class="song-pulse__metric">
          <span class="song-pulse__value song-pulse__value--sm">
            {{ detail.lastDate ? formatDate(detail.lastDate) : '—' }}
          </span>
          <span class="song-pulse__label">{{ t('repertoire.lastPlayedShort') }}</span>
        </div>
        <p v-if="sinceLabel" class="song-pulse__since">{{ sinceLabel }}</p>
      </section>

      <AppSection v-if="detail.totalAll > 0" :title="t('repertoire.sectionDynamics')">
        <div class="song-pulse__periods" role="tablist" :aria-label="t('repertoire.periodAria')">
          <button
            v-for="key in REPERTOIRE_PERIODS"
            :key="key"
            type="button"
            class="song-pulse__period"
            :class="{ 'song-pulse__period--on': period === key }"
            role="tab"
            :aria-selected="period === key"
            @click="onPeriod(key)"
          >
            {{ t(periodLabelKey(key)) }}
          </button>
        </div>
        <div class="app-panel song-pulse__dyn">
          <p class="song-pulse__dyn-caption">{{ t('repertoire.dynamicsCaption') }}</p>
          <SongMonthlyBars
            :monthly="detail.monthly"
            :period="period"
            :first-date="detail.firstDate"
            :locale="locale"
          />
        </div>
      </AppSection>

      <AppSection :title="t('repertoire.sectionHistory')">
        <AppEmptyState
          v-if="!detail.performances.length"
          :title="t('repertoire.emptyHistoryTitle')"
          :description="t('repertoire.emptyHistoryDesc')"
        />
        <div v-else class="song-pulse__history">
          <section
            v-for="group in historyGroups"
            :key="group.key"
            class="song-pulse__history-group"
          >
            <h3 class="song-pulse__history-month">{{ group.label }}</h3>
            <div class="song-pulse__history-list app-panel">
              <NuxtLink
                v-for="play in group.items"
                :key="`${play.setlistId}-${play.serviceDate}`"
                :to="`/setlists/${play.setlistId}?from=/repertoire/songs/${detail.songId}`"
                class="song-pulse__play app-press"
              >
                <div class="song-pulse__play-date" aria-hidden="true">
                  <span class="song-pulse__play-weekday">{{ dayParts(play.serviceDate).weekday }}</span>
                  <span class="song-pulse__play-day">{{ dayParts(play.serviceDate).day }}</span>
                </div>
                <div class="song-pulse__play-main">
                  <div class="song-pulse__play-title-line">
                    <span class="song-pulse__play-title">{{ sessionTitle(play.setlistTitle) }}</span>
                    <span v-if="isEvent(play.setlistTitle)" class="song-pulse__play-event">
                      {{ t('setlists.eventBadge') }}
                    </span>
                  </div>
                </div>
                <AppIcon
                  :name="icons.chevronRight"
                  class="song-pulse__play-chevron"
                  size="1.05rem"
                />
              </NuxtLink>
            </div>
          </section>
        </div>
      </AppSection>

      <div class="song-pulse__footer">
        <NuxtLink :to="`/songs/${detail.songId}?from=/repertoire`" class="app-cta app-cta--ghost">
          {{ t('repertoire.openSong') }}
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.song-pulse__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-3);
  padding: var(--app-page-inline);
}

.song-pulse__metric {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.song-pulse__value {
  font-size: var(--app-text-2xl);
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  color: var(--app-ink);
}

.song-pulse__value--sm {
  font-size: var(--app-text-md);
  font-weight: 700;
}

.song-pulse__label {
  font-size: var(--app-text-2xs);
  font-weight: 600;
  color: var(--app-muted);
}

.song-pulse__since {
  grid-column: 1 / -1;
  margin: 0;
  font-size: var(--app-text-sm);
  font-weight: 550;
  color: var(--app-accent-text);
}

.song-pulse__periods {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: var(--app-space-2);
}

.song-pulse__period {
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

.song-pulse__period--on {
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
}

.song-pulse__dyn {
  padding: var(--app-space-3) var(--app-page-inline) var(--app-space-3);
}

.song-pulse__dyn-caption {
  margin: 0 0 var(--app-space-1);
  font-size: var(--app-text-xs);
  font-weight: 550;
  color: var(--app-muted);
}

.song-pulse__history {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.song-pulse__history-group {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.song-pulse__history-month {
  margin: 0;
  padding-inline: var(--app-space-1);
  font-size: var(--app-text-sm);
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.25;
  color: var(--app-section-header);
}

.song-pulse__history-list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.song-pulse__play {
  display: grid;
  grid-template-columns: 2.15rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  min-height: 3.35rem;
  padding: 0.55rem var(--app-page-inline) 0.55rem 0.55rem;
  text-decoration: none;
  color: inherit;
  box-shadow: inset 0 -1px 0 var(--app-border);
}

.song-pulse__play:last-child {
  box-shadow: none;
}

.song-pulse__play-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.05rem;
  min-width: 0;
  line-height: 1.05;
}

.song-pulse__play-weekday {
  font-size: var(--app-text-2xs);
  font-weight: 650;
  letter-spacing: -0.01em;
  text-transform: lowercase;
  color: var(--app-muted);
}

.song-pulse__play-day {
  font-size: var(--app-text-lg);
  font-weight: 750;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--app-ink);
}

.song-pulse__play-main {
  min-width: 0;
}

.song-pulse__play-title-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.song-pulse__play-title {
  min-width: 0;
  font-size: var(--app-text-md);
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.25;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-pulse__play-event {
  flex-shrink: 0;
  padding: 0.12rem 0.4rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.2;
}

.song-pulse__play-chevron {
  flex-shrink: 0;
  color: var(--app-muted);
  opacity: 0.45;
}

.song-pulse__footer {
  margin-top: auto;
  padding-top: var(--app-space-2);
}

.song-pulse__footer .app-cta {
  width: 100%;
}
</style>
