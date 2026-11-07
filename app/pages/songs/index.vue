<script setup lang="ts">
import { icons } from '~/utils/icons'
import { soundingKey } from '~/utils/music/capo'

const workspace = useWorkspaceStore()
const { songs, loading, error, fetchSongs } = useSongs()

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

onMounted(() => {
  void fetchSongs()
})
</script>

<template>
  <div class="app-page">
    <AppHeader title="Песни">
      <template v-if="workspace.canEditSongs" #trailing>
        <NuxtLink to="/songs/new" class="app-header-action" aria-label="Добавить песню">
          <AppIcon :name="icons.add" size="1.65rem" />
        </NuxtLink>
      </template>
    </AppHeader>

    <div class="songs-search">
      <AppIcon :name="icons.search" class="songs-search__icon" />
      <InputText v-model="query" class="w-full" placeholder="Поиск" />
    </div>

    <AppLoading v-if="loading && !songs.length" />
    <AppError v-else-if="error" :message="error" @retry="fetchSongs(query)" />
    <AppEmptyState
      v-else-if="!songs.length"
      title="Библиотека пуста"
      description="Добавьте первую песню команды"
    >
      <template v-if="workspace.canEditSongs" #action>
        <NuxtLink to="/songs/new" class="songs-cta">Добавить</NuxtLink>
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
  left: 0.85rem;
  top: 50%;
  z-index: 1;
  width: 1.1rem;
  height: 1.1rem;
  transform: translateY(-50%);
  color: var(--app-muted);
  pointer-events: none;
}

.songs-search :deep(input) {
  padding-left: 2.4rem;
}

.songs-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  padding: 0 1rem;
  border-radius: var(--app-radius-sm);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font-weight: 600;
  text-decoration: none;
}
</style>
