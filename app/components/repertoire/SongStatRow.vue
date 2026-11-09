<script setup lang="ts">
import type { RepertoireSongStat } from '~~/shared/types'
import { formatServiceDatePill } from '~/utils/dates'
import { icons } from '~/utils/icons'
import { formatSinceLast } from '~/utils/repertoire/status'

const props = withDefaults(
  defineProps<{
    song: RepertoireSongStat
    from: string
    to: string
    badge?: string
    /** Показывать «N дн. назад» вместо даты последнего */
    sinceMode?: boolean
    /** @deprecated вертикальный spark больше не используется на hub */
    showSpark?: boolean
    /** plays за период или totalAll */
    playsMode?: 'period' | 'total'
    /**
     * frequent — название, исполнения, горизонтальная полоса.
     * stale — название, дата, относительное время, статус.
     * default — название и компактная мета.
     */
    variant?: 'default' | 'frequent' | 'stale'
    /** Макс. исполнений в списке (лидер) для полосы популярности */
    popularityMax?: number
  }>(),
  {
    badge: undefined,
    sinceMode: false,
    showSpark: false,
    playsMode: 'period',
    variant: 'default',
    popularityMax: 0,
  },
)

const { t, locale } = useAppLocale()

const lastLabel = computed(() =>
  formatServiceDatePill(props.song.lastDate, {
    locale: locale.value,
    todayPrefix: (date) => t('dates.todayPrefix', { date }),
  }),
)

const songLink = computed(() => `/repertoire/songs/${props.song.songId}`)

const playsShown = computed(() => {
  if (props.playsMode === 'total') return props.song.totalAll
  return props.song.executionCount > 0 ? props.song.executionCount : props.song.totalAll
})

const barWidth = computed(() => {
  const max = props.popularityMax
  if (max <= 0 || playsShown.value <= 0) return 0
  return Math.round((playsShown.value / max) * 1000) / 10
})

const sinceLabel = computed(() => formatSinceLast(props.song.lastDate, t))
</script>

<template>
  <NuxtLink
    :to="songLink"
    class="song-stat app-press"
    :class="`song-stat--${variant}`"
  >
    <div class="song-stat__main">
      <div class="song-stat__title-row">
        <span class="song-stat__title">{{ song.title }}</span>
        <span v-if="badge" class="song-stat__badge">{{ badge }}</span>
      </div>

      <template v-if="variant === 'frequent'">
        <div class="song-stat__freq">
          <span class="song-stat__plays">
            {{ t('repertoire.playsCount', { count: playsShown }) }}
          </span>
          <div
            class="song-stat__bar"
            role="meter"
            :aria-valuenow="barWidth"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="t('repertoire.playsCount', { count: playsShown })"
          >
            <span class="song-stat__bar-fill" :style="{ width: `${barWidth}%` }" />
          </div>
        </div>
      </template>

      <template v-else-if="variant === 'stale'">
        <div class="song-stat__stale-meta">
          <span>{{ lastLabel }}</span>
          <span class="song-stat__dot">·</span>
          <span>{{ sinceLabel }}</span>
        </div>
      </template>

      <template v-else>
        <div class="song-stat__meta">
          <span>{{ t('repertoire.playsCount', { count: playsShown }) }}</span>
          <span class="song-stat__dot">·</span>
          <span>
            {{
              sinceMode
                ? sinceLabel
                : t('repertoire.lastPlayed', { date: lastLabel })
            }}
          </span>
        </div>
      </template>
    </div>

    <AppIcon :name="icons.chevronRight" class="song-stat__chevron" size="1.05rem" />
  </NuxtLink>
</template>

<style scoped>
.song-stat {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--app-space-3);
  min-height: 3.5rem;
  padding: 0.85rem var(--app-space-4);
  text-decoration: none;
  color: inherit;
}

.song-stat__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.song-stat__title-row {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  min-width: 0;
}

.song-stat__title {
  min-width: 0;
  font-weight: 650;
  font-size: var(--app-text-lg);
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-stat__badge {
  flex-shrink: 0;
  padding: 0.1rem 0.45rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-2xs);
  font-weight: 700;
}

.song-stat--stale .song-stat__badge {
  background: var(--app-hover);
  color: var(--app-muted);
  font-weight: 650;
}

.song-stat__meta,
.song-stat__stale-meta {
  font-size: var(--app-text-sm);
  font-weight: 450;
  color: var(--app-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-stat__dot {
  margin: 0 0.2rem;
  opacity: 0.6;
}

.song-stat__freq {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  max-width: 100%;
}

.song-stat__plays {
  font-size: var(--app-text-sm);
  font-weight: 550;
  color: var(--app-muted);
  font-variant-numeric: tabular-nums;
}

.song-stat__bar {
  width: min(100%, 12rem);
  height: 0.28rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  overflow: hidden;
}

.song-stat__bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: color-mix(in srgb, var(--app-accent) 70%, var(--app-muted));
}

.song-stat__chevron {
  color: var(--app-muted);
  opacity: 0.45;
}

@media (max-width: 380px) {
  .song-stat__bar {
    width: min(100%, 9.5rem);
  }
}
</style>
