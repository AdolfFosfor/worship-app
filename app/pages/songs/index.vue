<script setup lang="ts">
import type { Setlist, Song } from '~~/shared/types'
import { icons } from '~/utils/icons'
import { soundingKey } from '~/utils/music/capo'
import { localTodayKey } from '~/utils/dates'

const workspace = useWorkspaceStore()
const { t, sessionTitle, locale } = useAppLocale()
const { songs, loading, error, fetchSongs, deleteSong } = useSongs()
const { syncSongsOnActivate } = useSongsRevision()
const { fetchSetlists, songInSetlist, addSongToSetlist } = useSetlists()
const toast = useToast()
const { requireDanger } = useAppConfirm()

const dateLocaleTag = computed(
  () => ({ ru: 'ru-RU', ro: 'ro-RO', en: 'en-GB' })[locale.value] ?? 'en-GB',
)

function songMeta(song: { key: string; capo: number }) {
  return soundingKey(song.key, song.capo)
}

const query = ref('')
const debouncedSearch = useDebounceFn(() => {
  void fetchSongs(query.value)
}, 250)

watch(query, () => {
  void debouncedSearch()
})

async function load() {
  try {
    await fetchSongs(query.value)
    markSongsSynced()
  } catch {
    /* ошибка уже в composable */
  }
}

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
  pickerVisible.value = true
  pickerLoading.value = true
  try {
    const today = localTodayKey()
    const all = await fetchSetlists()
    upcomingSetlists.value = all
      .filter((s) => s.serviceDate >= today)
      .slice()
      .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
  } catch (e) {
    pickerVisible.value = false
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

    <div class="songs-search">
      <AppIcon :name="icons.search" class="songs-search__icon" />
      <InputText
        v-model="query"
        class="w-full songs-search__input"
        :placeholder="t('songs.searchPlaceholder')"
      />
    </div>

    <AppLoading v-if="loading && !songs.length" />
    <AppError v-else-if="error" :message="error" @retry="fetchSongs(query)" />
    <AppEmptyState
      v-else-if="!songs.length"
      :title="t('songs.emptyTitle')"
      :description="t('songs.emptyDesc')"
    >
      <template v-if="workspace.canEditSongs" #action>
        <NuxtLink to="/songs/new" class="app-cta">{{ t('common.add') }}</NuxtLink>
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
          :meta="songMeta(song)"
          chevron
        />
      </SwipeDeleteRow>
    </AppSurfaceList>

    <Dialog
      v-model:visible="pickerVisible"
      modal
      :header="t('songs.addToSetlistDialog')"
      :style="{ width: 'min(24rem, 100%)' }"
      append-to=".app-shell"
    >
      <AppLoading v-if="pickerLoading" />
      <AppEmptyState
        v-else-if="!upcomingSetlists.length"
        :title="t('songs.noUpcomingSetlists')"
        :description="t('songs.noUpcomingHint')"
      >
        <template #action>
          <button
            type="button"
            class="songs-picker-cta"
            @click="openCreateSetlistFromPicker"
          >
            <AppIcon :name="icons.add" size="1.1rem" />
            {{ t('common.create') }}
          </button>
        </template>
      </AppEmptyState>
      <AppSurfaceList v-else>
        <button
          v-for="item in upcomingSetlists"
          :key="item.id"
          type="button"
          class="songs-picker-row"
          :disabled="pickerBusy"
          @click="addPendingToSetlist(item)"
        >
          <span class="songs-picker-title">{{ sessionTitle(item.title) }}</span>
          <span class="songs-picker-date">{{ formatSetlistDate(item.serviceDate) }}</span>
        </button>
      </AppSurfaceList>
    </Dialog>

    <CreateSetlistSheet ref="createSetlistSheet" v-model:open="createSetlistOpen" />
  </div>
</template>

<style scoped>
.songs-search {
  position: relative;
  width: 100%;
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
