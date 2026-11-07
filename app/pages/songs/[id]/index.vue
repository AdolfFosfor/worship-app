<script setup lang="ts">
import type { Song } from '~~/shared/types'
import { icons } from '~/utils/icons'
import { keyDistance } from '~/utils/music/keys'
import { transposeText } from '~/utils/music/transpose'

definePageMeta({ hideNav: true })
useTelegramBackButton(true)

const route = useRoute()
const workspace = useWorkspaceStore()
const { getSong, deleteSong } = useSongs()
const toast = useToast()
const confirm = useConfirm()

const song = ref<Song | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const viewKey = ref('G')

const id = computed(() => String(route.params.id))

const semitones = computed(() =>
  song.value ? keyDistance(song.value.key, viewKey.value) : 0,
)

const displayChords = computed(() =>
  transposeText(song.value?.chords, semitones.value),
)

async function load() {
  loading.value = true
  error.value = null
  try {
    song.value = await getSong(id.value)
    const keyFromQuery = typeof route.query.key === 'string' ? route.query.key : null
    viewKey.value = keyFromQuery || song.value.key
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Песня не найдена'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function confirmDelete() {
  confirm.require({
    message: 'Удалить песню из библиотеки?',
    header: 'Удаление',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Отмена',
    acceptLabel: 'Удалить',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await deleteSong(id.value)
        toast.add({ severity: 'success', summary: 'Удалено', life: 2000 })
        await navigateTo('/songs')
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: 'Ошибка',
          detail: e instanceof Error ? e.message : 'Не удалось удалить',
          life: 4000,
        })
      }
    },
  })
}
</script>

<template>
  <div class="app-page">
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <template v-else-if="song">
      <AppHeader :title="song.title" :subtitle="`Оригинал: ${song.key}`" back-to="/songs">
        <template v-if="workspace.canEditSongs" #trailing>
          <NuxtLink
            :to="`/songs/${song.id}/edit`"
            class="song-view__icon-link"
            aria-label="Редактировать"
          >
            <AppIcon :name="icons.edit" />
          </NuxtLink>
          <button
            type="button"
            class="song-view__icon-btn"
            aria-label="Удалить"
            @click="confirmDelete"
          >
            <AppIcon :name="icons.trash" />
          </button>
        </template>
      </AppHeader>

      <div class="song-view__key">
        <span>Тональность</span>
        <KeyStepper v-model="viewKey" />
      </div>

      <section v-if="displayChords" class="song-view__section">
        <h2 class="song-view__label">Аккорды</h2>
        <ChordSheet :text="displayChords" />
      </section>

      <section v-if="song.lyrics" class="song-view__section">
        <h2 class="song-view__label">Текст</h2>
        <ChordSheet :text="song.lyrics" />
      </section>

      <a
        v-if="song.youtubeUrl"
        class="song-view__yt"
        :href="song.youtubeUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        <AppIcon :name="icons.youtube" />
        Смотреть на YouTube
      </a>
    </template>
  </div>
</template>

<style scoped>
.song-view__key {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  font-size: var(--app-text-sm);
  font-weight: 600;
  color: var(--app-muted);
}

.song-view__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.song-view__label {
  margin: 0;
  font-size: var(--app-text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.song-view__yt {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-2);
  min-height: var(--app-touch-min);
  color: var(--app-link);
  font-weight: 600;
  text-decoration: none;
}

.song-view__icon-link,
.song-view__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-accent-text);
  cursor: pointer;
  text-decoration: none;
}

.song-view__icon-btn {
  color: var(--app-destructive);
}
</style>
