<script setup lang="ts">
import type { Setlist, Song } from '~~/shared/types'
import {
  SONG_TYPES,
  emptySongLibraryFilters,
  libraryFiltersActive,
  songThemeMessageKey,
  type SongActivity,
  type SongLibraryFilters,
  type SongTempo,
  type SongType,
} from '~~/shared/songs/library'
import { icons } from '~/utils/icons'
import { soundingKey } from '~/utils/music/capo'
import { localTodayKey } from '~/utils/dates'
import { pluralForm } from '~/utils/i18n/plural'

const workspace = useWorkspaceStore()
const { t, sessionTitle, locale } = useAppLocale()
const { songs, facets, loading, error, fetchSongs, fetchLibraryFacets, deleteSong } = useSongs()
const { syncSongsOnActivate } = useSongsRevision()
const { fetchSetlists, songInSetlist, addSongToSetlist } = useSetlists()
const toast = useToast()
const { requireDanger } = useAppConfirm()

const dateLocaleTag = computed(
  () => ({ ru: 'ru-RU', ro: 'ro-RO', en: 'en-GB' })[locale.value] ?? 'en-GB',
)

function songMeta(song: { key: string; capo: number; bpm: number | null; timeSignature: string | null }) {
  const parts = [soundingKey(song.key, song.capo)]
  if (song.bpm) parts.push(String(song.bpm))
  if (song.timeSignature) parts.push(song.timeSignature)
  return parts.join(' · ')
}

const query = ref('')
const filters = ref<SongLibraryFilters>(emptySongLibraryFilters())
const filtersOpen = ref(false)

const filtersActive = computed(() => libraryFiltersActive(filters.value))
const searchActive = computed(() => query.value.trim().length > 0)
const showResultMeta = computed(
  () => songs.value.length > 0 || filtersActive.value || searchActive.value,
)

const foundLabel = computed(() =>
  t(`songs.found_${pluralForm(songs.value.length, locale.value)}`, { count: songs.value.length }),
)

const filterCount = computed(() => {
  const current = filters.value
  return (
    current.types.length +
    current.themes.length +
    current.tempos.length +
    current.keys.length +
    current.timeSignatures.length +
    current.activity.length
  )
})

type ActiveFilter =
  | { id: string; label: string; kind: 'type'; value: SongType }
  | { id: string; label: string; kind: 'theme'; value: string }
  | { id: string; label: string; kind: 'tempo'; value: SongTempo }
  | { id: string; label: string; kind: 'key'; value: string }
  | { id: string; label: string; kind: 'meter'; value: string }
  | { id: string; label: string; kind: 'activity'; value: SongActivity }

const activeFilters = computed<ActiveFilter[]>(() => {
  const current = filters.value
  return [
    ...current.types.map((value) => ({
      id: `type:${value}`,
      label: t(`songs.type.${value}`),
      kind: 'type' as const,
      value,
    })),
    ...current.themes.map((value) => {
      const key = songThemeMessageKey(value)
      return {
        id: `theme:${value}`,
        label: key ? t(key) : value,
        kind: 'theme' as const,
        value,
      }
    }),
    ...current.tempos.map((value) => ({
      id: `tempo:${value}`,
      label: t(`songs.tempo.${value}`),
      kind: 'tempo' as const,
      value,
    })),
    ...current.keys.map((value) => ({
      id: `key:${value}`,
      label: value,
      kind: 'key' as const,
      value,
    })),
    ...current.timeSignatures.map((value) => ({
      id: `meter:${value}`,
      label: value,
      kind: 'meter' as const,
      value,
    })),
    ...current.activity.map((value) => ({
      id: `activity:${value}`,
      label: t(`songs.activity.${value}`),
      kind: 'activity' as const,
      value,
    })),
  ]
})

function without<T>(list: T[], value: T): T[] {
  return list.filter((item) => item !== value)
}

function removeFilter(chip: ActiveFilter) {
  const current = filters.value
  if (chip.kind === 'type') filters.value = { ...current, types: without(current.types, chip.value) }
  else if (chip.kind === 'theme') {
    filters.value = { ...current, themes: without(current.themes, chip.value) }
  } else if (chip.kind === 'tempo') {
    filters.value = { ...current, tempos: without(current.tempos, chip.value) }
  } else if (chip.kind === 'key') {
    filters.value = { ...current, keys: without(current.keys, chip.value) }
  } else if (chip.kind === 'meter') {
    filters.value = { ...current, timeSignatures: without(current.timeSignatures, chip.value) }
  } else {
    filters.value = { ...current, activity: without(current.activity, chip.value) }
  }
}

function toggleType(type: SongType) {
  const current = filters.value
  filters.value = {
    ...current,
    types: current.types.includes(type) ? without(current.types, type) : [...current.types, type],
  }
}

function selectAllTypes() {
  if (!filters.value.types.length) return
  filters.value = { ...filters.value, types: [] }
}

function resetFilters() {
  filters.value = emptySongLibraryFilters()
}

async function load() {
  try {
    await Promise.all([
      fetchSongs({ search: query.value, filters: filters.value }),
      fetchLibraryFacets(),
    ])
    markSongsSynced()
  } catch {
    /* ошибка уже в composable */
  }
}

const debouncedSearch = useDebounceFn(() => {
  void load()
}, 250)

watch(query, () => {
  void debouncedSearch()
})

watch(filters, () => {
  void load()
})

const { markSongsSynced } = syncSongsOnActivate(load)

onMounted(() => {
  void load()
})

const pickerVisible = ref(false)
const pickerLoading = ref(false)
const pickerBusy = ref(false)
const pendingSong = ref<Song | null>(null)
const upcomingSetlists = ref<Setlist[]>([])
const createSetlistOpen = ref(false)
const createSetlistSheet = ref<{ open: () => void } | null>(null)

function formatSetlistDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(dateLocaleTag.value, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${iso}T12:00:00`))
  } catch {
    return iso
  }
}

function confirmDeleteSong(song: Song) {
  if (!workspace.canEditSongs) return
  requireDanger({
    title: t('songs.deleteConfirmTitle'),
    message: t('songs.deleteConfirmMessage'),
    acceptLabel: t('common.delete'),
    accept: async () => {
      try {
        await deleteSong(song.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2000 })
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: t('common.error'),
          detail: e instanceof Error ? e.message : t('common.deleteFailed'),
          life: 4000,
        })
      }
    },
  })
}

async function openAddToSetlist(song: Song) {
  if (!workspace.canEditSetlists) return
  pendingSong.value = song
  pickerLoading.value = true
  try {
    const today = localTodayKey()
    const all = await fetchSetlists()
    upcomingSetlists.value = all
      .filter((s) => s.serviceDate >= today)
      .slice()
      .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
    // Открываем после данных — иначе Dialog фокусирует close до появления CTA.
    pickerVisible.value = true
  } catch (e) {
    pendingSong.value = null
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('setlists.loadFailed'),
      life: 4000,
    })
  } finally {
    pickerLoading.value = false
  }
}

function openCreateSetlistFromPicker() {
  pickerVisible.value = false
  createSetlistSheet.value?.open()
}

async function addPendingToSetlist(setlist: Setlist) {
  const song = pendingSong.value
  if (!song || pickerBusy.value) return
  pickerBusy.value = true
  try {
    if (await songInSetlist(setlist.id, song.id)) {
      toast.add({
        severity: 'info',
        summary: t('setlist.alreadyIn'),
        detail: sessionTitle(setlist.title),
        life: 2500,
      })
      pickerVisible.value = false
      pendingSong.value = null
      return
    }

    await addSongToSetlist(setlist.id, song.id)
    pickerVisible.value = false
    pendingSong.value = null
    toast.add({
      severity: 'success',
      summary: t('setlist.added'),
      detail: sessionTitle(setlist.title),
      life: 2500,
    })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('common.addFailed'),
      life: 4000,
    })
  } finally {
    pickerBusy.value = false
  }
}

const canSwipeDelete = computed(() => workspace.canEditSongs)
const canSwipeAdd = computed(() => workspace.canEditSetlists)
</script>

<template>
  <div class="app-page">
    <AppHeader :title="t('songs.title')">
      <template v-if="workspace.canEditSongs" #trailing>
        <NuxtLink to="/songs/new" class="app-header-action" :aria-label="t('songs.ariaAdd')">
          <AppIcon :name="icons.add" />
        </NuxtLink>
      </template>
    </AppHeader>

    <div class="songs-toolbar">
      <div class="songs-search">
        <AppIcon :name="icons.search" class="songs-search__icon" />
        <InputText
          v-model="query"
          class="w-full songs-search__input"
          :placeholder="t('songs.searchPlaceholder')"
        />
      </div>

      <div class="songs-types">
        <div class="app-chip-row">
          <button
            type="button"
            class="songs-chip"
            :class="{ 'songs-chip--on': !filters.types.length }"
            :aria-pressed="!filters.types.length"
            @click="selectAllTypes"
          >
            {{ t('songs.type.all') }}
          </button>
          <button
            v-for="type in SONG_TYPES"
            :key="type"
            type="button"
            class="songs-chip"
            :class="{ 'songs-chip--on': filters.types.includes(type) }"
            :aria-pressed="filters.types.includes(type)"
            @click="toggleType(type)"
          >
            {{ t(`songs.type.${type}`) }}
          </button>
        </div>
        <button
          type="button"
          class="songs-filter-btn"
          :class="{ 'songs-filter-btn--on': filtersActive }"
          :aria-expanded="filtersOpen"
          aria-controls="song-filters-sheet"
          @click="filtersOpen = true"
        >
          {{ t('songs.filters') }}
          <span v-if="filterCount" class="songs-filter-btn__count">{{ filterCount }}</span>
        </button>
      </div>

      <div v-if="showResultMeta" class="songs-meta">
        <span>{{ foundLabel }}</span>
        <button
          v-if="filtersActive"
          type="button"
          class="songs-reset"
          @click="resetFilters"
        >
          {{ t('songs.reset') }}
        </button>
      </div>

      <div v-if="activeFilters.length" class="songs-active">
        <button
          v-for="chip in activeFilters"
          :key="chip.id"
          type="button"
          class="songs-active__chip"
          :aria-label="t('songs.removeFilter', { label: chip.label })"
          @click="removeFilter(chip)"
        >
          <span>{{ chip.label }}</span>
          <AppIcon :name="icons.close" size="0.85rem" />
        </button>
      </div>
    </div>

    <AppLoading v-if="loading && !songs.length" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <AppEmptyState
      v-else-if="!songs.length && !filtersActive && !searchActive"
      :title="t('songs.emptyTitle')"
      :description="t('songs.emptyDesc')"
    >
      <template v-if="workspace.canEditSongs" #action>
        <NuxtLink to="/songs/new" class="app-cta">{{ t('common.add') }}</NuxtLink>
      </template>
    </AppEmptyState>
    <AppEmptyState
      v-else-if="!songs.length"
      :title="t('songs.emptyFilteredTitle')"
      :description="t('songs.emptyFilteredDesc')"
    >
      <template v-if="filtersActive" #action>
        <button type="button" class="app-cta" @click="resetFilters">
          {{ t('songs.reset') }}
        </button>
      </template>
    </AppEmptyState>
    <AppSurfaceList v-else>
      <SwipeDeleteRow
        v-for="song in songs"
        :key="song.id"
        class="songs-swipe"
        :disabled="!canSwipeDelete && !canSwipeAdd"
        :end-enabled="canSwipeDelete"
        :start-enabled="canSwipeAdd"
        @end="confirmDeleteSong(song)"
        @start="openAddToSetlist(song)"
      >
        <AppListRow
          :to="`/songs/${song.id}`"
          :title="song.title"
          :subtitle="song.artist || undefined"
          :meta="songMeta(song)"
          chevron
        />
      </SwipeDeleteRow>
    </AppSurfaceList>

    <Dialog
      v-model:visible="pickerVisible"
      modal
      dismissable-mask
      :header="t('songs.addToSetlistDialog')"
      :style="{ width: 'min(24rem, 100%)' }"
      append-to=".app-shell"
    >
      <AppLoading v-if="pickerLoading" />
      <AppEmptyState
        v-else-if="!upcomingSetlists.length"
        compact
        :title="t('songs.noUpcomingSetlists')"
        :description="t('songs.noUpcomingHint')"
      >
        <template #action>
          <button
            type="button"
            class="songs-picker-cta"
            autofocus
            @click="openCreateSetlistFromPicker"
          >
            <AppIcon :name="icons.add" size="1.1rem" />
            {{ t('common.create') }}
          </button>
        </template>
      </AppEmptyState>
      <AppSurfaceList v-else>
        <button
          v-for="(item, index) in upcomingSetlists"
          :key="item.id"
          type="button"
          class="songs-picker-row"
          :autofocus="index === 0"
          :disabled="pickerBusy"
          @click="addPendingToSetlist(item)"
        >
          <span class="songs-picker-title">{{ sessionTitle(item.title) }}</span>
          <span class="songs-picker-date">{{ formatSetlistDate(item.serviceDate) }}</span>
        </button>
      </AppSurfaceList>
    </Dialog>

    <CreateSetlistSheet ref="createSetlistSheet" v-model:open="createSetlistOpen" />
    <SongFiltersSheet
      v-model:open="filtersOpen"
      v-model:filters="filters"
      :extra-themes="facets.themes"
      :extra-meters="facets.timeSignatures"
    />
  </div>
</template>

<style scoped>
.songs-search {
  position: relative;
  width: 100%;
}

.songs-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.songs-types {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  min-width: 0;
}

.songs-types .app-chip-row {
  flex: 1;
  min-width: 0;
}

.songs-chip,
.songs-filter-btn,
.songs-active__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-pill);
  background: var(--app-surface);
  color: var(--app-ink);
  font: inherit;
  font-size: var(--app-text-xs);
  font-weight: 650;
  cursor: pointer;
  flex-shrink: 0;
}

.songs-chip--on,
.songs-filter-btn--on {
  border-color: transparent;
  background: var(--app-accent);
  color: var(--app-accent-contrast);
}

.songs-filter-btn {
  gap: 0.35rem;
}

.songs-filter-btn__count {
  min-width: 1.15rem;
  padding: 0 0.3rem;
  border-radius: var(--app-radius-pill);
  background: color-mix(in srgb, var(--app-accent-contrast) 18%, transparent);
  font-variant-numeric: tabular-nums;
}

.songs-filter-btn:not(.songs-filter-btn--on) .songs-filter-btn__count {
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
}

.songs-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  font-size: var(--app-text-xs);
  font-weight: 650;
  color: var(--app-muted);
}

.songs-reset {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--app-accent-text);
  font: inherit;
  font-size: var(--app-text-xs);
  font-weight: 700;
  cursor: pointer;
}

.songs-active {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.songs-active__chip {
  background: var(--app-accent-muted);
  border-color: transparent;
  color: var(--app-accent-text);
}

.songs-search__icon {
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

.songs-search :deep(.songs-search__input),
.songs-search :deep(input) {
  min-height: 2.75rem;
  padding-left: 2.5rem;
  padding-block: 0.7rem;
  border-radius: var(--app-radius-pill) !important;
  border: 1px solid var(--app-border) !important;
  background: var(--app-surface) !important;
}

/* AppListRow внутри свайпа всегда :last-child — делитель вешаем на обёртку */
.songs-swipe:not(:last-child) :deep(.app-list-row)::after {
  content: '';
  position: absolute;
  left: var(--app-space-4);
  right: 0;
  bottom: 0;
  height: var(--app-hairline);
  background: var(--app-border);
  pointer-events: none;
}

.songs-picker-row {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: 3.25rem;
  padding: var(--app-space-3) var(--app-space-4);
  border: 0;
  background: transparent;
  color: var(--app-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.songs-picker-row:not(:last-child)::after {
  content: '';
  position: absolute;
  left: var(--app-space-4);
  right: 0;
  bottom: 0;
  height: var(--app-hairline);
  background: var(--app-border);
}

.songs-picker-row:disabled {
  opacity: 0.6;
  cursor: wait;
}

.songs-picker-title {
  font-weight: 650;
  letter-spacing: -0.01em;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.songs-picker-date {
  flex-shrink: 0;
  font-size: var(--app-text-xs);
  font-weight: 700;
  color: var(--app-accent-text);
  padding: 0.2rem 0.5rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent-muted);
}

.songs-picker-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  min-height: 2.5rem;
  padding: 0 1.1rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}
</style>
