<script setup lang="ts">
import { formatServiceDatePill } from '~/utils/dates'
import { icons, type AppIconName } from '~/utils/icons'

const workspace = useWorkspaceStore()
const { t, sessionTitle, locale } = useAppLocale()
const { getUpcoming, upcoming } = useSetlists()
const { syncSetlistsOnActivate } = useSetlistsRevision()
const { summary: pulseSummary, fetchSummary } = useRepertoirePulse()
const { syncRepertoireOnActivate } = useRepertoirePulseRevision()

const loading = ref(!upcoming.value)
const error = ref<string | null>(null)
const pulseLoading = ref(!pulseSummary.value)

const createMenuOpen = ref(false)
const createMenu = ref<{ toggle: (event: Event) => void; close: () => void } | null>(null)
const createSetlistOpen = ref(false)
const createSetlistSheet = ref<{ open: () => void } | null>(null)

const canCreate = computed(
  () => workspace.canEditSongs || workspace.canEditSetlists,
)

const createOptions = computed(() => {
  const options: {
    to?: string
    label: string
    icon: AppIconName
    kind: 'song' | 'setlist'
  }[] = []
  if (workspace.canEditSongs) {
    options.push({
      to: '/songs/new',
      label: t('home.createSong'),
      icon: icons.music,
      kind: 'song',
    })
  }
  if (workspace.canEditSetlists) {
    options.push({
      label: t('home.createSetlist'),
      icon: icons.playlist,
      kind: 'setlist',
    })
  }
  return options
})

function toggleCreateMenu(event: Event) {
  createMenu.value?.toggle(event)
}

async function onCreatePick(option: (typeof createOptions.value)[number]) {
  createMenu.value?.close()
  if (option.kind === 'setlist') {
    createSetlistSheet.value?.open()
    return
  }
  if (option.to) await navigateTo(option.to)
}

async function loadPulse(opts?: { quiet?: boolean }) {
  if (!opts?.quiet && !pulseSummary.value) pulseLoading.value = true
  try {
    await fetchSummary({ force: Boolean(opts?.quiet) || !pulseSummary.value })
    markRepertoireSynced()
  } catch {
    /* пульс не блокирует главную */
  } finally {
    pulseLoading.value = false
  }
}

async function load(opts?: { quiet?: boolean }) {
  if (!opts?.quiet && !upcoming.value) loading.value = true
  error.value = null
  try {
    await getUpcoming()
    markSetlistsSynced()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('home.loadError')
  } finally {
    loading.value = false
  }
}

const { markSetlistsSynced } = syncSetlistsOnActivate(() => load({ quiet: true }))
const { markRepertoireSynced } = syncRepertoireOnActivate(() => loadPulse({ quiet: true }))
onMounted(() => {
  void load()
  void loadPulse()
})

function formatDatePill(iso: string) {
  return formatServiceDatePill(iso, {
    locale: locale.value,
    todayPrefix: (date) => t('dates.todayPrefix', { date }),
  })
}
</script>

<template>
  <div class="app-page">
    <AppHeader :title="workspace.workspace?.name ?? 'Worship'">
      <template v-if="canCreate" #trailing>
        <button
          type="button"
          class="app-header-action"
          :aria-label="t('common.create')"
          aria-haspopup="menu"
          @click="toggleCreateMenu"
        >
          <AppIcon :name="icons.add" />
        </button>
      </template>
    </AppHeader>

    <AppAnchoredMenu
      ref="createMenu"
      v-model:open="createMenuOpen"
      :label="t('common.create')"
    >
      <div class="app-create-menu">
        <button
          v-for="option in createOptions"
          :key="option.kind"
          type="button"
          class="app-create-menu__item"
          :class="`app-create-menu__item--${option.kind}`"
          role="menuitem"
          @click="onCreatePick(option)"
        >
          <span class="app-create-menu__icon">
            <AppIcon :name="option.icon" :size="18" />
          </span>
          <span class="app-create-menu__label">{{ option.label }}</span>
        </button>
      </div>
    </AppAnchoredMenu>

    <CreateSetlistSheet ref="createSetlistSheet" v-model:open="createSetlistOpen" />

    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />

    <template v-else>
      <AppSection :title="t('home.sectionUpcoming')">
        <div class="home-hero app-panel app-panel--accent">
          <template v-if="upcoming">
            <NuxtLink :to="`/setlists/${upcoming.id}`" class="home-hero__link app-press">
              <AppPill>{{ formatDatePill(upcoming.serviceDate) }}</AppPill>
              <h3 class="home-hero__title">{{ sessionTitle(upcoming.title) }}</h3>
              <AppIcon :name="icons.chevronRight" class="home-hero__chevron" size="1.05rem" />
            </NuxtLink>
            <div
              v-if="upcoming.items.length"
              class="home-hero__songs app-chip-row"
              :aria-label="t('home.ariaSetlistSongs')"
            >
              <NuxtLink
                v-for="item in upcoming.items"
                :key="item.id"
                :to="{
                  path: `/songs/${item.songId}`,
                  query: {
                    key: item.key ?? item.song.key,
                    from: `/setlists/${upcoming.id}`,
                  },
                }"
                class="home-hero__song-link"
              >
                <AppPill tone="soft">{{ item.song.title }}</AppPill>
              </NuxtLink>
            </div>
          </template>
          <div v-else class="home-hero__empty">
            <AppEmptyState
              :title="t('home.emptyUpcomingTitle')"
              :description="t('home.emptyUpcomingDesc')"
            >
              <template v-if="workspace.canEditSetlists" #action>
                <button type="button" class="app-cta" @click="createSetlistSheet?.open()">
                  <AppIcon :name="icons.add" size="1.1rem" />
                  {{ t('common.create') }}
                </button>
              </template>
            </AppEmptyState>
          </div>
        </div>
      </AppSection>

      <AppSection v-if="pulseSummary || pulseLoading">
        <div v-if="pulseLoading && !pulseSummary" class="home-pulse-skeleton app-panel" />
        <RepertoirePulseCard v-else-if="pulseSummary" :summary="pulseSummary" />
      </AppSection>
    </template>
  </div>
</template>

<style scoped>
.home-hero {
  overflow: hidden;
}

.home-hero__link {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--app-space-2);
  padding: var(--app-space-5);
  padding-bottom: var(--app-space-3);
  padding-right: 2.5rem;
  text-decoration: none;
  color: inherit;
}

.home-hero__title {
  margin: 0;
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.2;
  color: var(--app-ink);
}

.home-hero__chevron {
  position: absolute;
  right: var(--app-page-inline);
  top: 50%;
  transform: translateY(-50%);
  color: var(--app-muted);
  opacity: 0.5;
}

.home-hero__songs {
  padding: 0 var(--app-space-5) var(--app-space-5);
}

.home-hero__song-link {
  display: inline-flex;
  max-width: 100%;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  border-radius: var(--app-radius-pill);
  transition: opacity 200ms var(--app-ease);
}

@media (hover: hover) and (pointer: fine) {
  .home-hero__song-link:hover {
    opacity: 0.78;
  }
}

.home-hero__song-link:active {
  opacity: 0.65;
}

.home-hero__empty {
  padding: var(--app-space-2) 0;
}

.home-pulse-skeleton {
  min-height: 14rem;
  background: color-mix(in srgb, var(--app-surface) 70%, var(--app-hover));
}
</style>
