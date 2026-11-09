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
type Sheet = 'compact' | 'expanded' | 'full'

const tab = ref<Tab>('chords')
const sheet = ref<Sheet>('compact')
const showAllQuick = ref(false)
/** Telegram/WhatsApp-style composer над системной KB */
const composerOpen = ref(false)
const composerEl = ref<HTMLElement | null>(null)
const composerInput = ref<HTMLInputElement | null>(null)

const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const qualities = ['', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', 'add9', 'dim', 'aug', '6', '9'] as const
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
const swipeDelta = ref(0)

const SHEET_ORDER: Sheet[] = ['compact', 'expanded', 'full']
const SHEET_VH: Record<Sheet, number> = {
  compact: 32,
  expanded: 46,
  full: 62,
}
const SHEET_CAP: Record<Sheet, number> = {
  compact: 216,
  expanded: 304,
  full: 416,
}

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
  // При открытом composer sheet скрыт — учитываем только composer.
  const sheetH =
    props.open && !composerOpen.value && panelEl.value
      ? Math.round(panelEl.value.getBoundingClientRect().height)
      : 0
  const composerH =
    composerOpen.value && composerEl.value
      ? Math.round(composerEl.value.getBoundingClientRect().height)
      : composerOpen.value
        ? 56
        : 0
  document.documentElement.style.setProperty('--chart-kb-inset', `${sheetH + composerH}px`)
  document.documentElement.style.setProperty('--app-composer-inset', `${composerH}px`)
}

const sheetStyle = computed(() => {
  const mode = sheet.value
  const layoutH = import.meta.client ? window.innerHeight : 700
  const preferred = Math.round((layoutH * SHEET_VH[mode]) / 100)
  const height = Math.min(preferred, SHEET_CAP[mode])
  return {
    height: `${height}px`,
    maxHeight: `${height}px`,
    bottom: '0px',
    transform: swipeDelta.value
      ? `translateY(${Math.max(0, swipeDelta.value)}px)`
      : undefined,
  }
})

const composerStyle = computed(() => ({
  bottom: 'var(--app-keyboard-inset, 0px)',
}))

function setSheet(next: Sheet) {
  sheet.value = next
  if (next === 'compact') showAllQuick.value = false
}

function setTab(next: Tab) {
  tab.value = next
  if (next !== 'notes') closeComposer()
  if (next === 'build' || next === 'notes') setSheet('full')
  else if (sheet.value === 'full') setSheet('expanded')
}

function openComposer() {
  // Sheet прячем — только composer над KB (как Telegram).
  composerOpen.value = true
  customNote.value = ''
  if (import.meta.client) {
    document.documentElement.style.setProperty('--app-composer-inset', '56px')
    document.documentElement.style.setProperty('--chart-kb-inset', '56px')
  }
  void nextTick(() => {
    publishHeight()
    composerInput.value?.focus({ preventScroll: true })
    kb.measure()
    window.setTimeout(() => {
      publishHeight()
      kb.measure()
    }, 200)
  })
}

function closeComposer() {
  composerOpen.value = false
  customNote.value = ''
  composerInput.value?.blur()
  void nextTick(() => {
    publishHeight()
    kb.measure()
  })
}

function submitCustomNote() {
  const text = customNote.value.trim()
  if (!text) return
  emit('annotation', text)
  customNote.value = ''
  closeComposer()
}

watch(
  () => props.open,
  async (open) => {
    syncShellNav(open)
    if (open) {
      refreshPrefs()
      tab.value = 'chords'
      sheet.value = 'compact'
      showAllQuick.value = false
      swipeDelta.value = 0
      closeComposer()
    } else {
      closeComposer()
    }
    await nextTick()
    publishHeight()
  },
)

watch([sheet, tab, showAllQuick, composerOpen, kbOpen], async () => {
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
  nextTick(() => publishHeight())
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
  shellUiActive.value = false
  clearShellChrome()
})

const builtSymbol = computed(() => {
  const r = `${root.value}${accidental.value}`
  const bass = bassRoot.value ? `/${bassRoot.value}${bassAccidental.value}` : ''
  return `${r}${quality.value}${bass}`
})

const quickList = computed(() =>
  showAllQuick.value || sheet.value !== 'compact' ? quickAll : quickCompact,
)

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

function onHandlePointerDown(e: PointerEvent) {
  swipeStartY.value = e.clientY
  swipeDelta.value = 0
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onHandlePointerMove(e: PointerEvent) {
  if (swipeStartY.value == null) return
  swipeDelta.value = e.clientY - swipeStartY.value
}

function onHandlePointerUp() {
  const dy = swipeDelta.value
  swipeStartY.value = null
  swipeDelta.value = 0
  const idx = SHEET_ORDER.indexOf(sheet.value)

  if (dy > 90) {
    if (idx <= 0) emit('close')
    else setSheet(SHEET_ORDER[idx - 1]!)
    return
  }
  if (dy < -70) {
    if (idx < SHEET_ORDER.length - 1) setSheet(SHEET_ORDER[idx + 1]!)
  }
}

function expandQuick() {
  showAllQuick.value = true
  if (sheet.value === 'compact') setSheet('expanded')
}
</script>

<template>
  <Teleport to=".app-shell">
    <aside
      v-show="shellUiActive && open && !composerOpen"
      ref="panelEl"
      class="chord-kb"
      :class="[`chord-kb--${sheet}`]"
      :style="sheetStyle"
      :aria-label="t('chartKb.ariaPanel')"
      @pointerdown.stop
    >
      <button
        type="button"
        class="chord-kb__handle"
        :aria-label="t('chartKb.ariaResize')"
        @pointerdown="onHandlePointerDown"
        @pointermove="onHandlePointerMove"
        @pointerup="onHandlePointerUp"
        @pointercancel="onHandlePointerUp"
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
                v-if="!showAllQuick && sheet === 'compact'"
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
            <div class="chord-kb__grid">
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
              <button
                type="button"
                class="chord-kb__chip"
                :class="{ 'chord-kb__chip--on': accidental === '' }"
                @click="accidental = ''"
              >
                ♮
              </button>
              <button
                type="button"
                class="chord-kb__chip"
                :class="{ 'chord-kb__chip--on': accidental === '#' }"
                @click="accidental = '#'"
              >
                ♯
              </button>
              <button
                type="button"
                class="chord-kb__chip"
                :class="{ 'chord-kb__chip--on': accidental === 'b' }"
                @click="accidental = 'b'"
              >
                ♭
              </button>
            </div>
          </div>

          <div class="chord-kb__block">
            <span class="chord-kb__label">{{ t('chartKb.quality') }}</span>
            <div class="chord-kb__grid">
              <button
                v-for="q in qualities"
                :key="q || 'maj'"
                type="button"
                class="chord-kb__chip"
                :class="{ 'chord-kb__chip--on': quality === q }"
                @click="quality = q"
              >
                {{ q || 'maj' }}
              </button>
            </div>
          </div>

          <div class="chord-kb__block">
            <span class="chord-kb__label">{{ t('chartKb.bass') }}</span>
            <div class="chord-kb__grid">
              <button
                type="button"
                class="chord-kb__chip"
                :class="{ 'chord-kb__chip--on': !bassRoot }"
                @click="bassRoot = ''; bassAccidental = ''"
              >
                {{ t('chartKb.bassNone') }}
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
            <button type="button" class="chord-kb__composer-cta" @click="openComposer">
              {{ t('chartKb.customNote') }}
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Composer над системной KB (как Telegram / WhatsApp) -->
    <Transition name="note-composer">
      <div
        v-if="shellUiActive && open && composerOpen"
        ref="composerEl"
        class="note-composer"
        :class="{ 'note-composer--kb': kbOpen }"
        :style="composerStyle"
        @pointerdown.stop
      >
        <input
          ref="composerInput"
          v-model="customNote"
          class="note-composer__input"
          maxlength="32"
          :placeholder="t('chartKb.customNotePlaceholder')"
          enterkeyhint="done"
          autocomplete="off"
          @keydown.enter.prevent="submitCustomNote"
        >
        <button
          type="button"
          class="note-composer__add"
          :disabled="!customNote.trim()"
          @click="submitCustomNote"
        >
          {{ t('common.add') }}
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.chord-kb {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  padding: 0.2rem calc(var(--app-safe-right) + var(--app-space-3))
    calc(var(--app-safe-bottom) + var(--app-space-2))
    calc(var(--app-safe-left) + var(--app-space-3));
  border-radius: var(--app-radius-xl) var(--app-radius-xl) 0 0;
  border: var(--app-hairline) solid var(--app-border);
  border-bottom: 0;
  background: var(--app-surface);
  box-shadow: 0 -10px 28px color-mix(in srgb, #000 10%, transparent);
  overflow: hidden;
  transition:
    height 180ms var(--app-ease),
    max-height 180ms var(--app-ease),
    bottom 180ms var(--app-ease);
}

.chord-kb__handle {
  align-self: center;
  width: 3rem;
  height: 1.1rem;
  border: 0;
  border-radius: var(--app-radius-pill);
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
  width: 2.35rem;
  height: 0.28rem;
  border-radius: 999px;
  background: var(--app-border-strong);
  transform: translate(-50%, -50%);
}

.chord-kb__top {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-shrink: 0;
  margin-bottom: var(--app-space-2);
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
  flex: 1;
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.chord-kb__panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding-bottom: 0.25rem;
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

.note-composer {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 45;
  display: flex;
  gap: var(--app-space-2);
  align-items: center;
  padding: var(--app-space-2)
    calc(var(--app-safe-right) + var(--app-space-3))
    calc(var(--app-space-2) + var(--app-safe-bottom))
    calc(var(--app-safe-left) + var(--app-space-3));
  border-top: var(--app-hairline) solid var(--app-border);
  background: var(--app-surface);
  box-shadow: 0 -8px 24px color-mix(in srgb, #000 10%, transparent);
}

.note-composer--kb {
  /* Safe-bottom уже «внутри» зоны клавиатуры */
  padding-bottom: var(--app-space-2);
}

.note-composer__input {
  flex: 1;
  min-width: 0;
  min-height: 2.5rem;
  padding: 0 0.75rem;
  border: var(--app-hairline) solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-bg);
  color: var(--app-ink);
  font: inherit;
  font-size: 16px;
}

.note-composer__add {
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

.note-composer__add:disabled {
  opacity: 0.4;
  cursor: default;
}

.note-composer-enter-active,
.note-composer-leave-active {
  transition:
    opacity 180ms var(--app-ease, ease),
    transform 200ms var(--app-ease, cubic-bezier(0.32, 0.72, 0, 1));
}

.note-composer-enter-from,
.note-composer-leave-to {
  opacity: 0;
  transform: translateY(10px);
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
