<script setup lang="ts">
import type { ChordChart } from '~~/shared/types'
import {
  SECTION_ACCENT_VAR,
  SECTION_COLOR_VAR,
  readStageChordSize,
  sectionAutoTitle,
  writeStageChordSize,
  type StageChordSize,
} from '~/utils/music/chart'
import { icons } from '~/utils/icons'

export type StagePlaylistInfo = {
  index: number
  total: number
  canPrev: boolean
  canNext: boolean
}

const { t } = useAppLocale()

const props = defineProps<{
  chart: ChordChart
  fullscreen?: boolean
  /** Название текущей песни — в фуллскрине */
  title?: string
  /** BPM label справа от S/M/L */
  tempo?: string | null
  /** Meter справа от S/M/L */
  meter?: string | null
  /** Контекст сет-листа: позиция и возможность листания */
  playlist?: StagePlaylistInfo | null
}>()

const factsVisible = computed(() => Boolean(props.tempo || props.meter))

const emit = defineEmits<{
  'update:fullscreen': [value: boolean]
  prev: []
  next: []
}>()

const size = ref<StageChordSize>(readStageChordSize())
const fsRoot = ref<HTMLElement | null>(null)
/**
 * KeepAlive + Teleport: при уходе на другую песню оверлей остаётся в `.app-shell`
 * и перехватывает клики. Показываем FS только пока страница активна.
 */
const pageActive = ref(true)

const sizeOptions: { value: StageChordSize; label: string }[] = [
  { value: 'compact', label: 'S' },
  { value: 'standard', label: 'M' },
  { value: 'large', label: 'L' },
]

watch(size, (v) => writeStageChordSize(v))

const showFullscreen = computed(() => Boolean(props.fullscreen && pageActive.value))

function setFullscreen(value: boolean) {
  emit('update:fullscreen', value)
}

function sectionLabel(type: string) {
  return t(`chart.section.${type}`)
}

function autoSectionTitle(sectionId: string) {
  return sectionAutoTitle(props.chart.sections, sectionId, sectionLabel)
}

const showPlaylistNav = computed(
  () => Boolean(props.playlist && props.playlist.total > 1),
)

function goPrev() {
  if (!props.playlist?.canPrev) return
  emit('prev')
}

function goNext() {
  if (!props.playlist?.canNext) return
  emit('next')
}

/* —— только горизонтальное листание сет-листа в фуллскрине —— */
const SWIPE_MIN = 48
const WHEEL_STEP = 80

let touchX = 0
let touchY = 0
let touchActive = false
/** Захватили горизонтальный жест — не отдаём скроллу */
let touchLockedH = false
let wheelAcc = 0
let wheelResetTimer = 0

function isUiControlTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button, a, input, textarea, select'))
}

function onTouchStart(event: TouchEvent) {
  if (!showPlaylistNav.value || !showFullscreen.value) return
  // Тап по ←/→ и тулбару — не начинаем свайп (иначе preventDefault съедает click)
  if (isUiControlTarget(event.target)) {
    touchActive = false
    touchLockedH = false
    return
  }
  const t0 = event.touches[0]
  if (!t0) return
  touchActive = true
  touchLockedH = false
  touchX = t0.clientX
  touchY = t0.clientY
}

function onTouchMove(event: TouchEvent) {
  if (!touchActive || !showPlaylistNav.value) return
  const t0 = event.touches[0]
  if (!t0) return
  const dx = t0.clientX - touchX
  const dy = t0.clientY - touchY
  if (!touchLockedH) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
    // Горизонталь доминирует → листание песен
    if (Math.abs(dx) >= Math.abs(dy)) {
      touchLockedH = true
    } else {
      // Вертикаль — обычный скролл аккордов
      touchActive = false
      return
    }
  }
  event.preventDefault()
}

function onTouchEnd(event: TouchEvent) {
  if (!touchActive || !showPlaylistNav.value) return
  touchActive = false
  const wasLocked = touchLockedH
  touchLockedH = false
  const t0 = event.changedTouches[0]
  if (!t0) return
  const dx = t0.clientX - touchX
  const dy = t0.clientY - touchY
  if (Math.abs(dx) < SWIPE_MIN) return
  if (!wasLocked && Math.abs(dx) < Math.abs(dy)) return
  // ← следующий, → предыдущий
  if (dx < 0) goNext()
  else goPrev()
}

function onWheel(event: WheelEvent) {
  if (!showPlaylistNav.value || !showFullscreen.value) return

  // Только горизонталь / Shift+колёсико — без вертикальной перемотки песен
  const horizontal =
    Math.abs(event.deltaX) > Math.abs(event.deltaY) * 0.85 ||
    (event.shiftKey && Math.abs(event.deltaY) > 0)
  if (!horizontal) return

  const delta =
    event.shiftKey && Math.abs(event.deltaX) < 1 ? event.deltaY : event.deltaX
  wheelAcc += delta
  window.clearTimeout(wheelResetTimer)
  wheelResetTimer = window.setTimeout(() => {
    wheelAcc = 0
  }, 120)
  if (Math.abs(wheelAcc) < WHEEL_STEP) return
  event.preventDefault()
  // natural scroll: палец влево → deltaX > 0 → next
  if (wheelAcc > 0) goNext()
  else goPrev()
  wheelAcc = 0
}

watch(showFullscreen, (open) => {
  wheelAcc = 0
  touchActive = false
  touchLockedH = false
  if (!open || !import.meta.client) return
  nextTick(() => {
    fsRoot.value?.scrollTo({ top: 0 })
  })
})

onActivated(() => {
  pageActive.value = true
})

onDeactivated(() => {
  pageActive.value = false
  touchActive = false
  touchLockedH = false
  wheelAcc = 0
})

onBeforeUnmount(() => {
  window.clearTimeout(wheelResetTimer)
})
</script>

<template>
  <div class="chord-stage" :class="`chord-stage--${size}`">
    <div class="chord-stage__toolbar">
      <div class="chord-stage__sizes" role="group" :aria-label="t('stage.ariaSize')">
        <button
          v-for="opt in sizeOptions"
          :key="opt.value"
          type="button"
          class="chord-stage__size"
          :class="{ 'chord-stage__size--active': size === opt.value }"
          @click="size = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
      <div class="chord-stage__mid">
        <div v-if="factsVisible" class="app-fact-row" role="group">
          <span v-if="tempo" class="app-fact app-fact--bpm">{{ tempo }}</span>
          <span v-if="meter" class="app-fact app-fact--meter">{{ meter }}</span>
        </div>
      </div>
      <button
        type="button"
        class="chord-stage__fs app-ring-hover"
        :aria-label="t('stage.ariaFullscreen')"
        @click="setFullscreen(true)"
      >
        <AppIcon :name="icons.fullscreen" size="1.15rem" />
      </button>
    </div>

    <div class="chord-stage__body">
      <section
        v-for="section in chart.sections"
        :key="section.id"
        class="chord-stage__section"
        :style="{
          '--section-wash': SECTION_COLOR_VAR[section.type] ?? SECTION_COLOR_VAR.custom,
          '--section-accent': SECTION_ACCENT_VAR[section.type] ?? SECTION_ACCENT_VAR.custom,
          background: 'var(--section-wash)',
          borderLeftColor: 'var(--section-accent)',
        }"
      >
        <header class="chord-stage__section-head">
          {{ autoSectionTitle(section.id) }}
        </header>
        <div class="chord-stage__bars">
          <div v-for="bar in section.bars" :key="bar.id" class="chord-stage__bar">
            <template v-if="bar.items.length">
              <span
                v-for="item in bar.items"
                :key="item.id"
                class="chord-stage__chip"
                :class="
                  item.kind === 'annotation'
                    ? 'chord-stage__chip--annotation'
                    : 'chord-stage__chip--chord'
                "
              >
                <template v-if="item.kind === 'chord'">
                  {{ item.symbol }}
                  <small v-if="item.duration" class="chord-stage__beats">{{ item.duration.beats }}</small>
                </template>
                <template v-else>{{ item.text }}</template>
              </span>
            </template>
            <span v-else class="chord-stage__empty">·</span>
          </div>
        </div>
      </section>
    </div>
  </div>

  <Teleport to=".app-shell">
    <div
      v-if="showFullscreen"
      ref="fsRoot"
      class="chord-stage chord-stage--fullscreen"
      :class="`chord-stage--${size}`"
      role="dialog"
      data-no-edge-swipe
      :aria-label="t('stage.ariaFullscreenDialog')"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
      @wheel="onWheel"
    >
      <div class="chord-stage__toolbar">
        <div class="chord-stage__sizes" role="group" :aria-label="t('stage.ariaSize')">
          <button
            v-for="opt in sizeOptions"
            :key="`fs-${opt.value}`"
            type="button"
            class="chord-stage__size"
            :class="{ 'chord-stage__size--active': size === opt.value }"
            @click="size = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <div class="chord-stage__mid">
          <div v-if="factsVisible" class="app-fact-row" role="group">
            <span v-if="tempo" class="app-fact app-fact--bpm">{{ tempo }}</span>
            <span v-if="meter" class="app-fact app-fact--meter">{{ meter }}</span>
          </div>
        </div>
        <button
          type="button"
          class="chord-stage__fs app-ring-hover"
          :aria-label="t('stage.ariaExitFullscreen')"
          @click="setFullscreen(false)"
        >
          <AppIcon :name="icons.fullscreenExit" size="1.15rem" />
        </button>
      </div>

      <div
        v-if="title || showPlaylistNav"
        class="chord-stage__titlebar"
        :class="{ 'chord-stage__titlebar--solo': !showPlaylistNav }"
      >
        <button
          v-if="showPlaylistNav && playlist?.canPrev"
          type="button"
          class="chord-stage__nav app-ring-hover"
          :aria-label="t('stage.prevSong')"
          @click.stop="goPrev"
        >
          <AppIcon :name="icons.arrowLeft" size="1.15rem" />
        </button>
        <span v-else-if="showPlaylistNav" class="chord-stage__nav-spacer" aria-hidden="true" />

        <div class="chord-stage__title-block">
          <h2 v-if="title" class="chord-stage__song-title">{{ title }}</h2>
          <p v-if="playlist" class="chord-stage__song-pos">
            {{ t('stage.setlistPos', { index: playlist.index, total: playlist.total }) }}
          </p>
        </div>

        <button
          v-if="showPlaylistNav && playlist?.canNext"
          type="button"
          class="chord-stage__nav app-ring-hover"
          :aria-label="t('stage.nextSong')"
          @click.stop="goNext"
        >
          <AppIcon :name="icons.arrowRight" size="1.15rem" />
        </button>
        <span v-else-if="showPlaylistNav" class="chord-stage__nav-spacer" aria-hidden="true" />
      </div>

      <div class="chord-stage__body">
        <section
          v-for="section in chart.sections"
          :key="`fs-${section.id}`"
          class="chord-stage__section"
          :style="{
            '--section-wash': SECTION_COLOR_VAR[section.type] ?? SECTION_COLOR_VAR.custom,
            '--section-accent': SECTION_ACCENT_VAR[section.type] ?? SECTION_ACCENT_VAR.custom,
            background: 'var(--section-wash)',
            borderLeftColor: 'var(--section-accent)',
          }"
        >
          <header class="chord-stage__section-head">
            {{ autoSectionTitle(section.id) }}
          </header>
          <div class="chord-stage__bars">
            <div v-for="bar in section.bars" :key="`fs-${bar.id}`" class="chord-stage__bar">
              <template v-if="bar.items.length">
                <span
                  v-for="item in bar.items"
                  :key="`fs-${item.id}`"
                  class="chord-stage__chip"
                  :class="
                    item.kind === 'annotation'
                      ? 'chord-stage__chip--annotation'
                      : 'chord-stage__chip--chord'
                  "
                >
                  <template v-if="item.kind === 'chord'">
                    {{ item.symbol }}
                    <small v-if="item.duration" class="chord-stage__beats">{{ item.duration.beats }}</small>
                  </template>
                  <template v-else>{{ item.text }}</template>
                </span>
              </template>
              <span v-else class="chord-stage__empty">·</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.chord-stage {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.chord-stage--fullscreen {
  /* absolute внутри .app-shell — на ПК ширина колонки, не весь viewport */
  position: absolute;
  inset: 0;
  z-index: 80;
  width: 100%;
  max-width: 100%;
  padding-top: var(--app-safe-top);
  padding-right: var(--app-safe-right);
  padding-bottom: var(--app-safe-bottom);
  padding-left: var(--app-safe-left);
  background: var(--app-bg);
  overflow: auto;
  gap: var(--app-space-3);
  box-sizing: border-box;
  overscroll-behavior-y: contain;
  /* pan-y: вертикальный скролл аккордов; горизонталь — наш свайп песен */
  touch-action: pan-y;
}

.chord-stage__toolbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--app-space-2);
}

.chord-stage__mid {
  display: flex;
  justify-content: center;
  justify-self: center;
  min-width: 0;
}

.chord-stage--fullscreen .chord-stage__toolbar {
  /* Как .app-page — один gutter с остальным приложением */
  padding: var(--app-space-2) var(--app-page-inline) 0;
}

.chord-stage__titlebar {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem;
  align-items: center;
  gap: var(--app-space-1);
  padding: 0 var(--app-page-inline);
}

.chord-stage__titlebar--solo {
  grid-template-columns: minmax(0, 1fr);
  padding-inline: var(--app-page-inline);
}

.chord-stage__title-block {
  min-width: 0;
  text-align: center;
}

.chord-stage__song-title {
  margin: 0;
  font-size: var(--app-text-md);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chord-stage__song-pos {
  margin: 0.15rem 0 0;
  font-size: var(--app-text-2xs);
  font-weight: 650;
  color: var(--app-muted);
  font-variant-numeric: tabular-nums;
}

.chord-stage__nav,
.chord-stage__fs {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-accent-text);
  cursor: pointer;
  transition:
    background-color var(--app-duration) var(--app-ease),
    opacity var(--app-duration) var(--app-ease),
    outline-color var(--app-duration) var(--app-ease);
}

.chord-stage__nav-spacer {
  width: 2.5rem;
  height: 2.5rem;
}

.chord-stage__body {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.chord-stage--fullscreen .chord-stage__body {
  padding: 0 var(--app-page-inline) var(--app-space-4);
}

.chord-stage__sizes {
  display: inline-flex;
  justify-self: start;
  padding: 0.15rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
}

.chord-stage__size {
  min-width: 2.25rem;
  min-height: 2rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: transparent;
  color: var(--app-muted);
  font: inherit;
  font-size: var(--app-text-xs);
  font-weight: 750;
  cursor: pointer;
  transition:
    background-color 220ms var(--app-ease),
    color 220ms var(--app-ease),
    opacity 220ms var(--app-ease);
}

.chord-stage__size--active {
  background: var(--app-surface);
  color: var(--app-ink);
  box-shadow: var(--app-shadow-soft);
}

@media (hover: hover) and (pointer: fine) {
  .chord-stage__size:hover:not(.chord-stage__size--active) {
    color: color-mix(in srgb, var(--app-ink) 72%, var(--app-muted));
    background: color-mix(in srgb, var(--app-surface) 55%, transparent);
  }

  .chord-stage__size--active:hover {
    opacity: 0.92;
  }
}

.chord-stage__size:active:not(.chord-stage__size--active) {
  color: var(--app-ink);
  background: color-mix(in srgb, var(--app-surface) 75%, transparent);
}

.chord-stage__fs {
  justify-self: end;
  flex-shrink: 0;
}

.chord-stage__section {
  border-radius: var(--app-radius);
  border-left: 3px solid var(--section-accent, var(--app-accent));
  padding: var(--app-space-2) var(--app-space-3);
}

.chord-stage__section-head {
  margin-bottom: var(--app-space-2);
  font-size: var(--app-text-xs);
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.chord-stage__bars {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.chord-stage__bar {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.5rem;
  border-radius: var(--app-radius-sm);
  border: var(--app-hairline) solid var(--app-border);
  background: color-mix(in srgb, var(--app-surface) 70%, transparent);
  min-height: 2rem;
}

.chord-stage__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0.45rem;
  border-radius: var(--app-radius-sm);
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.chord-stage__chip--chord {
  color: var(--app-ink);
  background: var(--app-surface);
}

.chord-stage__chip--annotation {
  color: var(--chart-annotation-ink);
  background: var(--chart-annotation-bg);
  font-size: 0.85em;
  font-weight: 700;
}

.chord-stage__empty {
  color: var(--app-faint);
  font-weight: 600;
}

.chord-stage__beats {
  margin-left: 0.15em;
  font-size: 0.65em;
  font-weight: 700;
  opacity: 0.6;
  vertical-align: super;
}

.chord-stage--compact .chord-stage__chip {
  font-size: var(--app-text-sm);
}

.chord-stage--standard .chord-stage__chip {
  font-size: var(--app-text-lg);
}

.chord-stage--large .chord-stage__chip {
  font-size: var(--app-text-2xl);
  padding: 0.25rem 0.55rem;
}

.chord-stage--large .chord-stage__bar {
  min-height: 2.75rem;
  padding: 0.45rem 0.65rem;
}
</style>
