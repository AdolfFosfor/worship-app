<script setup lang="ts">
import type { Song } from '~~/shared/types'
import { icons } from '~/utils/icons'
import { clampCapo, soundingKey } from '~/utils/music/capo'
import { keyDistance, transposeKeyLabel } from '~/utils/music/keys'
import { transposeText } from '~/utils/music/transpose'
import { safeInternalPath } from '~/utils/safeInternalPath'

const route = useRoute()
const workspace = useWorkspaceStore()
const { getSong, deleteSong } = useSongs()
const toast = useToast()
const confirm = useConfirm()

const song = ref<Song | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/** Concert/sounding key the musician wants to hear. */
const viewSounding = ref('C')
/** Capo fret used for the shapes currently shown. */
const viewCapo = ref(0)

const id = computed(() => String(route.params.id))
const backTo = computed(() => safeInternalPath(route.query.from, '/songs'))

useTelegramBackButton(true, backTo)

const hasStoredCapo = computed(() => (song.value?.capo ?? 0) > 0)

const originalSounding = computed(() =>
  song.value ? soundingKey(song.value.key, song.value.capo) : '',
)

/** Chord shapes needed so that `viewSounding` rings at `viewCapo`. */
const viewShapeKey = computed(() =>
  transposeKeyLabel(viewSounding.value, -clampCapo(viewCapo.value)),
)

const semitones = computed(() =>
  song.value ? keyDistance(song.value.key, viewShapeKey.value) : 0,
)

const displayChords = computed(() =>
  transposeText(song.value?.chords, semitones.value),
)

function syncViewFromSong(next: Song) {
  const keyFromQuery = typeof route.query.key === 'string' ? route.query.key : null
  viewCapo.value = next.capo
  // Setlist may pass the shape key used there — convert to sounding with song capo
  if (keyFromQuery) {
    viewSounding.value = soundingKey(keyFromQuery, next.capo)
  } else {
    viewSounding.value = soundingKey(next.key, next.capo)
  }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    song.value = await getSong(id.value)
    syncViewFromSong(song.value)
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
        await navigateTo(backTo.value.startsWith('/setlists/') ? '/songs' : backTo.value)
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
      <AppHeader :title="song.title" :back-to="backTo">
        <template v-if="workspace.canEditSongs" #trailing>
          <NuxtLink
            :to="`/songs/${song.id}/edit`"
            class="app-header-action"
            aria-label="Редактировать"
          >
            <AppIcon :name="icons.edit" size="1.5rem" />
          </NuxtLink>
          <button
            type="button"
            class="app-header-action app-header-action--danger"
            aria-label="Удалить"
            @click="confirmDelete"
          >
            <AppIcon :name="icons.trash" size="1.5rem" />
          </button>
        </template>
      </AppHeader>

      <section class="song-view__panel">
        <div class="song-view__row">
          <div class="song-view__copy">
            <span class="song-view__label">Оригинал</span>
            <p class="song-view__original">{{ originalSounding }}</p>
          </div>
          <p v-if="hasStoredCapo" class="song-view__hint">
            Запись: формы {{ song.key }}, капо {{ song.capo }}
          </p>
        </div>

        <div v-if="hasStoredCapo || viewCapo > 0" class="song-view__row song-view__row--controls">
          <span class="song-view__label">Капо</span>
          <CapoStepper v-model="viewCapo" />
        </div>

        <div class="song-view__row song-view__row--controls">
          <span class="song-view__label">Тональность</span>
          <KeyStepper v-model="viewSounding" />
        </div>

        <p v-if="viewCapo > 0" class="song-view__shapes">
          Формы на грифе: <strong>{{ viewShapeKey }}</strong>
        </p>
      </section>

      <section v-if="displayChords" class="song-view__section">
        <h2 class="song-view__section-title">Аккорды</h2>
        <ChordSheet :text="displayChords" />
      </section>

      <section v-if="song.lyrics" class="song-view__section">
        <h2 class="song-view__section-title">Текст</h2>
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
.song-view__panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
}

.song-view__row {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-1);
}

.song-view__row--controls {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.song-view__label {
  font-size: var(--app-text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.song-view__original {
  margin: 0;
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--app-ink);
}

.song-view__hint {
  margin: 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
}

.song-view__shapes {
  margin: 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
}

.song-view__shapes strong {
  color: var(--app-accent-text);
  font-weight: 700;
}

.song-view__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.song-view__section-title {
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
</style>
