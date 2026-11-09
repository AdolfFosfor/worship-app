<script setup lang="ts">
import type { RepertoireDayPlay } from '~~/shared/types'
import { formatServiceDatePill } from '~/utils/dates'
import { icons } from '~/utils/icons'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  day: string | null
  plays: RepertoireDayPlay[]
  loading?: boolean
}>()

const { t, sessionTitle, locale } = useAppLocale()

const title = computed(() => {
  if (!props.day) return ''
  return formatServiceDatePill(props.day, {
    locale: locale.value,
    todayPrefix: (date) => t('dates.todayPrefix', { date }),
  })
})

const grouped = computed(() => {
  const map = new Map<string, { id: string; title: string; songs: RepertoireDayPlay[] }>()
  for (const play of props.plays) {
    let group = map.get(play.setlistId)
    if (!group) {
      group = { id: play.setlistId, title: play.setlistTitle, songs: [] }
      map.set(play.setlistId, group)
    }
    group.songs.push(play)
  }
  return [...map.values()]
})

function close() {
  open.value = false
}
</script>

<template>
  <Teleport to=".app-shell">
    <Transition name="day-sheet">
      <div
        v-if="open"
        class="app-sheet day-sheet-mask"
        role="presentation"
        @click.self="close"
      >
        <div
          class="day-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          @click.stop
        >
          <div class="day-sheet__grab" aria-hidden="true" />
          <header class="day-sheet__header">
            <h2 class="day-sheet__title">{{ title }}</h2>
            <button
              type="button"
              class="app-header-action"
              :aria-label="t('common.close')"
              @click="close"
            >
              <AppIcon :name="icons.close" />
            </button>
          </header>

          <div class="day-sheet__body">
            <AppLoading v-if="loading" />
            <AppEmptyState
              v-else-if="!plays.length"
              :title="t('repertoire.dayEmptyTitle')"
              :description="t('repertoire.dayEmptyDesc')"
            />
            <div v-else class="day-sheet__groups">
              <section
                v-for="group in grouped"
                :key="group.id"
                class="day-sheet__group"
              >
                <NuxtLink
                  :to="`/setlists/${group.id}?from=/repertoire`"
                  class="day-sheet__setlink app-press"
                  @click="close"
                >
                  <span>{{ sessionTitle(group.title) }}</span>
                  <AppIcon :name="icons.chevronRight" size="1rem" />
                </NuxtLink>
                <AppSurfaceList>
                  <AppListRow
                    v-for="play in group.songs"
                    :key="`${play.setlistId}-${play.songId}-${play.position}`"
                    :title="play.songTitle"
                    :to="`/songs/${play.songId}?from=/repertoire`"
                    chevron
                    @click="close"
                  />
                </AppSurfaceList>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.day-sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-left: var(--app-safe-left);
  padding-right: var(--app-safe-right);
  background: color-mix(in srgb, #000 48%, transparent);
  cursor: pointer;
}

.day-sheet {
  width: min(28rem, 100%);
  max-height: min(78%, calc(var(--app-frame-height) - var(--app-safe-top) - 1rem));
  display: flex;
  flex-direction: column;
  border-radius: var(--app-radius-xl) var(--app-radius-xl) 0 0;
  background: var(--app-surface);
  padding-bottom: var(--app-safe-bottom);
  box-shadow: var(--app-shadow-soft);
  cursor: default;
}

.day-sheet__grab {
  width: 2.25rem;
  height: 0.28rem;
  margin: 0.55rem auto 0.15rem;
  border-radius: var(--app-radius-pill);
  background: color-mix(in srgb, var(--app-ink) 14%, transparent);
}

.day-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-4) var(--app-space-3);
}

.day-sheet__title {
  margin: 0;
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--app-ink);
}

.day-sheet__body {
  overflow: auto;
  padding: 0 var(--app-space-4) var(--app-space-4);
  -webkit-overflow-scrolling: touch;
}

.day-sheet__groups {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.day-sheet__group {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.day-sheet__setlink {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
  padding: 0.15rem var(--app-space-1);
  color: var(--app-accent-text);
  text-decoration: none;
  font-size: var(--app-text-sm);
  font-weight: 650;
}

.day-sheet-enter-active,
.day-sheet-leave-active {
  transition: opacity var(--app-duration) var(--app-ease);
}

.day-sheet-enter-active .day-sheet,
.day-sheet-leave-active .day-sheet {
  transition: transform 220ms var(--app-ease);
}

.day-sheet-enter-from,
.day-sheet-leave-to {
  opacity: 0;
}

.day-sheet-enter-from .day-sheet,
.day-sheet-leave-to .day-sheet {
  transform: translateY(100%);
}
</style>
