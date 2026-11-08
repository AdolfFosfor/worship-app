<script setup lang="ts">
import type { Setlist, Song } from '~~/shared/types'
import { icons } from '~/utils/icons'
import { clampCapo, soundingKey } from '~/utils/music/capo'
import { keyDistance, transposeKeyLabel } from '~/utils/music/keys'
import { transposeText } from '~/utils/music/transpose'
import { safeInternalPath } from '~/utils/safeInternalPath'

const route = useRoute()
const workspace = useWorkspaceStore()
const { getSong, deleteSong } = useSongs()
const { fetchSetlists, songInSetlist, addSongToSetlist } = useSetlists()
const toast = useToast()
const confirm = useConfirm()

const song = ref<Song | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const pickerVisible = ref(false)
const pickerLoading = ref(false)
const pickerBusy = ref(false)
const upcomingSetlists = ref<Setlist[]>([])

/** Concert/sounding key (fixed for this view; capo only changes shapes). */
const viewSounding = ref('C')
/** Capo fret used when the capo panel is open. */
const viewCapo = ref(0)
/** Capo controls hidden by default — open via the round button. */
const capoOpen = ref(false)

const id = computed(() => String(route.params.id))
const backTo = computed(() => safeInternalPath(route.query.from, '/songs'))
const showAddToSetlist = computed(() => workspace.canEditSetlists)
const showSongManage = computed(() => workspace.canEditSongs)

useTelegramBackButton(true, backTo)

const originalSounding = computed(() =>
  song.value ? soundingKey(song.value.key, song.value.capo) : '',
)

const capoBadge = computed(() => {
  const fret = capoOpen.value ? clampCapo(viewCapo.value) : (song.value?.capo ?? 0)
  return fret > 0 ? String(fret) : null
})

/** Chord shapes needed so that `viewSounding` rings at `viewCapo`. */
const viewShapeKey = computed(() =>
  transposeKeyLabel(viewSounding.value, -clampCapo(viewCapo.value)),
)

const semitones = computed(() => {
  if (!song.value) return 0
  // Closed: concert pitch without capo shapes. Open: shapes for current capo.
  const target = capoOpen.value ? viewShapeKey.value : viewSounding.value
  return keyDistance(song.value.key, target)
})

const displayChords = computed(() =>
  transposeText(song.value?.chords, semitones.value),
)

function syncViewFromSong(next: Song) {
  const keyFromQuery = typeof route.query.key === 'string' ? route.query.key : null
  capoOpen.value = false
  viewCapo.value = next.capo
  // Setlist may pass the shape key used there — convert to sounding with song capo
  if (keyFromQuery) {
    viewSounding.value = soundingKey(keyFromQuery, next.capo)
  } else {
    viewSounding.value = soundingKey(next.key, next.capo)
  }
}

function toggleCapoPanel() {
  capoOpen.value = !capoOpen.value
}

function formatSetlistDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(iso + 'T12:00:00'))
  } catch {
    return iso
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

async function openSetlistPicker() {
  pickerVisible.value = true
  pickerLoading.value = true
  try {
    const today = new Date().toISOString().slice(0, 10)
    const all = await fetchSetlists()
    upcomingSetlists.value = all
      .filter((s) => s.serviceDate >= today)
      .slice()
      .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
  } catch (e) {
    pickerVisible.value = false
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: e instanceof Error ? e.message : 'Не удалось загрузить сет-листы',
      life: 4000,
    })
  } finally {
    pickerLoading.value = false
  }
}

async function addToSetlist(setlist: Setlist) {
  if (!song.value || pickerBusy.value) return
  pickerBusy.value = true
  try {
    if (await songInSetlist(setlist.id, song.value.id)) {
      toast.add({
        severity: 'info',
        summary: 'Уже в сет-листе',
        detail: setlist.title,
        life: 2500,
      })
      pickerVisible.value = false
      return
    }

    const overrideKey =
      viewShapeKey.value !== song.value.key ? viewShapeKey.value : null
    await addSongToSetlist(setlist.id, song.value.id, overrideKey)
    pickerVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Добавлено',
      detail: setlist.title,
      life: 2500,
    })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: e instanceof Error ? e.message : 'Не удалось добавить',
      life: 4000,
    })
  } finally {
    pickerBusy.value = false
  }
}

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
        <template v-if="showAddToSetlist" #trailing>
          <button
            type="button"
            class="song-view__hdr-btn"
            aria-label="В сет-лист"
            @click="openSetlistPicker"
          >
            <AppIcon :name="icons.playlist" size="1.35rem" />
            <span>В сет</span>
          </button>
        </template>
      </AppHeader>

      <section class="song-view__panel">
        <div class="song-view__row song-view__row--head">
          <div class="song-view__copy">
            <span class="song-view__label">Оригинал</span>
            <p class="song-view__original">{{ originalSounding }}</p>
          </div>
          <button
            type="button"
            class="song-view__capo-btn"
            :class="{ 'song-view__capo-btn--open': capoOpen }"
            :aria-label="capoBadge ? `Капо ${capoBadge}` : 'Капо'"
            :aria-expanded="capoOpen"
            @click="toggleCapoPanel"
          >
            <AppIcon :name="icons.capo" class="song-view__capo-btn-icon" size="1.35rem" />
            <span v-if="capoBadge" class="song-view__capo-badge">{{ capoBadge }}</span>
          </button>
        </div>

        <div v-if="capoOpen" class="song-view__capo-panel">
          <div class="song-view__row song-view__row--controls">
            <span class="song-view__label">Капо</span>
            <CapoStepper v-model="viewCapo" />
          </div>
          <p v-if="viewCapo > 0" class="song-view__shapes">
            Формы на грифе: <strong>{{ viewShapeKey }}</strong>
          </p>
        </div>
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
        <AppIcon :name="icons.youtube" size="1.15rem" />
        Смотреть на YouTube
      </a>

      <div v-if="showSongManage" class="song-view__footer">
        <NuxtLink :to="`/songs/${song.id}/edit`" class="song-view__edit">
          <AppIcon :name="icons.edit" size="1.1rem" />
          Редактировать
        </NuxtLink>
        <button type="button" class="song-view__delete" @click="confirmDelete">
          <AppIcon :name="icons.trash" size="1.1rem" />
          Удалить песню
        </button>
      </div>

      <Dialog
        v-model:visible="pickerVisible"
        modal
        header="В сет-лист"
        :style="{ width: 'min(24rem, 100%)' }"
        append-to=".app-shell"
      >
        <AppLoading v-if="pickerLoading" />
        <AppEmptyState
          v-else-if="!upcomingSetlists.length"
          title="Нет предстоящих"
          description="Создайте сет-лист на ближайшую дату"
        >
          <template #action>
            <NuxtLink to="/setlists/new" class="song-view__picker-cta" @click="pickerVisible = false">
              Создать
            </NuxtLink>
          </template>
        </AppEmptyState>
        <AppSurfaceList v-else>
          <button
            v-for="item in upcomingSetlists"
            :key="item.id"
            type="button"
            class="song-view__picker-row"
            :disabled="pickerBusy"
            @click="addToSetlist(item)"
          >
            <span class="song-view__picker-title">{{ item.title }}</span>
            <span class="song-view__picker-date">{{ formatSetlistDate(item.serviceDate) }}</span>
          </button>
        </AppSurfaceList>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.song-view__hdr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 2.75rem;
  min-height: 2.5rem;
  padding: 0 0.75rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-surface);
  color: var(--app-accent-text);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  flex-shrink: 0;
}

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

.song-view__row--head {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.song-view__row--controls {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.song-view__copy {
  min-width: 0;
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

.song-view__capo-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: var(--app-bg);
  color: var(--app-accent-text);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.song-view__capo-btn--open {
  border-color: var(--app-accent);
  background: var(--app-accent-muted);
}

.song-view__capo-btn-icon {
  display: block;
}

.song-view__capo-badge {
  position: absolute;
  top: -0.2rem;
  right: -0.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.song-view__capo-panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding-top: var(--app-space-4);
  border-top: 1px solid var(--app-border);
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

.song-view__footer {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  margin-top: auto;
  padding-top: var(--app-space-4);
}

.song-view__edit,
.song-view__delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  width: 100%;
  min-height: var(--app-touch-min);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.song-view__edit {
  color: var(--app-accent-text);
}

.song-view__delete {
  color: var(--app-destructive);
}

.song-view__picker-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: var(--app-touch-min);
  padding: var(--app-space-3) var(--app-space-4);
  border: 0;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.song-view__picker-row:disabled {
  opacity: 0.6;
  cursor: wait;
}

.song-view__picker-title {
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-view__picker-date {
  flex-shrink: 0;
  font-size: var(--app-text-sm);
  font-weight: 600;
  color: var(--app-accent-text);
}

.song-view__picker-cta {
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
