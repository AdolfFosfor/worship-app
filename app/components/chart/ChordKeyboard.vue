<script setup lang="ts">
import type { AnnotationPreset } from '~~/shared/types'
import { ANNOTATION_PRESETS } from '~~/shared/types'
import {
  isFavoriteChord,
  pushRecentChord,
  readFavoriteChords,
  readRecentChords,
  toggleFavoriteChord,
} from '~/utils/music/chart'
import { icons } from '~/utils/icons'
import { useAuthStore } from '~/stores/auth'
import { useKeyboardInset } from '~/composables/useKeyboardInset'

const { t } = useAppLocale()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  chord: [symbol: string]
  annotation: [text: string, preset?: AnnotationPreset]
  nextBar: []
}>()

const kb = useKeyboardInset()
const kbOpen = kb.open

const auth = useAuthStore()
const userId = computed(() => auth.user?.id ?? 'anon')

type Tab = 'chords' | 'build' | 'notes'

const tab = ref<Tab>('chords')
const showAllQuick = ref(false)
const noteSheetOpen = ref(false)
const pendingNoteFocus = ref(false)
const focusProxy = ref<HTMLInputElement | null>(null)
const noteInput = ref<HTMLInputElement | null>(null)
let panelResizeObs: ResizeObserver | null = null

const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const qualities = ['', 'm', '7', 'm7', 'maj7', 'sus4', 'add9', 'dim', 'aug', '6'] as const
const quickCompact = ['G', 'C', 'D', 'Em', 'Am', 'F', 'Bm', 'A']
const quickAll = ['G', 'C', 'D', 'Em', 'Am', 'F', 'Bm', 'A', 'E', 'Dm', 'B', 'F#m', 'Bb', 'Cm', 'Gm', 'D7']

const root = ref('G')
const accidental = ref<'' | '#' | 'b'>('')
const quality = ref<(typeof qualities)[number]>('')
const bassRoot = ref('')
const bassAccidental = ref<'' | '#' | 'b'>('')
const customNote = ref('')

const recents = ref<string[]>([])
const favorites = ref<string[]>([])
const panelEl = ref<HTMLElement | null>(null)

const swipeStartY = ref<number | null>(null)
const swipeStartT = ref(0)
const swipeDelta = ref(0)
const swipeDragging = ref(false)

/** Ниже порог + flick — на телефоне проще свернуть. */
const CLOSE_PX = 44
const FLICK_V = 0.35 // px/ms

function refreshPrefs() {
  recents.value = readRecentChords(userId.value)
  favorites.value = readFavoriteChords(userId.value)
}

function syncShellNav(hide: boolean) {
  if (!import.meta.client) return
  document.querySelector('.app-shell')?.classList.toggle('app-shell--chord-kb-open', hide)
}

function publishHeight() {
  if (!import.meta.client) return
  const sheetH =
    props.open && !noteSheetOpen.value && panelEl.value
      ? Math.round(panelEl.value.getBoundingClientRect().height)
      : 0
  document.documentElement.style.setProperty('--chart-kb-inset', `${sheetH}px`)
  document.documentElement.style.setProperty('--app-composer-inset', '0px')
}

const sheetStyle = computed(() => ({
  height: 'auto',
  bottom: '0px',
  transform: `translateY(${Math.max(0, swipeDelta.value)}px)`,
  transition: swipeDragging.value
    ? 'none'
    : 'transform 180ms cubic-bezier(0.32, 0.72, 0, 1)',
}))

function setTab(next: Tab) {
  tab.value = next
  if (next !== 'notes') closeNoteSheet()
  void nextTick(() => publishHeight())
}

function openNoteSheet() {
  focusProxy.value?.focus({ preventScroll: true })
  pendingNoteFocus.value = true
  noteSheetOpen.value = true
  customNote.value = ''
  void nextTick(() => {
    publishHeight()
    kb.measure()
  })
}

function onNoteSheetAfterEnter() {
  if (!pendingNoteFocus.value) return
  pendingNoteFocus.value = false
  void nextTick(() => {
    noteInput.value?.focus({ preventScroll: true })
    window.setTimeout(() => {
      noteInput.value?.focus({ preventScroll: true })
      kb.measure()
    }, 40)
  })
}

function closeNoteSheet() {
  pendingNoteFocus.value = false
  noteSheetOpen.value = false
  customNote.value = ''
  noteInput.value?.blur()
  focusProxy.value?.blur()
  void nextTick(() => {
    publishHeight()
    kb.measure()
  })
}

function confirmNoteSheet() {
  const text = customNote.value.trim()
  if (text) emit('annotation', text)
  closeNoteSheet()
}

watch(
  () => props.open,
  async (open) => {
    syncShellNav(open)
    if (open) {
      refreshPrefs()
      tab.value = 'chords'
      showAllQuick.value = false
      swipeDelta.value = 0
      swipeDragging.value = false
      swipeStartY.value = null
      closeNoteSheet()
    } else {
      closeNoteSheet()
    }
    await nextTick()
    publishHeight()
  },
)

watch([tab, showAllQuick, noteSheetOpen, kbOpen], async () => {
  await nextTick()
  publishHeight()
})

const shellUiActive = ref(true)

function clearShellChrome() {
  syncShellNav(false)
  document.documentElement.style.setProperty('--chart-kb-inset', '0px')
  document.documentElement.style.setProperty('--app-composer-inset', '0px')
}

onMounted(() => {
  if (props.open) syncShellNav(true)
  void nextTick(() => {
    publishHeight()
    if (panelEl.value && typeof ResizeObserver !== 'undefined') {
      panelResizeObs = new ResizeObserver(() => publishHeight())
      panelResizeObs.observe(panelEl.value)
    }
  })
})

onActivated(() => {
  shellUiActive.value = true
  if (props.open) {
    syncShellNav(true)
    nextTick(() => publishHeight())
  }
})

onDeactivated(() => {
  shellUiActive.value = false
  clearShellChrome()
})

onBeforeUnmount(() => {
  panelResizeObs?.disconnect()
  panelResizeObs = null
  shellUiActive.value = false
  clearShellChrome()
})

const builtSymbol = computed(() => {
  const r = `${root.value}${accidental.value}`
  const bass = bassRoot.value ? `/${bassRoot.value}${bassAccidental.value}` : ''
  return `${r}${quality.value}${bass}`
})

const quickList = computed(() => (showAllQuick.value ? quickAll : quickCompact))

function emitChord(symbol: string) {
  const s = symbol.trim()
  if (!s) return
  pushRecentChord(userId.value, s)
  refreshPrefs()
  emit('chord', s)
}

function toggleFav(symbol: string) {
  favorites.value = toggleFavoriteChord(userId.value, symbol)
}

function favActive(symbol: string) {
  return isFavoriteChord(userId.value, symbol)
}

function onSwipePointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  // Не стартуем жест с кнопок табов / next / close
  const t = e.target
  if (t instanceof Element && t.closest('.chord-kb__tab, .chord-kb__next, .chord-kb__close')) {
    return
  }
  swipeStartY.value = e.clientY
  swipeStartT.value = performance.now()
  swipeDelta.value = 0
  swipeDragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onSwipePointerMove(e: PointerEvent) {
  if (swipeStartY.value == null) return
  const raw = Math.max(0, e.clientY - swipeStartY.value)
  // Лёгкое сопротивление после ~72px — жест не «прыгает»
  swipeDelta.value = raw < 72 ? raw : 72 + (raw - 72) * 0.4
}

function onSwipePointerUp(e: PointerEvent) {
  if (swipeStartY.value == null) return
  const dy = Math.max(0, e.clientY - swipeStartY.value)
  const dt = Math.max(16, performance.now() - swipeStartT.value)
  const velocity = dy / dt
  const shouldClose = dy >= CLOSE_PX || (dy >= 18 && velocity >= FLICK_V)
  swipeStartY.value = null
  swipeDragging.value = false
  if (shouldClose) {
    swipeDelta.value = 0
    emit('close')
    return
  }
  swipeDelta.value = 0
}

function expandQuick() {
  showAllQuick.value = true
}
</script>

<template>
  <Teleport to=".app-shell">
    <input
      ref="focusProxy"
      class="chord-kb__focus-proxy"
      type="text"
      tabindex="-1"
      aria-hidden="true"
      inputmode="text"
      autocomplete="off"
    >

    <aside
      v-show="shellUiActive && open && !noteSheetOpen"
      ref="panelEl"
      class="chord-kb"
      :class="`chord-kb--${tab}`"
      :style="sheetStyle"
      :aria-label="t('chartKb.ariaPanel')"
      @pointerdown.stop
    >
      <div
        class="chord-kb__grab"
        @pointerdown="onSwipePointerDown"
        @pointermove="onSwipePointerMove"
        @pointerup="onSwipePointerUp"
        @pointercancel="onSwipePointerUp"
      >
        <button
          type="button"
          class="chord-kb__handle"
          :aria-label="t('common.close')"
          @click="emit('close')"
        />

        <div class="chord-kb__top">
          <div class="chord-kb__tabs" role="tablist">
            <button
              type="button"
              class="chord-kb__tab"
              :class="{ 'chord-kb__tab--on': tab === 'chords' }"
              @click="setTab('chords')"
            >
              {{ t('chartKb.tabChords') }}
            </button>
            <button
              type="button"
              class="chord-kb__tab"
              :class="{ 'chord-kb__tab--on': tab === 'build' }"
              @click="setTab('build')"
            >
              {{ t('chartKb.tabBuild') }}
            </button>
            <button
              type="button"
              class="chord-kb__tab"
              :class="{ 'chord-kb__tab--on': tab === 'notes' }"
              @click="setTab('notes')"
            >
              {{ t('chartKb.tabNotes') }}
            </button>
          </div>
          <button type="button" class="chord-kb__next" @click="emit('nextBar')">{{ t('chartKb.nextBar') }}</button>
          <button type="button" class="chord-kb__close" :aria-label="t('common.close')" @click="emit('close')">
            <AppIcon :name="icons.close" size="1.05rem" />
          </button>
        </div>
      </div>

      <div class="chord-kb__body">
        <div v-if="tab === 'chords'" class="chord-kb__panel">
          <div v-if="recents.length" class="chord-kb__block">
            <span class="chord-kb__label">{{ t('chartKb.recents') }}</span>
            <div class="chord-kb__rail">
              <button
                v-for="c in recents"
                :key="`r-${c}`"
                type="button"
                class="chord-kb__chip"
                @click="emitChord(c)"
              >
                {{ c }}
              </button>
            </div>
          </div>

          <div v-if="favorites.length" class="chord-kb__block">
            <span class="chord-kb__label">{{ t('chartKb.favorites') }}</span>
            <div class="chord-kb__rail">
              <button
                v-for="c in favorites"
                :key="`f-${c}`"
                type="button"
                class="chord-kb__chip chord-kb__chip--fav"
                @click="emitChord(c)"
              >
                {{ c }}
              </button>
            </div>
          </div>

          <div class="chord-kb__block">
            <div class="chord-kb__label-row">
              <span class="chord-kb__label">{{ t('chartKb.quick') }}</span>
              <button
                v-if="!showAllQuick"
                type="button"
                class="chord-kb__more"
                @click="expandQuick"
              >
                {{ t('chartKb.showAll') }}
              </button>
            </div>
            <div class="chord-kb__grid">
              <button
                v-for="c in quickList"
                :key="`q-${c}`"
                type="button"
                class="chord-kb__chip"
                @click="emitChord(c)"
              >
                {{ c }}
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="tab === 'build'" class="chord-kb__panel">
          <div class="chord-kb__preview">
            <strong>{{ builtSymbol }}</strong>
            <button
              type="button"
              class="chord-kb__star"
              :class="{ 'chord-kb__star--on': favActive(builtSymbol) }"
              :aria-label="t('chartKb.ariaFavorite')"
              @click="toggleFav(builtSymbol)"
            >
              ★
            </button>
            <button type="button" class="chord-kb__add" @click="emitChord(builtSymbol)">
              {{ t('common.add') }}
            </button>
          </div>

          <div class="chord-kb__block">
            <span class="chord-kb__label">{{ t('chartKb.note') }}</span>
            <div class="chord-kb__note-row">
              <div class="chord-kb__roots">
                <button
                  v-for="r in roots"
                  :key="r"
                  type="button"
                  class="chord-kb__chip"
                  :class="{ 'chord-kb__chip--on': root === r }"
                  @click="root = r"
                >
                  {{ r }}
                </button>
              </div>
              <div class="chord-kb__accidentals">
                <button
                  type="button"
                  class="chord-kb__chip chord-kb__chip--round"
                  :class="{ 'chord-kb__chip--on': accidental === '' }"
                  :aria-label="t('chartKb.accidentalNatural')"
                  @click="accidental = ''"
                >
                  <AppIcon :name="icons.none" size="1rem" />
                </button>
                <button
                  type="button"
                  class="chord-kb__chip chord-kb__chip--round"
                  :class="{ 'chord-kb__chip--on': accidental === '#' }"
                  @click="accidental = '#'"
                >
                  ♯
                </button>
                <button
                  type="button"
                  class="chord-kb__chip chord-kb__chip--round"
                  :class="{ 'chord-kb__chip--on': accidental === 'b' }"
                  @click="accidental = 'b'"
                >
                  ♭
                </button>
              </div>
            </div>
          </div>

          <div class="chord-kb__block">
            <span class="chord-kb__label">{{ t('chartKb.quality') }}</span>
            <div class="chord-kb__grid">
              <button
                v-for="q in qualities"
                :key="q || 'none'"
                type="button"
                class="chord-kb__chip"
                :class="{
                  'chord-kb__chip--on': quality === q,
                  'chord-kb__chip--round': !q,
                }"
                @click="quality = q"
              >
                <AppIcon v-if="!q" :name="icons.none" size="1rem" />
                <template v-else>{{ q }}</template>
              </button>
            </div>
          </div>

          <div class="chord-kb__block">
            <span class="chord-kb__label">{{ t('chartKb.bass') }}</span>
            <div class="chord-kb__grid">
              <button
                type="button"
                class="chord-kb__chip chord-kb__chip--round"
                :class="{ 'chord-kb__chip--on': !bassRoot }"
                :aria-label="t('chartKb.bassNone')"
                @click="bassRoot = ''; bassAccidental = ''"
              >
                <AppIcon :name="icons.none" size="1rem" />
              </button>
              <button
                v-for="r in roots"
                :key="`b-${r}`"
                type="button"
                class="chord-kb__chip"
                :class="{ 'chord-kb__chip--on': bassRoot === r }"
                @click="bassRoot = r"
              >
                /{{ r }}
              </button>
            </div>
          </div>
        </div>

        <div v-else class="chord-kb__panel">
          <div class="chord-kb__block">
            <span class="chord-kb__label">{{ t('chartKb.presets') }}</span>
            <div class="chord-kb__grid">
              <button
                v-for="p in ANNOTATION_PRESETS"
                :key="p.preset"
                type="button"
                class="chord-kb__chip chord-kb__chip--note"
                @click="emit('annotation', p.text, p.preset)"
              >
                {{ p.text }}
              </button>
            </div>
          </div>

          <div class="chord-kb__block">
            <button type="button" class="chord-kb__composer-cta" @click="openNoteSheet">
              {{ t('chartKb.customNote') }}
            </button>
          </div>
        </div>
      </div>
    </aside>

    <Transition name="chart-note-sheet" @after-enter="onNoteSheetAfterEnter">
      <div
        v-if="shellUiActive && open && noteSheetOpen"
        class="chart-note-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="t('chartKb.noteSheetTitle')"
        @pointerdown.stop
      >
        <button
          type="button"
          class="chart-note-sheet__mask"
          :aria-label="t('common.close')"
          @click="closeNoteSheet"
        />
        <div class="chart-note-sheet__panel">
          <header class="chart-note-sheet__head">
            <button
              type="button"
              class="chart-note-sheet__icon-btn"
              :aria-label="t('common.close')"
              @click="closeNoteSheet"
            >
              <AppIcon :name="icons.close" size="1.1rem" />
            </button>
            <h2 class="chart-note-sheet__title">{{ t('chartKb.noteSheetTitle') }}</h2>
            <button
              type="button"
              class="chart-note-sheet__done"
              :disabled="!customNote.trim()"
              @click="confirmNoteSheet"
            >
              {{ t('common.add') }}
            </button>
          </header>
          <div class="chart-note-sheet__body">
            <input
              ref="noteInput"
              v-model="customNote"
              class="chart-note-sheet__field"
              maxlength="32"
              :placeholder="t('chartKb.customNotePlaceholder')"
              enterkeyhint="done"
              autocomplete="off"
              @keydown.enter.prevent="confirmNoteSheet"
            >
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.chord-kb__focus-proxy {
  position: fixed;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
  border: 0;
  padding: 0;
  margin: 0;
  pointer-events: none;
}

.chord-kb {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  height: auto;
  padding: 0.15rem calc(var(--app-safe-right) + var(--app-space-3))
    calc(var(--app-safe-bottom) + var(--app-space-2))
    calc(var(--app-safe-left) + var(--app-space-3));
  border-radius: var(--app-radius-xl) var(--app-radius-xl) 0 0;
  border: var(--app-hairline) solid var(--app-border);
  border-bottom: 0;
  background: var(--app-surface);
  box-shadow: 0 -10px 28px color-mix(in srgb, #000 10%, transparent);
  overflow: hidden;
  transition: none;
}

.chord-kb__grab {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  touch-action: none;
  margin-bottom: var(--app-space-2);
  cursor: grab;
}

.chord-kb__handle {
  align-self: stretch;
  width: 100%;
  height: 1.65rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  cursor: grab;
  touch-action: none;
  position: relative;
  flex-shrink: 0;
}

.chord-kb__handle::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2.5rem;
  height: 0.3rem;
  border-radius: 999px;
  background: var(--app-border-strong);
  transform: translate(-50%, -50%);
}

.chord-kb__top {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-shrink: 0;
}

.chord-kb__tabs {
  display: flex;
  flex: 1;
  min-width: 0;
  padding: 0.12rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
}

.chord-kb__tab {
  flex: 1;
  min-height: 1.7rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: transparent;
  color: var(--app-muted);
  font: inherit;
  font-size: var(--app-text-2xs);
  font-weight: 700;
  cursor: pointer;
}

.chord-kb__tab--on {
  background: var(--app-bg);
  color: var(--app-ink);
  box-shadow: var(--app-shadow-soft);
}

.chord-kb__next,
.chord-kb__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.7rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-ink);
  font: inherit;
  font-size: var(--app-text-2xs);
  font-weight: 700;
  cursor: pointer;
}

.chord-kb__next {
  padding: 0 0.55rem;
  color: var(--app-accent-text);
  white-space: nowrap;
}

.chord-kb__close {
  width: 1.7rem;
  padding: 0;
}

.chord-kb__body {
  flex: 0 0 auto;
  min-height: 0;
  overflow: visible;
}

.chord-kb__panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.chord-kb__note-row {
  display: flex;
  align-items: flex-start;
  gap: var(--app-space-2);
}

.chord-kb__roots {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chord-kb__accidentals {
  display: flex;
  flex-shrink: 0;
  gap: 0.35rem;
  align-items: center;
  margin-left: auto;
}

.chord-kb__chip--round {
  width: 2rem;
  height: 2rem;
  min-height: 2rem;
  padding: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chord-kb__block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.chord-kb__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.chord-kb__label {
  font-size: 0.625rem;
  font-weight: 750;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.chord-kb__more {
  border: 0;
  background: transparent;
  color: var(--app-accent-text);
  font: inherit;
  font-size: var(--app-text-2xs);
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.chord-kb__rail {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.15rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.chord-kb__rail::-webkit-scrollbar {
  display: none;
}

.chord-kb__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chord-kb__chip {
  flex-shrink: 0;
  min-height: 2rem;
  padding: 0 0.65rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-ink);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 700;
  cursor: pointer;
}

.chord-kb__chip:active {
  transform: scale(0.96);
}

.chord-kb__chip--on {
  background: var(--app-accent);
  color: var(--app-accent-contrast);
}

.chord-kb__chip--fav {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-warn) 55%, transparent);
}

.chord-kb__chip--note {
  color: var(--chart-annotation-ink);
  background: var(--chart-annotation-bg);
}

.chord-kb__composer-cta {
  min-height: 2.5rem;
  width: 100%;
  border: var(--app-hairline) dashed var(--app-border-strong);
  border-radius: var(--app-radius-lg);
  background: transparent;
  color: var(--app-accent-text);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 700;
  cursor: pointer;
}

.chart-note-sheet {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.chart-note-sheet__mask {
  position: absolute;
  inset: 0;
  z-index: 0;
  border: 0;
  margin: 0;
  padding: 0;
  background: color-mix(in srgb, #000 48%, transparent);
  cursor: pointer;
  pointer-events: auto;
}

.chart-note-sheet__panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  width: 100%;
  max-height: min(16rem, calc(var(--app-frame-height, 100lvh) * 0.38));
  padding-top: max(
    var(--app-safe-top),
    env(safe-area-inset-top, 0px),
    var(--app-overlay-gap)
  );
  padding-left: max(var(--app-safe-left), env(safe-area-inset-left, 0px));
  padding-right: max(var(--app-safe-right), env(safe-area-inset-right, 0px));
  padding-bottom: var(--app-space-3);
  border-radius: 0 0 var(--app-radius-xl) var(--app-radius-xl);
  background: var(--app-surface);
  box-shadow: 0 16px 40px color-mix(in srgb, #000 28%, transparent);
  pointer-events: auto;
}

.chart-note-sheet__head {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-shrink: 0;
  min-height: 2.75rem;
  padding: var(--app-space-2) var(--app-space-3);
}

.chart-note-sheet__title {
  flex: 1;
  margin: 0;
  min-width: 0;
  font-size: var(--app-text-md);
  font-weight: 750;
  letter-spacing: -0.02em;
  color: var(--app-ink);
  text-align: center;
}

.chart-note-sheet__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-ink);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.chart-note-sheet__done {
  flex-shrink: 0;
  min-height: 2.25rem;
  padding: 0 0.85rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 750;
  cursor: pointer;
}

.chart-note-sheet__done:disabled {
  opacity: 0.4;
  cursor: default;
}

.chart-note-sheet__body {
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 0 var(--app-space-3);
}

.chart-note-sheet__field {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.65rem 0.75rem;
  border: var(--app-hairline) solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg);
  color: var(--app-ink);
  font: inherit;
  font-size: 16px;
}

.chart-note-sheet-enter-active,
.chart-note-sheet-leave-active {
  transition: opacity 160ms var(--app-ease, ease);
}

.chart-note-sheet-enter-active .chart-note-sheet__panel,
.chart-note-sheet-leave-active .chart-note-sheet__panel {
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.chart-note-sheet-enter-from,
.chart-note-sheet-leave-to {
  opacity: 0;
}

.chart-note-sheet-enter-from .chart-note-sheet__panel,
.chart-note-sheet-leave-to .chart-note-sheet__panel {
  transform: translateY(-12%);
}

.chord-kb__preview {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  min-height: 2.5rem;
  padding: 0.2rem 0.35rem 0.2rem 0.75rem;
  border-radius: var(--app-radius-lg);
  background: var(--app-hover);
}

.chord-kb__preview strong {
  flex: 1;
  font-size: var(--app-text-xl);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.chord-kb__star {
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: transparent;
  color: var(--app-faint);
  cursor: pointer;
}

.chord-kb__star--on {
  color: var(--app-warn);
}

.chord-kb__add {
  min-height: 2.5rem;
  padding: 0 0.75rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 750;
  cursor: pointer;
}

.chord-kb__add:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
