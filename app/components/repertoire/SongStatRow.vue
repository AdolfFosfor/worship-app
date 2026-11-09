<script setup lang="ts">
import type { RepertoireSongStat } from '~~/shared/types'
import { formatServiceDatePill } from '~/utils/dates'
import { icons } from '~/utils/icons'

const props = defineProps<{
  song: RepertoireSongStat
  from: string
  to: string
  badge?: string
}>()

const { t, locale } = useAppLocale()

const lastLabel = computed(() =>
  formatServiceDatePill(props.song.lastDate, {
    locale: locale.value,
    todayPrefix: (date) => t('dates.todayPrefix', { date }),
  }),
)

const songLink = computed(() => `/songs/${props.song.songId}?from=/repertoire`)

/** В периоде 0 (давно не звучала) — показываем общий счёт, иначе счёт за период. */
const playsShown = computed(() =>
  props.song.executionCount > 0 ? props.song.executionCount : props.song.totalAll,
)
</script>

<template>
  <NuxtLink :to="songLink" class="song-stat app-press">
    <div class="song-stat__main">
      <div class="song-stat__title-row">
        <span class="song-stat__title">{{ song.title }}</span>
        <span v-if="badge" class="song-stat__badge">{{ badge }}</span>
      </div>
      <div class="song-stat__meta">
        <span>{{ t('repertoire.playsCount', { count: playsShown }) }}</span>
        <span class="song-stat__dot">·</span>
        <span>{{ t('repertoire.lastPlayed', { date: lastLabel }) }}</span>
      </div>
    </div>
    <SongActivitySpark
      class="song-stat__spark"
      :from="from"
      :to="to"
      :activity="song.activity"
    />
    <AppIcon :name="icons.chevronRight" class="song-stat__chevron" size="1.05rem" />
  </NuxtLink>
</template>

<style scoped>
.song-stat {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: var(--app-space-3);
  min-height: 3.5rem;
  padding: 0.85rem var(--app-space-4);
  text-decoration: none;
  color: inherit;
}

.song-stat__main {
  min-width: 0;
}

.song-stat__title-row {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  min-width: 0;
}

.song-stat__title {
  font-weight: 600;
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

.song-stat__meta {
  margin-top: 0.15rem;
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

.song-stat__spark {
  flex-shrink: 0;
}

.song-stat__chevron {
  color: var(--app-muted);
  opacity: 0.45;
}

@media (max-width: 380px) {
  .song-stat__spark {
    display: none;
  }

  .song-stat {
    grid-template-columns: 1fr auto;
  }
}
</style>
