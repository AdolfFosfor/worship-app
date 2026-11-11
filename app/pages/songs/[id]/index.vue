<script setup lang="ts">
import type { Setlist, SetlistWithItems, Song } from '~~/shared/types'
import type { StagePlaylistInfo } from '~/components/chart/ChordStageView.vue'
import { icons } from '~/utils/icons'
import { clampCapo, soundingKey } from '~/utils/music/capo'
import { normalizeLegacyChordsText, transposeChart } from '~/utils/music/chart'
import { keyDistance, transposeKeyLabel } from '~/utils/music/keys'
import { transposeText } from '~/utils/music/transpose'
import { localTodayKey } from '~/utils/dates'
import { songThemeMessageKey } from '~~/shared/songs/library'
import { songToInput } from '~/utils/mappers'
import { safeInternalPath } from '~/utils/safeInternalPath'

const route = useRoute()
const workspace = useWorkspaceStore()
const { t, sessionTitle, locale } = useAppLocale()

const dateLocaleTag = computed(
  () => ({ ru: 'ru-RU', ro: 'ro-RO', en: 'en-GB' })[locale.value] ?? 'en-GB',
)
const { getSong, peekSong, updateSong } = useSongs()
const { syncSongsOnActivate } = useSongsRevision()
const { fetchSetlists, songInSetlist, addSongToSetlist, getSetlist } = useSetlists()
const { rememberSetlist, peekSetlist } = useSetlistCache()
const toast = useToast()
const haptics = useHaptics()

const id = computed(() => String(route.params.id))
const song = ref<Song | null>(peekSong(id.value))
const loading = ref(!song.value)
const error = ref<string | null>(null)
const pickerVisible = ref(false)
const pickerLoading = ref(false)
const pickerBusy = ref(false)
const createSetlistOpen = ref(false)
const createSetlistSheet = ref<{ open: () => void } | null>(null)
const upcomingSetlists = ref<Setlist[]>([])

function openCreateSetlistFromPicker() {
  pickerVisible.value = false
  // После закрытия Dialog — в том же жесте клика держим soft KB через proxy.
  createSetlistSheet.value?.open()
}

/** Concert/sounding key (fixed for this view; capo only changes shapes). */
const viewSounding = ref('C')
/** Capo fret used when the capo panel is open. */
const viewCapo = ref(0)
/** Capo controls hidden by default — open via the round button. */
const capoOpen = ref(false)
/** Держим FS между песнями сет-листа (навигация remount'ит страницу). */
const stageFullscreen = useState('chord-stage-fullscreen', () => false)

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

const libraryTempo = computed(() => {
  if (!song.value?.bpm) return null
  return `${song.value.bpm} ${t('song.bpmUnit')}`
})

const libraryMeter = computed(() => song.value?.timeSignature || null)

const libraryTypes = computed(() =>
  (song.value?.types ?? []).map((type) => t(`songs.type.${type}`)),
)

const libraryThemes = computed(() =>
  (song.value?.themes ?? []).map((theme) => {
    const key = songThemeMessageKey(theme)
    return key ? t(key) : theme
  }),
)

const libraryTagsVisible = computed(
  () => libraryTypes.value.length > 0 || libraryThemes.value.length > 0,
)

const libraryFacts = computed(() => {
  const parts: string[] = []
  if (libraryTempo.value) parts.push(libraryTempo.value)
  if (libraryMeter.value) parts.push(libraryMeter.value)
  return parts.length ? parts.join(' · ') : null
})

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
  transposeText(normalizeLegacyChordsText(song.value?.chords), semitones.value),
)

const displayChart = computed(() => {
  const chart = song.value?.chordChart
  if (!chart) return null
  return transposeChart(chart, semitones.value)
})

/** Если открыли песню из сет-листа — листаем соседние в фуллскрине. */
const fromPath = computed(() => safeInternalPath(route.query.from, ''))
const setlistContextId = computed(() => {
  const match = fromPath.value.match(/^\/setlists\/([^/?#]+)$/)
  return match?.[1] ?? null
})
const setlistContext = useState<SetlistWithItems | null>('chord-stage-setlist', () => null)

watch(
  setlistContextId,
  async (sid) => {
    if (!sid) {
      if (setlistContext.value) setlistContext.value = null
      return
    }
    if (setlistContext.value?.id === sid) return
    try {
      setlistContext.value = await getSetlist(sid)
    } catch {
      setlistContext.value = null
    }
  },
  { immediate: true },
)

watch(
  () => route.path,
  (path) => {
    if (!path.startsWith('/songs/')) stageFullscreen.value = false
  },
)

const setlistIndex = computed(() => {
  const sl = setlistContext.value
  if (!sl?.items.length || !setlistContextId.value) return -1
  return sl.items.findIndex((item) => item.songId === id.value)
})

const stagePlaylist = computed<StagePlaylistInfo | null>(() => {
  const idx = setlistIndex.value
  const sl = setlistContext.value
  if (idx < 0 || !sl) return null
  return {
    index: idx + 1,
    total: sl.items.length,
    canPrev: idx > 0,
    canNext: idx < sl.items.length - 1,
  }
})

const setlistNav = computed(() => {
  const idx = setlistIndex.value
  const sl = setlistContext.value
  if (idx < 0 || !sl || sl.items.length < 2) return null
  const prev = sl.items[idx - 1]
  const next = sl.items[idx + 1]
  return {
    index: idx + 1,
    total: sl.items.length,
    canPrev: Boolean(prev),
    canNext: Boolean(next),
    prevTitle: prev?.song.title ?? '',
    nextTitle: next?.song.title ?? '',
  }
})

function setlistNeighbor(dir: 'prev' | 'next') {
  const sl = setlistContext.value
  if (!sl) return null
  const idx = setlistIndex.value
  if (idx < 0) return null
  const item = sl.items[dir === 'prev' ? idx - 1 : idx + 1]
  if (!item) return null
  return {
    songId: item.songId,
    key: item.key ?? item.song.key,
    hasChart: Boolean(item.song.chordChart),
  }
}

let setlistNavBusy = false

async function goSetlistNeighbor(dir: 'prev' | 'next') {
  if (setlistNavBusy) return
  const neighbor = setlistNeighbor(dir)
  if (!neighbor) return
  setlistNavBusy = true
  useHaptics().selection()
  if (!neighbor.hasChart) stageFullscreen.value = false
  try {
    await navigateTo({
      path: `/songs/${neighbor.songId}`,
      query: {
        key: neighbor.key,
        from: fromPath.value,
      },
    })
  } finally {
    setlistNavBusy = false
  }
}

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

if (song.value) syncViewFromSong(song.value)

const TITLE_MAX_LEN = 48
const titleFocused = ref(false)
const titleEl = ref<HTMLElement | null>(null)
const titleBusy = ref(false)
const canEditTitle = computed(() => workspace.canEditSongs)

async function syncTitleEl(raw?: string | null) {
  await nextTick()
  if (!titleEl.value || titleFocused.value) return
  const value = raw ?? song.value?.title
  if (value == null) return
  if (titleEl.value.textContent !== value) {
    titleEl.value.textContent = value
  }
}

watch(
  () => song.value?.title,
  (next) => {
    void syncTitleEl(next)
  },
)

watch(titleEl, () => {
  void syncTitleEl()
})

function readTitleText() {
  return (titleEl.value?.innerText ?? '').replace(/\s+/g, ' ').trim()
}

function placeTitleCaretAtEnd() {
  const el = titleEl.value
  if (!el) return
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function onTitlePointerDown(event: PointerEvent) {
  event.preventDefault()
  const el = titleEl.value
  if (!el || !song.value) return
  if (!titleFocused.value) {
    titleFocused.value = true
    haptics.tap()
  }
  el.focus({ preventScroll: true })
  placeTitleCaretAtEnd()
}

function onTitleFocus() {
  if (!song.value) return
  titleFocused.value = true
  placeTitleCaretAtEnd()
}

function onTitleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    titleEl.value?.blur()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    if (song.value && titleEl.value) {
      titleEl.value.textContent = song.value.title
    }
    titleEl.value?.blur()
  }
}

function onTitleBeforeInput(event: Event) {
  const e = event as InputEvent
  if (!e.inputType.startsWith('insert')) return
  const el = titleEl.value
  if (!el) return
  const sel = window.getSelection()
  const selected = sel?.toString().length ?? 0
  const len = (el.innerText || '').length - selected
  const incoming = e.data?.length ?? 1
  if (len + incoming > TITLE_MAX_LEN) {
    e.preventDefault()
  }
}

function onTitlePaste(event: ClipboardEvent) {
  event.preventDefault()
  const el = titleEl.value
  if (!el) return
  const paste = event.clipboardData?.getData('text/plain') ?? ''
  const sel = window.getSelection()
  const selected = sel?.toString().length ?? 0
  const current = el.innerText || ''
  const room = TITLE_MAX_LEN - (current.length - selected)
  if (room <= 0) return
  document.execCommand('insertText', false, paste.slice(0, room))
}

function patchCachedSongTitle(songId: string, title: string) {
  const stage = setlistContext.value
  if (stage) {
    const next = {
      ...stage,
      items: stage.items.map((item) =>
        item.songId === songId ? { ...item, song: { ...item.song, title } } : item,
      ),
    }
    setlistContext.value = next
    rememberSetlist(next)
  }
  const cachedSl = peekSetlist(setlistContextId.value ?? '')
  if (cachedSl && cachedSl.id !== stage?.id) {
    rememberSetlist({
      ...cachedSl,
      items: cachedSl.items.map((item) =>
        item.songId === songId ? { ...item, song: { ...item.song, title } } : item,
      ),
    })
  }
}

async function commitTitle() {
  titleFocused.value = false
  if (!song.value || titleBusy.value) return
  const next = readTitleText().slice(0, TITLE_MAX_LEN)
  if (!next) {
    if (titleEl.value) titleEl.value.textContent = song.value.title
    return
  }
  if (titleEl.value) titleEl.value.textContent = next
  if (next === song.value.title) return

  titleBusy.value = true
  const prev = song.value.title
  song.value = { ...song.value, title: next }
  patchCachedSongTitle(song.value.id, next)
  try {
    await updateSong(song.value.id, {
      ...songToInput(song.value),
      title: next,
    })
  } catch (e) {
    song.value = { ...song.value, title: prev }
    patchCachedSongTitle(song.value.id, prev)
    if (titleEl.value) titleEl.value.textContent = prev
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('common.saveFailed'),
      life: 4000,
    })
  } finally {
    titleBusy.value = false
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
  const cached = peekSong(id.value)
  if (cached) {
    song.value = cached
    syncViewFromSong(cached)
    loading.value = false
  } else if (!opts?.quiet) {
    loading.value = true
  }
  error.value = null
  try {
    // С кэша — сразу; force при quiet/ревизии или если кэша не было
    song.value = await getSong(id.value, {
      force: Boolean(opts?.quiet) || !cached,
    })
    syncViewFromSong(song.value)
    markSongsSynced()
  } catch (e) {
    if (!song.value) error.value = e instanceof Error ? e.message : t('songs.notFound')
  } finally {
    loading.value = false
  }
}

const { markSongsSynced } = syncSongsOnActivate(() => load({ quiet: true }))
onMounted(() => {
  void load()
})

onActivated(() => {
  // KeepAlive: другая песня в этом инстансе или устаревший кэш
  if (song.value?.id !== id.value) void load({ quiet: true })
})

async function openSetlistPicker() {
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

</script>

<template>
  <div class="app-page">
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <template v-else-if="song">
      <AppHeader>
        <template #title>
          <h1
            v-if="canEditTitle"
            ref="titleEl"
            class="song-view__title song-view__title--editable"
            :class="{ 'is-editing': titleFocused }"
            contenteditable="true"
            spellcheck="false"
            :aria-label="t('song.editTitleAria')"
            @pointerdown="onTitlePointerDown"
            @focus="onTitleFocus"
            @blur="commitTitle"
            @keydown="onTitleKeydown"
            @beforeinput="onTitleBeforeInput"
            @paste="onTitlePaste"
          />
          <h1 v-else class="song-view__title">{{ song.title }}</h1>
        </template>
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

      <nav
        v-if="setlistNav"
        class="song-view__setlist-nav"
        :aria-label="t('stage.setlistPos', { index: setlistNav.index, total: setlistNav.total })"
      >
        <div class="song-view__setlist-side song-view__setlist-side--prev">
          <button
            v-if="setlistNav.canPrev"
            type="button"
            class="song-view__setlist-btn app-ring-hover"
            :aria-label="t('stage.prevSong')"
            @click="goSetlistNeighbor('prev')"
          >
            <AppIcon :name="icons.arrowLeft" size="1.05rem" />
            <span class="song-view__setlist-peer">{{ setlistNav.prevTitle }}</span>
          </button>
        </div>
        <span class="song-view__setlist-pos" aria-hidden="true">
          {{ setlistNav.index }}/{{ setlistNav.total }}
        </span>
        <div class="song-view__setlist-side song-view__setlist-side--next">
          <button
            v-if="setlistNav.canNext"
            type="button"
            class="song-view__setlist-btn song-view__setlist-btn--next app-ring-hover"
            :aria-label="t('stage.nextSong')"
            @click="goSetlistNeighbor('next')"
          >
            <span class="song-view__setlist-peer">{{ setlistNav.nextTitle }}</span>
            <AppIcon :name="icons.chevronRight" size="1.05rem" />
          </button>
        </div>
      </nav>

      <div v-if="libraryTagsVisible" class="song-view__tags app-chip-row">
        <span
          v-for="(tag, index) in libraryTypes"
          :key="`type-${tag}-${index}`"
          class="app-pill app-pill--type"
        >{{ tag }}</span>
        <span
          v-for="(tag, index) in libraryThemes"
          :key="`theme-${tag}-${index}`"
          class="app-pill app-pill--theme"
        >{{ tag }}</span>
      </div>

      <section class="song-view__panel app-panel">
        <div class="song-view__row song-view__row--head">
          <div class="song-view__copy">
            <p v-if="song.artist" class="song-view__artist">{{ song.artist }}</p>
            <span class="song-view__label">{{ t('songs.originalKey') }}</span>
            <p class="song-view__original">{{ originalSounding }}</p>
          </div>
          <button
            type="button"
            class="song-view__capo-btn app-ring-hover"
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
          :title="song.title"
          :facts="libraryFacts"
          :playlist="stagePlaylist"
          :fullscreen="stageFullscreen"
          @update:fullscreen="stageFullscreen = $event"
          @prev="goSetlistNeighbor('prev')"
          @next="goSetlistNeighbor('next')"
        />
      </AppSection>
      <AppSection v-else-if="displayChords" :title="t('song.fieldChords')">
        <p v-if="libraryFacts" class="song-view__library-facts">{{ libraryFacts }}</p>
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
        <NuxtLink
          :to="{
            path: `/songs/${song.id}/edit`,
            query: {
              ...(fromPath ? { from: fromPath } : {}),
              ...(typeof route.query.key === 'string' ? { key: route.query.key } : {}),
            },
          }"
          class="song-view__edit"
        >
          <AppIcon :name="icons.edit" size="1.05rem" />
          {{ t('common.edit') }}
        </NuxtLink>
      </div>

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
              class="song-view__picker-cta"
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
            class="song-view__picker-row"
            :autofocus="index === 0"
            :disabled="pickerBusy"
            @click="addToSetlist(item)"
          >
            <span class="song-view__picker-title">{{ sessionTitle(item.title) }}</span>
            <span class="song-view__picker-date">{{ formatSetlistDate(item.serviceDate) }}</span>
          </button>
        </AppSurfaceList>
      </Dialog>

      <CreateSetlistSheet ref="createSetlistSheet" v-model:open="createSetlistOpen" />
    </template>
  </div>
</template>

<style scoped>
.song-view__title {
  display: block;
  width: fit-content;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 2.125rem !important;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.12;
  color: var(--app-ink);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-view__title--editable {
  cursor: pointer;
  outline: none;
  caret-color: var(--app-accent-text);
  box-shadow: inset 0 -1.5px 0 transparent;
  transition: box-shadow 160ms var(--app-ease);
}

.song-view__title--editable.is-editing {
  text-overflow: clip;
  box-shadow: inset 0 -1.5px 0 var(--app-accent);
}

.song-view__title--editable::selection {
  background: color-mix(in srgb, var(--app-accent) 22%, transparent);
}

.song-view__setlist-nav {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--app-space-2);
  margin: -0.35rem 0 0.15rem;
  padding: 0.2rem 0;
}

.song-view__setlist-side {
  display: flex;
  min-width: 0;
}

.song-view__setlist-side--prev {
  justify-content: flex-start;
}

.song-view__setlist-side--next {
  justify-content: flex-end;
}

.song-view__setlist-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  width: fit-content;
  max-width: 100%;
  min-height: 2.25rem;
  margin: 0;
  padding: 0.3rem 0.55rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-accent-text);
  font: inherit;
  font-size: var(--app-text-xs);
  font-weight: 650;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--app-duration) var(--app-ease),
    opacity var(--app-duration) var(--app-ease),
    outline-color var(--app-duration) var(--app-ease);
}

.song-view__setlist-btn--next {
  text-align: right;
}

.song-view__setlist-peer {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-view__setlist-pos {
  justify-self: center;
  font-size: var(--app-text-2xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--app-muted);
}

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

.song-view__artist {
  margin: 0 0 0.35rem;
  font-size: var(--app-text-sm);
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--app-muted);
}

.song-view__original {
  margin: 0;
  font-size: var(--app-text-2xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--app-ink);
}

.song-view__library-facts {
  margin: 0 0 var(--app-space-2);
  color: var(--app-ink);
  font-size: var(--app-text-md);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.song-view__tags {
  margin-block-start: calc(var(--app-space-1) - var(--app-space-5));
  margin-inline: calc(-1 * var(--app-space-4));
  padding-inline: var(--app-space-4);
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
    transform var(--app-duration) var(--app-ease),
    outline-color var(--app-duration) var(--app-ease);
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

.song-view__edit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  width: 100%;
  min-height: var(--app-touch-min);
  border: 0;
  border-radius: var(--app-radius-lg);
  background: var(--app-surface);
  color: var(--app-accent-text);
  font: inherit;
  font-weight: 650;
  text-decoration: none;
  cursor: pointer;
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
