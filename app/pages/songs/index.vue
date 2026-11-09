<script setup lang="ts">
import { icons } from '~/utils/icons'
import { soundingKey } from '~/utils/music/capo'

const workspace = useWorkspaceStore()
const { t } = useAppLocale()
const { songs, loading, error, fetchSongs } = useSongs()
const { syncSongsOnActivate } = useSongsRevision()

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
      <AppListRow
        v-for="song in songs"
        :key="song.id"
        :to="`/songs/${song.id}`"
        :title="song.title"
        :meta="songMeta(song)"
        chevron
      />
    </AppSurfaceList>
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
</style>
