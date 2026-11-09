<script setup lang="ts">
import type { Setlist, Song } from '~~/shared/types'
import { icons } from '~/utils/icons'
import { clampCapo, soundingKey } from '~/utils/music/capo'
import { transposeChart } from '~/utils/music/chart'
import { keyDistance, transposeKeyLabel } from '~/utils/music/keys'
import { transposeText } from '~/utils/music/transpose'
import { localTodayKey } from '~/utils/dates'
import { safeInternalPath } from '~/utils/safeInternalPath'

const route = useRoute()
const workspace = useWorkspaceStore()
const { t, sessionTitle, locale } = useAppLocale()

const dateLocaleTag = computed(
  () => ({ ru: 'ru-RU', ro: 'ro-RO', en: 'en-GB' })[locale.value] ?? 'en-GB',
)
const { getSong, deleteSong } = useSongs()
const { syncSongsOnActivate } = useSongsRevision()
const { fetchSetlists, songInSetlist, addSongToSetlist } = useSetlists()
const toast = useToast()
const { requireDanger } = useAppConfirm()

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
const stageFullscreen = ref(false)

const id = computed(() => String(route.params.id))
const backTo = computed(() => safeInternalPath(route.query.from, '/songs'))
const showAddToSetlist = computed(() => workspace.canEditSetlists)
const showSongManage = computed(() => workspace.canEditSongs)

const capoToggleAria = computed(() =>
  capoBadge.value
    ? t('capo.ariaWithFret', { n: capoBadge.value })
    : t('song.fieldCapo'),
)

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

const displayChart = computed(() => {
  const chart = song.value?.chordChart
  if (!chart) return null
  return transposeChart(chart, semitones.value)
})

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
    return new Intl.DateTimeFormat(dateLocaleTag.value, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(iso + 'T12:00:00'))
  } catch {
    return iso
  }
}

async function load(opts?: { quiet?: boolean }) {
  if (!opts?.quiet) loading.value = true
  error.value = null
  try {
    song.value = await getSong(id.value)
    syncViewFromSong(song.value)
    markSongsSynced()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('songs.notFound')
  } finally {
    loading.value = false
  }
}

const { markSongsSynced } = syncSongsOnActivate(() => load({ quiet: true }))
onMounted(() => {
  void load()
})

async function openSetlistPicker() {
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

async function addToSetlist(setlist: Setlist) {
  if (!song.value || pickerBusy.value) return
  pickerBusy.value = true
  try {
    if (await songInSetlist(setlist.id, song.value.id)) {
      toast.add({
        severity: 'info',
        summary: t('setlist.alreadyIn'),
        detail: sessionTitle(setlist.title),
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

function confirmDelete() {
  requireDanger({
    title: t('songs.deleteConfirmTitle'),
    message: t('songs.deleteConfirmMessage'),
    acceptLabel: t('common.delete'),
    accept: async () => {
      try {
        await deleteSong(id.value)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2000 })
        await navigateTo(backTo.value.startsWith('/setlists/') ? '/songs' : backTo.value)
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
</script>

<template>
  <div class="app-page">
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <template v-else-if="song">
      <AppHeader :title="song.title">
        <template v-if="showAddToSetlist" #trailing>
          <button
            type="button"
            class="app-header-action app-header-action--chip"
            :aria-label="t('songs.ariaAddToSetlist')"
            @click="openSetlistPicker"
          >
            <AppIcon :name="icons.playlist" />
            <span>{{ t('songs.addToSetShort') }}</span>
          </button>
        </template>
      </AppHeader>

      <section class="song-view__panel app-panel">
        <div class="song-view__row song-view__row--head">
          <div class="song-view__copy">
            <span class="song-view__label">{{ t('songs.originalKey') }}</span>
            <p class="song-view__original">{{ originalSounding }}</p>
          </div>
          <button
            type="button"
            class="song-view__capo-btn"
            :class="{ 'song-view__capo-btn--open': capoOpen }"
            :aria-label="capoToggleAria"
            :aria-expanded="capoOpen"
            @click="toggleCapoPanel"
          >
            <AppIcon :name="icons.capo" class="song-view__capo-btn-icon" size="1.25rem" />
            <span v-if="capoBadge" class="song-view__capo-badge">{{ capoBadge }}</span>
          </button>
        </div>

        <div v-if="capoOpen" class="song-view__capo-panel">
          <div class="song-view__row song-view__row--controls">
            <span class="song-view__label">{{ t('song.fieldCapo') }}</span>
            <CapoStepper v-model="viewCapo" />
          </div>
          <p v-if="viewCapo > 0" class="song-view__shapes">
            {{ t('songs.shapesOnFretboard') }} <strong>{{ viewShapeKey }}</strong>
          </p>
        </div>
      </section>

      <AppSection v-if="displayChart" :title="t('song.fieldChords')">
        <ChordStageView
          :chart="displayChart"
          :fullscreen="stageFullscreen"
          @update:fullscreen="stageFullscreen = $event"
        />
      </AppSection>
      <AppSection v-else-if="displayChords" :title="t('song.fieldChords')">
        <ChordSheet :text="displayChords" />
      </AppSection>

      <AppSection v-if="song.lyrics" :title="t('song.extraLyrics')">
        <ChordSheet :text="song.lyrics" />
      </AppSection>

      <a
        v-if="song.youtubeUrl"
        class="song-view__yt"
        :href="song.youtubeUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="song-view__yt-mark" aria-hidden="true">
          <svg class="song-view__yt-logo" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M23.5 6.2a3.05 3.05 0 0 0-2.14-2.16C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.36.54A3.05 3.05 0 0 0 .5 6.2 32.1 32.1 0 0 0 0 12a32.1 32.1 0 0 0 .5 5.8 3.05 3.05 0 0 0 2.14 2.16C4.6 20.5 12 20.5 12 20.5s7.4 0 9.36-.54a3.05 3.05 0 0 0 2.14-2.16A32.1 32.1 0 0 0 24 12a32.1 32.1 0 0 0-.5-5.8ZM9.75 15.5v-7L16 12l-6.25 3.5Z"
            />
          </svg>
        </span>
        <span class="song-view__yt-copy">
          <span class="song-view__yt-title">{{ t('song.extraYoutube') }}</span>
          <span class="song-view__yt-sub">{{ t('songs.openVideo') }}</span>
        </span>
        <AppIcon :name="icons.chevronRight" class="song-view__yt-chevron" size="1.05rem" />
      </a>

      <div v-if="showSongManage" class="song-view__footer">
        <NuxtLink :to="`/songs/${song.id}/edit`" class="song-view__edit">
          <AppIcon :name="icons.edit" size="1.05rem" />
          {{ t('common.edit') }}
        </NuxtLink>
        <button type="button" class="song-view__delete" @click="confirmDelete">
          <AppIcon :name="icons.trash" size="1.05rem" />
          {{ t('songs.deleteSong') }}
        </button>
      </div>

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
            <NuxtLink to="/setlists/new" class="song-view__picker-cta" @click="pickerVisible = false">
              {{ t('common.create') }}
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
            <span class="song-view__picker-title">{{ sessionTitle(item.title) }}</span>
            <span class="song-view__picker-date">{{ formatSetlistDate(item.serviceDate) }}</span>
          </button>
        </AppSurfaceList>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.song-view__panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
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
  font-weight: 650;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.song-view__original {
  margin: 0;
  font-size: var(--app-text-2xl);
  font-weight: 700;
  letter-spacing: -0.03em;
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
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-accent-text);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--app-duration) var(--app-ease),
    transform var(--app-duration) var(--app-ease);
}

.song-view__capo-btn:active {
  transform: scale(0.94);
}

.song-view__capo-btn--open {
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
  border-top: var(--app-hairline) solid var(--app-border);
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

.song-view__yt {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  width: 100%;
  min-height: 3.5rem;
  padding: var(--app-space-3) var(--app-space-4);
  border-radius: var(--app-radius-lg);
  background: var(--app-surface);
  color: var(--app-ink);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--app-duration) var(--app-ease),
    transform var(--app-duration) var(--app-ease);
}

.song-view__yt:active {
  background: var(--app-press);
  transform: scale(0.99);
}

.song-view__yt-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: var(--app-radius-sm);
  background: #ff0033;
  color: #fff;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #000 8%, transparent);
}

.song-view__yt-logo {
  display: block;
  width: 1.35rem;
  height: 1.35rem;
}

.song-view__yt-copy {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.song-view__yt-title {
  font-size: var(--app-text-md);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.song-view__yt-sub {
  font-size: var(--app-text-xs);
  font-weight: 550;
  color: var(--app-muted);
  line-height: 1.3;
}

.song-view__yt-chevron {
  flex-shrink: 0;
  color: var(--app-muted);
  opacity: 0.55;
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
  border: 0;
  border-radius: var(--app-radius-lg);
  background: var(--app-surface);
  font: inherit;
  font-weight: 650;
  text-decoration: none;
  cursor: pointer;
}

.song-view__edit {
  color: var(--app-accent-text);
}

.song-view__delete {
  background: color-mix(in srgb, var(--app-destructive) 12%, var(--app-surface));
  color: var(--app-destructive);
}

.song-view__picker-row {
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

.song-view__picker-row:not(:last-child)::after {
  content: '';
  position: absolute;
  left: var(--app-space-4);
  right: 0;
  bottom: 0;
  height: var(--app-hairline);
  background: var(--app-border);
}

.song-view__picker-row:disabled {
  opacity: 0.6;
  cursor: wait;
}

.song-view__picker-title {
  font-weight: 650;
  letter-spacing: -0.01em;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-view__picker-date {
  flex-shrink: 0;
  font-size: var(--app-text-xs);
  font-weight: 700;
  color: var(--app-accent-text);
  padding: 0.2rem 0.5rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent-muted);
}

.song-view__picker-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  padding: 0 1.1rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font-weight: 650;
  text-decoration: none;
}
</style>
