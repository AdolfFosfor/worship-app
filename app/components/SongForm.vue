<script setup lang="ts">
import type { ChordChart, SongInput } from '~~/shared/types'
import { KEY_OPTIONS } from '~/utils/music/keys'
import { icons } from '~/utils/icons'

const { t } = useAppLocale()

const props = defineProps<{
  modelValue: SongInput
  submitLabel?: string
  busy?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: SongInput]
  submit: []
}>()

const form = computed({
  get: () => props.modelValue,
  set: (value: SongInput) => emit('update:modelValue', value),
})

function patch<K extends keyof SongInput>(key: K, value: SongInput[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function onChartUpdate(chart: ChordChart) {
  patch('chordChart', chart)
}

const canSubmit = computed(
  () => props.modelValue.title.trim().length > 0 && Boolean(props.modelValue.key),
)

const hasLyrics = computed(() => Boolean(props.modelValue.lyrics?.trim()))
const hasYoutube = computed(() => Boolean(props.modelValue.youtubeUrl?.trim()))

export type SongExtraKind = 'lyrics' | 'youtube'

const sheetKind = ref<SongExtraKind | null>(null)
const sheetDraft = ref('')
const lyricsInput = ref<HTMLTextAreaElement | null>(null)
const youtubeInput = ref<HTMLInputElement | null>(null)
/** Держит soft KB в цепочке user-gesture до after-enter реального поля. */
const focusProxy = ref<HTMLInputElement | null>(null)
const pendingSheetFocus = ref(false)

const sheetOpen = computed(() => sheetKind.value != null)

const sheetTitle = computed(() =>
  sheetKind.value === 'youtube' ? t('song.sheetYoutube') : t('song.sheetLyrics'),
)

function sheetField(): HTMLInputElement | HTMLTextAreaElement | null {
  return sheetKind.value === 'youtube' ? youtubeInput.value : lyricsInput.value
}

function focusSheetField() {
  sheetField()?.focus({ preventScroll: true })
}

function openExtra(kind: SongExtraKind) {
  // Сразу в жесте клика (до hide popover / Transition) — иначе iOS глотает autofocus.
  focusProxy.value?.focus({ preventScroll: true })
  pendingSheetFocus.value = true
  sheetKind.value = kind
  sheetDraft.value =
    kind === 'lyrics'
      ? (props.modelValue.lyrics ?? '')
      : (props.modelValue.youtubeUrl ?? '')
}

function onSheetAfterEnter() {
  if (!pendingSheetFocus.value) return
  pendingSheetFocus.value = false
  void nextTick(() => {
    focusSheetField()
    // Повтор после раскладки / iOS settle
    window.setTimeout(() => focusSheetField(), 40)
  })
}

function closeSheet() {
  pendingSheetFocus.value = false
  sheetKind.value = null
  sheetDraft.value = ''
  lyricsInput.value?.blur()
  youtubeInput.value?.blur()
  focusProxy.value?.blur()
}

function confirmSheet() {
  const value = sheetDraft.value.trim()
  if (sheetKind.value === 'lyrics') {
    patch('lyrics', value || null)
  } else if (sheetKind.value === 'youtube') {
    patch('youtubeUrl', value || null)
  }
  closeSheet()
}

/**
 * KeepAlive оставляет Teleport в .app-shell после ухода со страницы —
 * снимаем shell-UI при deactivate.
 */
const shellUiActive = ref(true)
onActivated(() => {
  shellUiActive.value = true
})
onDeactivated(() => {
  shellUiActive.value = false
  closeSheet()
})
onBeforeUnmount(() => {
  shellUiActive.value = false
  closeSheet()
})

defineExpose({
  openExtra,
  hasLyrics,
  hasYoutube,
})
</script>

<template>
  <form class="song-form" @submit.prevent="canSubmit && !$props.busy && emit('submit')">
    <label class="song-form__field">
      <span>{{ t('song.fieldTitle') }}</span>
      <InputText
        :model-value="form.title"
        class="w-full"
        :placeholder="t('song.titlePlaceholder')"
        @update:model-value="patch('title', String($event ?? ''))"
      />
    </label>

    <div class="song-form__meta">
      <label class="song-form__field song-form__field--key">
        <span>{{ t('song.fieldKey') }}</span>
        <Select
          :model-value="form.key"
          :options="KEY_OPTIONS"
          option-label="label"
          option-value="value"
          class="w-full"
          @update:model-value="patch('key', String($event))"
        />
      </label>
      <div class="song-form__field song-form__field--capo">
        <span>{{ t('song.fieldCapo') }}</span>
        <CapoStepper
          :model-value="form.capo ?? 0"
          @update:model-value="patch('capo', $event)"
        />
      </div>
    </div>
    <p class="song-form__hint">{{ t('song.capoHint') }}</p>

    <div class="song-form__field song-form__field--chart">
      <span>{{ t('song.fieldChords') }}</span>
      <ChordChartEditor
        :model-value="form.chordChart ?? null"
        :legacy-chords="form.chords"
        @update:model-value="onChartUpdate"
      />
    </div>

    <div v-if="hasLyrics || hasYoutube" class="song-form__extras-status">
      <span v-if="hasLyrics" class="song-form__chip">{{ t('song.extraLyrics') }}</span>
      <span v-if="hasYoutube" class="song-form__chip song-form__chip--yt">{{ t('song.extraYoutube') }}</span>
    </div>

    <input
      ref="focusProxy"
      class="song-form__focus-proxy"
      type="text"
      tabindex="-1"
      aria-hidden="true"
      inputmode="text"
      autocomplete="off"
    >

    <Teleport to=".app-shell">
      <div v-if="shellUiActive && !sheetOpen" class="song-form-cta">
        <Button
          type="button"
          class="w-full"
          :label="submitLabel ?? t('common.save')"
          :disabled="!canSubmit || busy"
          :loading="busy"
          @click="canSubmit && !$props.busy && emit('submit')"
        />
      </div>

      <Transition name="song-top-sheet" @after-enter="onSheetAfterEnter">
        <div
          v-if="shellUiActive && sheetOpen"
          class="song-top-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="sheetTitle"
        >
          <button
            type="button"
            class="song-top-sheet__mask"
            :aria-label="t('common.close')"
            @click="closeSheet"
          />
          <div class="song-top-sheet__panel">
            <header class="song-top-sheet__head">
              <button
                type="button"
                class="song-top-sheet__icon-btn"
                :aria-label="t('common.close')"
                @click="closeSheet"
              >
                <AppIcon :name="icons.close" size="1.1rem" />
              </button>
              <h2 class="song-top-sheet__title">{{ sheetTitle }}</h2>
              <button type="button" class="song-top-sheet__done" @click="confirmSheet">
                {{ t('common.done') }}
              </button>
            </header>

            <div class="song-top-sheet__body">
              <!-- v-show: оба смонтированы — handoff фокуса после after-enter надёжнее -->
              <textarea
                v-show="sheetKind === 'lyrics'"
                ref="lyricsInput"
                v-model="sheetDraft"
                class="song-top-sheet__field song-top-sheet__field--area"
                rows="8"
                :placeholder="t('song.lyricsPlaceholder')"
                enterkeyhint="done"
              />
              <input
                v-show="sheetKind === 'youtube'"
                ref="youtubeInput"
                v-model="sheetDraft"
                class="song-top-sheet__field"
                type="url"
                inputmode="url"
                :placeholder="t('song.youtubePlaceholder')"
                enterkeyhint="done"
                autocomplete="off"
                @keydown.enter.prevent="confirmSheet"
              >
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </form>
</template>

<style scoped>
.song-form__focus-proxy {
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

.song-form {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  /* Место под fixed CTA над таббаром — без лишнего spacer-div */
  padding-bottom: calc(3.25rem + var(--app-space-5));
}

.song-form__meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--app-space-2);
}

.song-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: var(--app-text-xs);
  font-weight: 650;
  color: var(--app-section-header);
}

.song-form__field--chart {
  gap: var(--app-space-2);
}

.song-form__hint {
  margin: -0.15rem 0 0;
  font-size: var(--app-text-2xs);
  font-weight: 500;
  color: var(--app-muted);
}

.song-form__extras-status {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.song-form__chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0 0.55rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-muted);
  font-size: var(--app-text-2xs);
  font-weight: 700;
}

.song-form__chip--yt {
  color: var(--app-warn);
  background: color-mix(in srgb, var(--app-warn) 14%, transparent);
}

/* Всегда над таббаром */
.song-form-cta {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(
    var(--app-tabbar-clearance, 3.75rem) + var(--app-keyboard-inset, 0px)
  );
  z-index: 6;
  padding: var(--app-space-2)
    calc(var(--app-safe-right) + var(--app-space-4))
    var(--app-space-3)
    calc(var(--app-safe-left) + var(--app-space-4));
  background: linear-gradient(
    to top,
    var(--app-bg) 70%,
    color-mix(in srgb, var(--app-bg) 0%, transparent)
  );
  pointer-events: none;
}

.song-form-cta :deep(.p-button) {
  pointer-events: auto;
  max-width: var(--app-page-max);
  margin-inline: auto;
  display: flex;
}

.song-top-sheet {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.song-top-sheet__mask {
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

.song-top-sheet__panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  width: 100%;
  /*
    Не vh/dvh — при OS KB viewport сжимается и панель «схлопывается».
    --app-frame-height залочен на stableHeight.
  */
  max-height: min(26rem, calc(var(--app-frame-height, 100lvh) * 0.52));
  /* Top: TG при KB часто ставит --tg-*-safe-*: 0 — env(safe-area) как пол; ПК → overlay-gap */
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

.song-top-sheet__head {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-shrink: 0;
  min-height: 2.75rem;
  padding: var(--app-space-2) var(--app-space-3);
}

.song-top-sheet__title {
  flex: 1;
  margin: 0;
  min-width: 0;
  font-size: var(--app-text-md);
  font-weight: 750;
  letter-spacing: -0.02em;
  color: var(--app-ink);
  text-align: center;
}

.song-top-sheet__icon-btn {
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

.song-top-sheet__done {
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

.song-top-sheet__body {
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 0 var(--app-space-3);
}

.song-top-sheet__field {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.65rem 0.75rem;
  border: var(--app-hairline) solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg);
  color: var(--app-ink);
  font: inherit;
  font-size: 16px;
  line-height: 1.35;
}

.song-top-sheet__field--area {
  flex: 1 1 auto;
  min-height: 10rem;
  height: 12rem;
  resize: none;
  -webkit-overflow-scrolling: touch;
}

.song-top-sheet-enter-active,
.song-top-sheet-leave-active {
  transition: opacity 160ms var(--app-ease, ease);
}

.song-top-sheet-enter-active .song-top-sheet__panel,
.song-top-sheet-leave-active .song-top-sheet__panel {
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.song-top-sheet-enter-from,
.song-top-sheet-leave-to {
  opacity: 0;
}

.song-top-sheet-enter-from .song-top-sheet__panel,
.song-top-sheet-leave-to .song-top-sheet__panel {
  transform: translateY(-12%);
}
</style>
