<script setup lang="ts">
import type { ChordChart, SongInput } from '~~/shared/types'
import {
  SONG_METERS,
  SONG_THEME_MAX,
  SONG_THEMES,
  SONG_TYPE_MAX,
  SONG_TYPES,
  isSongThemeId,
  isSongType,
  maskTimeSignatureInput,
  normalizeThemes,
  normalizeTimeSignature,
  normalizeTypes,
  songThemeMessageKey,
  songTypeMessageKey,
} from '~~/shared/songs/library'
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

const typeDraft = ref('')
const themeDraft = ref('')
const meterDraft = ref('')

const bpmSummary = computed(() => {
  const bpm = props.modelValue.bpm
  if (bpm == null) return null
  return `${bpm} ${t('song.bpmUnit')}`
})

const meterSummary = computed(() => normalizeTimeSignature(props.modelValue.timeSignature))

const selectedTypes = computed(() => props.modelValue.types ?? [])

const selectedThemes = computed(() => props.modelValue.themes ?? [])

const factsVisible = computed(() => Boolean(bpmSummary.value || meterSummary.value))

const libraryVisible = computed(
  () => selectedTypes.value.length > 0 || selectedThemes.value.length > 0,
)

const typeOptions = computed(() => {
  const extras = (props.modelValue.types ?? []).filter((type) => !isSongType(type))
  return [...SONG_TYPES, ...extras]
})

const themeOptions = computed(() => {
  const extras = (props.modelValue.themes ?? []).filter((theme) => !isSongThemeId(theme))
  return [...SONG_THEMES, ...extras]
})

const meterOptions = computed(() => {
  const current = normalizeTimeSignature(props.modelValue.timeSignature)
  if (current && !(SONG_METERS as readonly string[]).includes(current)) {
    return [...SONG_METERS, current]
  }
  return [...SONG_METERS]
})

function typeLabel(type: string) {
  const key = songTypeMessageKey(type)
  return key ? t(key) : type
}

function themeLabel(theme: string) {
  const key = songThemeMessageKey(theme)
  return key ? t(key) : theme
}

function toggleType(type: string) {
  const current = props.modelValue.types ?? []
  const next = current.includes(type)
    ? current.filter((item) => item !== type)
    : [...current, type]
  patch('types', normalizeTypes(next))
}

function toggleTheme(theme: string) {
  const current = props.modelValue.themes ?? []
  const next = current.includes(theme)
    ? current.filter((item) => item !== theme)
    : [...current, theme]
  patch('themes', normalizeThemes(next))
}

function resolveTypeDraft(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  for (const id of SONG_TYPES) {
    if (value.toLowerCase() === id) return id
    if (value.localeCompare(t(`songs.type.${id}`), undefined, { sensitivity: 'accent' }) === 0) {
      return id
    }
  }
  return value
}

function resolveThemeDraft(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  for (const id of SONG_THEMES) {
    if (value.toLowerCase() === id) return id
    if (value.localeCompare(t(`songs.theme.${id}`), undefined, { sensitivity: 'accent' }) === 0) {
      return id
    }
  }
  return value
}

function addCustomType() {
  const type = resolveTypeDraft(typeDraft.value)
  typeDraft.value = ''
  if (!type || type.length > SONG_TYPE_MAX) return
  const current = props.modelValue.types ?? []
  if (current.some((item) => item.localeCompare(type, undefined, { sensitivity: 'accent' }) === 0)) {
    closeSheet()
    return
  }
  patch('types', normalizeTypes([...current, type]))
  closeSheet()
}

function addCustomTheme() {
  const theme = resolveThemeDraft(themeDraft.value)
  themeDraft.value = ''
  if (!theme || theme.length > SONG_THEME_MAX) return
  const current = props.modelValue.themes ?? []
  if (current.includes(theme)) return
  patch('themes', normalizeThemes([...current, theme]))
  closeSheet()
}

function selectMeter(signature: string) {
  const current = props.modelValue.timeSignature ?? null
  patch('timeSignature', current === signature ? null : signature)
  closeSheet()
}

function onMeterDraftInput(event: Event) {
  const el = event.target as HTMLInputElement
  const next = maskTimeSignatureInput(el.value)
  meterDraft.value = next
  if (el.value !== next) el.value = next
}

function onMeterKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    addCustomMeter()
    return
  }
  if (event.key !== 'Backspace') return
  const el = event.target as HTMLInputElement
  const value = meterDraft.value
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  if (start !== end || start !== value.length) return
  const slash = value.indexOf('/')
  // Последняя цифра знаменателя: стираем её вместе со `/` → 12/8 → 12
  if (slash >= 0 && value.length === slash + 2) {
    event.preventDefault()
    meterDraft.value = value.slice(0, slash)
    void nextTick(() => {
      const len = meterDraft.value.length
      el.setSelectionRange(len, len)
    })
    return
  }
  // Застряли на хвостовом `/` — тоже сразу к числителю
  if (value.endsWith('/')) {
    event.preventDefault()
    meterDraft.value = value.slice(0, -1)
    void nextTick(() => {
      const len = meterDraft.value.length
      el.setSelectionRange(len, len)
    })
  }
}

function addCustomMeter() {
  const signature = normalizeTimeSignature(meterDraft.value)
  meterDraft.value = ''
  if (!signature) return
  patch('timeSignature', signature)
  closeSheet()
}

export type SongExtraKind = 'lyrics' | 'youtube' | 'bpm' | 'types' | 'themes' | 'meter'

const sheetKind = ref<SongExtraKind | null>(null)
const sheetDraft = ref('')
const lyricsInput = ref<HTMLTextAreaElement | null>(null)
const youtubeInput = ref<HTMLInputElement | null>(null)
const bpmInput = ref<HTMLInputElement | null>(null)
const typeInput = ref<HTMLInputElement | null>(null)
const themeInput = ref<HTMLInputElement | null>(null)
const meterInput = ref<HTMLInputElement | null>(null)
/** Держит soft KB в цепочке user-gesture до after-enter реального поля. */
const focusProxy = ref<HTMLInputElement | null>(null)
const pendingSheetFocus = ref(false)

const sheetOpen = computed(() => sheetKind.value != null)

const sheetChoices = computed(
  () => sheetKind.value === 'types' || sheetKind.value === 'themes' || sheetKind.value === 'meter',
)

const sheetTitle = computed(() => {
  if (sheetKind.value === 'youtube') return t('song.sheetYoutube')
  if (sheetKind.value === 'bpm') return t('song.sheetBpm')
  if (sheetKind.value === 'types') return t('song.fieldTypes')
  if (sheetKind.value === 'themes') return t('song.fieldThemes')
  if (sheetKind.value === 'meter') return t('song.fieldMeter')
  return t('song.sheetLyrics')
})

function sheetField(): HTMLInputElement | HTMLTextAreaElement | null {
  if (sheetKind.value === 'youtube') return youtubeInput.value
  if (sheetKind.value === 'bpm') return bpmInput.value
  if (sheetKind.value === 'types') return typeInput.value
  if (sheetKind.value === 'themes') return themeInput.value
  if (sheetKind.value === 'meter') return meterInput.value
  return lyricsInput.value
}

function focusSheetField() {
  sheetField()?.focus({ preventScroll: true })
}

function openExtra(kind: SongExtraKind) {
  // Сразу в жесте клика (до hide popover / Transition) — иначе iOS глотает autofocus.
  // Размер — сначала чипы; кастомный ввод без автофокуса.
  const focusField =
    kind === 'lyrics' || kind === 'youtube' || kind === 'bpm' || kind === 'types' || kind === 'themes'
  if (focusField) focusProxy.value?.focus({ preventScroll: true })
  pendingSheetFocus.value = focusField
  sheetKind.value = kind
  if (kind === 'lyrics') {
    sheetDraft.value = props.modelValue.lyrics ?? ''
  } else if (kind === 'youtube') {
    sheetDraft.value = props.modelValue.youtubeUrl ?? ''
  } else if (kind === 'bpm') {
    sheetDraft.value =
      props.modelValue.bpm != null ? String(props.modelValue.bpm) : ''
  } else {
    sheetDraft.value = ''
  }
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
  typeDraft.value = ''
  themeDraft.value = ''
  meterDraft.value = ''
  lyricsInput.value?.blur()
  youtubeInput.value?.blur()
  bpmInput.value?.blur()
  typeInput.value?.blur()
  themeInput.value?.blur()
  meterInput.value?.blur()
  focusProxy.value?.blur()
}

function parseBpmDraft(raw: string): number | null {
  const value = raw.trim()
  if (!value) return null
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return null
  return Math.max(30, Math.min(300, n))
}

function onBpmDraftInput(event: Event) {
  const el = event.target as HTMLInputElement
  const next = el.value.replace(/\D/g, '').slice(0, 3)
  sheetDraft.value = next
  if (el.value !== next) el.value = next
}

function confirmSheet() {
  if (!sheetKind.value) return
  const kind = sheetKind.value
  const value = sheetDraft.value.trim()
  if (kind === 'lyrics') {
    patch('lyrics', value || null)
  } else if (kind === 'youtube') {
    patch('youtubeUrl', value || null)
  } else if (kind === 'bpm') {
    patch('bpm', parseBpmDraft(value))
  } else if (kind === 'types' && typeDraft.value.trim()) {
    addCustomType()
    return
  } else if (kind === 'themes' && themeDraft.value.trim()) {
    addCustomTheme()
    return
  } else if (kind === 'meter' && normalizeTimeSignature(meterDraft.value)) {
    addCustomMeter()
    return
  }
  closeSheet()
}

/** iOS/Android «Done» на KB обычно даёт blur — сохраняем черновик. */
function onDraftFieldBlur() {
  if (sheetKind.value !== 'lyrics' && sheetKind.value !== 'youtube') return
  window.setTimeout(() => {
    if (sheetKind.value === 'lyrics' || sheetKind.value === 'youtube') {
      confirmSheet()
    }
  }, 0)
}

/**
 * KeepAlive оставляет Teleport в .app-shell после ухода со страницы —
 * снимаем shell-UI при deactivate. CTA только на маршрутах формы.
 */
const route = useRoute()
const shellUiActive = ref(true)

const formRouteActive = computed(() => {
  const path = route.path
  return path === '/songs/new' || /^\/songs\/[^/]+\/edit\/?$/.test(path)
})

const showFormCta = computed(
  () => shellUiActive.value && formRouteActive.value && !sheetOpen.value,
)

const bpmAddEnabled = computed(() => parseBpmDraft(sheetDraft.value) != null)

const meterAddEnabled = computed(() => Boolean(normalizeTimeSignature(meterDraft.value)))

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

    <div v-if="factsVisible" class="app-fact-row" role="group">
      <button
        v-if="bpmSummary"
        type="button"
        class="app-fact app-fact--bpm"
        @click="openExtra('bpm')"
      >
        {{ bpmSummary }}
      </button>
      <button
        v-if="meterSummary"
        type="button"
        class="app-fact app-fact--meter"
        @click="openExtra('meter')"
      >
        {{ meterSummary }}
      </button>
    </div>

    <div
      v-if="libraryVisible"
      class="song-form__library app-chip-row"
      role="group"
      :aria-label="t('songs.ariaExtras')"
    >
      <button
        v-for="type in selectedTypes"
        :key="type"
        type="button"
        class="song-form__library-chip song-form__library-chip--type"
        @click="openExtra('types')"
      >
        {{ typeLabel(type) }}
      </button>
      <button
        v-for="theme in selectedThemes"
        :key="theme"
        type="button"
        class="song-form__library-chip song-form__library-chip--theme"
        @click="openExtra('themes')"
      >
        {{ themeLabel(theme) }}
      </button>
    </div>

    <div class="song-form__field song-form__field--chart">
      <ChordChartEditor
        :model-value="form.chordChart ?? null"
        :legacy-chords="form.chords"
        :title="t('song.fieldChords')"
        :time-signature="form.timeSignature ?? null"
        @update:model-value="onChartUpdate"
      />
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

    <Teleport v-if="showFormCta" to=".app-shell">
      <div class="song-form-cta">
        <Button
          type="button"
          class="w-full"
          :label="submitLabel ?? t('common.save')"
          :disabled="!canSubmit || busy"
          :loading="busy"
          @click="canSubmit && !$props.busy && emit('submit')"
        >
          <template #icon>
            <AppIcon :name="icons.save" size="1.15rem" />
          </template>
        </Button>
      </div>
    </Teleport>

    <AppTopSheet
      :open="shellUiActive && formRouteActive && sheetOpen"
      :title="sheetTitle"
      :expanded="sheetChoices"
      @dismiss="confirmSheet"
      @after-enter="onSheetAfterEnter"
    >
      <!-- v-show: оба смонтированы — handoff фокуса после after-enter надёжнее -->
      <textarea
        v-show="sheetKind === 'lyrics'"
        ref="lyricsInput"
        v-model="sheetDraft"
        class="app-top-sheet__field app-top-sheet__field--area"
        rows="8"
        :placeholder="t('song.lyricsPlaceholder')"
        enterkeyhint="enter"
        @blur="onDraftFieldBlur"
        @keydown.meta.enter.prevent="confirmSheet"
        @keydown.ctrl.enter.prevent="confirmSheet"
      />
      <input
        v-show="sheetKind === 'youtube'"
        ref="youtubeInput"
        v-model="sheetDraft"
        class="app-top-sheet__field"
        type="url"
        inputmode="url"
        :placeholder="t('song.youtubePlaceholder')"
        enterkeyhint="done"
        autocomplete="off"
        @blur="onDraftFieldBlur"
        @keydown.enter.prevent="confirmSheet"
      >
      <form
        v-show="sheetKind === 'bpm'"
        class="app-top-sheet__form"
        action="."
        @submit.prevent="confirmSheet"
      >
        <input
          ref="bpmInput"
          :value="sheetDraft"
          class="app-top-sheet__field app-top-sheet__field--bpm"
          type="text"
          inputmode="decimal"
          enterkeyhint="done"
          :placeholder="t('song.bpmPlaceholder')"
          autocomplete="off"
          @input="onBpmDraftInput"
        >
        <button
          type="submit"
          class="app-top-sheet__add"
          :disabled="!bpmAddEnabled"
        >
          {{ t('common.add') }}
        </button>
      </form>
      <div v-show="sheetKind === 'types'" class="app-top-sheet__choices">
        <div class="song-form__chips song-form__chips--grid">
          <button
            v-for="type in typeOptions"
            :key="type"
            type="button"
            class="song-form__chip"
            :class="{ 'song-form__chip--on': form.types?.includes(type) }"
            :aria-pressed="form.types?.includes(type) ?? false"
            @click="toggleType(type)"
          >
            {{ typeLabel(type) }}
          </button>
        </div>
        <input
          ref="typeInput"
          v-model="typeDraft"
          class="app-top-sheet__field"
          type="text"
          :maxlength="SONG_TYPE_MAX"
          :placeholder="t('song.typePlaceholder')"
          enterkeyhint="done"
          autocomplete="off"
          @keydown.enter.prevent="addCustomType"
        >
      </div>
      <div v-show="sheetKind === 'themes'" class="app-top-sheet__choices">
        <div class="song-form__chips song-form__chips--grid">
          <button
            v-for="theme in themeOptions"
            :key="theme"
            type="button"
            class="song-form__chip"
            :class="{ 'song-form__chip--on': form.themes?.includes(theme) }"
            :aria-pressed="form.themes?.includes(theme) ?? false"
            @click="toggleTheme(theme)"
          >
            {{ themeLabel(theme) }}
          </button>
        </div>
        <input
          ref="themeInput"
          v-model="themeDraft"
          class="app-top-sheet__field"
          type="text"
          :maxlength="SONG_THEME_MAX"
          :placeholder="t('song.themePlaceholder')"
          enterkeyhint="done"
          autocomplete="off"
          @keydown.enter.prevent="addCustomTheme"
        >
      </div>
      <div v-show="sheetKind === 'meter'" class="app-top-sheet__choices">
        <div class="song-form__chips song-form__chips--grid">
          <button
            v-for="meter in meterOptions"
            :key="meter"
            type="button"
            class="song-form__chip"
            :class="{ 'song-form__chip--on': form.timeSignature === meter }"
            :aria-pressed="form.timeSignature === meter"
            @click="selectMeter(meter)"
          >
            {{ meter }}
          </button>
        </div>
        <input
          ref="meterInput"
          :value="meterDraft"
          class="app-top-sheet__field"
          type="text"
          inputmode="decimal"
          maxlength="5"
          :placeholder="t('song.meterPlaceholder')"
          enterkeyhint="done"
          autocomplete="off"
          @input="onMeterDraftInput"
          @keydown="onMeterKeydown"
        >
        <button
          type="button"
          class="app-top-sheet__add"
          :disabled="!meterAddEnabled"
          @pointerdown.prevent="addCustomMeter"
        >
          {{ t('common.add') }}
        </button>
      </div>
    </AppTopSheet>
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

.app-fact-row .app-fact {
  cursor: pointer;
}

.app-fact-row .app-fact:active {
  filter: brightness(0.96);
}

.song-form__library {
  margin-inline: calc(-1 * var(--app-space-4));
  padding-inline: var(--app-space-4);
}

.song-form__library-chip {
  flex-shrink: 0;
  max-width: 11.5rem;
  min-height: 2rem;
  padding: 0 0.75rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  font: inherit;
  font-size: var(--app-text-xs);
  font-weight: 650;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.song-form__library-chip--type {
  background: color-mix(in srgb, #8b5cf6 16%, transparent);
  color: #8b5cf6;
}

.song-form__library-chip--theme {
  background: color-mix(in srgb, #ec4899 16%, transparent);
  color: #ec4899;
}

:global(html.app-dark) .song-form__library-chip--type {
  background: color-mix(in srgb, #a78bfa 20%, transparent);
  color: #a78bfa;
}

:global(html.app-dark) .song-form__library-chip--theme {
  background: color-mix(in srgb, #f472b6 20%, transparent);
  color: #f472b6;
}

.song-form__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.song-form__chips--grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.75rem, 1fr));
  gap: 0.5rem;
  width: 100%;
}

.song-form__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0 0.65rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-pill);
  background: var(--app-surface);
  color: var(--app-ink);
  font: inherit;
  font-size: var(--app-text-xs);
  font-weight: 650;
  text-align: center;
  cursor: pointer;
  outline: 1.5px solid transparent;
  outline-offset: var(--app-hover-outline-gap);
  transition:
    background-color var(--app-duration) var(--app-ease),
    border-color var(--app-duration) var(--app-ease),
    outline-color var(--app-duration) var(--app-ease),
    color var(--app-duration) var(--app-ease);
}

.song-form__chips--grid .song-form__chip {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--app-radius-lg);
}

@media (hover: hover) and (pointer: fine) {
  .song-form__chip:hover:not(.song-form__chip--on) {
    background: var(--app-hover);
    outline-color: var(--app-hover-outline);
  }

  .song-form__chip--on:hover {
    outline-color: color-mix(in srgb, var(--app-accent) 45%, transparent);
  }

  :deep(.app-top-sheet__body) .song-form__chip:hover:not(.song-form__chip--on) {
    background: color-mix(in srgb, var(--app-ink) 8%, var(--app-bg));
  }
}

.song-form__chip--on {
  border-color: transparent;
  background: var(--app-accent);
  color: var(--app-accent-contrast);
}

:deep(.app-top-sheet__body) .song-form__chip {
  background: var(--app-bg);
}

:deep(.app-top-sheet__body) .song-form__chip--on {
  background: var(--app-accent);
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
  min-height: 2.875rem;
  gap: 0.4rem;
}
</style>
