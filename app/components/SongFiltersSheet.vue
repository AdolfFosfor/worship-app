<script setup lang="ts">
import { COMMON_KEYS } from '~~/shared/types'
import {
  SONG_ACTIVITIES,
  SONG_METERS,
  SONG_TEMPOS,
  SONG_THEMES,
  SONG_TYPES,
  emptySongLibraryFilters,
  isSongThemeId,
  libraryFiltersActive,
  normalizeTimeSignature,
  songThemeMessageKey,
  type SongActivity,
  type SongLibraryFilters,
  type SongTempo,
  type SongType,
} from '~~/shared/songs/library'

const open = defineModel<boolean>('open', { default: false })
const filters = defineModel<SongLibraryFilters>('filters', { required: true })

const props = defineProps<{
  extraThemes: string[]
  extraMeters: string[]
}>()

const { t } = useAppLocale()

const hasFilters = computed(() => libraryFiltersActive(filters.value))

const themeChoices = computed(() => {
  const extras = new Set<string>()
  for (const theme of [...props.extraThemes, ...filters.value.themes]) {
    if (!isSongThemeId(theme)) extras.add(theme)
  }
  return [...SONG_THEMES, ...[...extras].sort((a, b) => a.localeCompare(b))]
})

const meterChoices = computed(() => {
  const extras = new Set<string>()
  for (const meter of [...props.extraMeters, ...filters.value.timeSignatures]) {
    const normalized = normalizeTimeSignature(meter)
    if (normalized && !(SONG_METERS as readonly string[]).includes(normalized)) extras.add(normalized)
  }
  return [...SONG_METERS, ...[...extras].sort((a, b) => a.localeCompare(b))]
})

function patch(partial: Partial<SongLibraryFilters>) {
  filters.value = { ...filters.value, ...partial }
}

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function toggleType(type: SongType) {
  patch({ types: toggleValue(filters.value.types, type) })
}

function toggleTheme(theme: string) {
  patch({ themes: toggleValue(filters.value.themes, theme) })
}

function toggleTempo(tempo: SongTempo) {
  patch({ tempos: toggleValue(filters.value.tempos, tempo) })
}

function toggleKey(key: string) {
  patch({ keys: toggleValue(filters.value.keys, key) })
}

function toggleMeter(meter: string) {
  patch({ timeSignatures: toggleValue(filters.value.timeSignatures, meter) })
}

function toggleActivity(activity: SongActivity) {
  patch({ activity: toggleValue(filters.value.activity, activity) })
}

function themeLabel(theme: string) {
  const key = songThemeMessageKey(theme)
  return key ? t(key) : theme
}

function reset() {
  filters.value = emptySongLibraryFilters()
}

function close() {
  open.value = false
}
</script>

<template>
  <Teleport to=".app-shell">
    <Transition name="song-filters-sheet">
      <div
        v-if="open"
        class="song-filters-mask"
        @click.self="close"
      >
        <div
          id="song-filters-sheet"
          class="song-filters-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="t('songs.filtersTitle')"
          @click.stop
        >
          <header class="song-filters-sheet__head">
            <h2 class="song-filters-sheet__title">{{ t('songs.filtersTitle') }}</h2>
            <button
              v-if="hasFilters"
              type="button"
              class="song-filters-sheet__reset"
              @click="reset"
            >
              {{ t('songs.reset') }}
            </button>
          </header>

          <div class="song-filters-sheet__body">
            <section class="song-filters-sheet__section">
              <h3>{{ t('songs.filter.types') }}</h3>
              <div class="song-filters-sheet__chips">
                <button
                  v-for="type in SONG_TYPES"
                  :key="type"
                  type="button"
                  class="song-filters-sheet__chip song-filters-sheet__chip--types"
                  :class="{ 'song-filters-sheet__chip--on': filters.types.includes(type) }"
                  :aria-pressed="filters.types.includes(type)"
                  @click="toggleType(type)"
                >
                  {{ t(`songs.type.${type}`) }}
                </button>
              </div>
            </section>

            <section class="song-filters-sheet__section">
              <h3>{{ t('songs.filter.themes') }}</h3>
              <div class="song-filters-sheet__chips">
                <button
                  v-for="theme in themeChoices"
                  :key="theme"
                  type="button"
                  class="song-filters-sheet__chip song-filters-sheet__chip--themes"
                  :class="{ 'song-filters-sheet__chip--on': filters.themes.includes(theme) }"
                  :aria-pressed="filters.themes.includes(theme)"
                  @click="toggleTheme(theme)"
                >
                  {{ themeLabel(theme) }}
                </button>
              </div>
            </section>

            <section class="song-filters-sheet__section">
              <h3>{{ t('songs.filter.tempo') }}</h3>
              <div class="song-filters-sheet__chips">
                <button
                  v-for="tempo in SONG_TEMPOS"
                  :key="tempo"
                  type="button"
                  class="song-filters-sheet__chip song-filters-sheet__chip--tempo"
                  :class="{ 'song-filters-sheet__chip--on': filters.tempos.includes(tempo) }"
                  :aria-pressed="filters.tempos.includes(tempo)"
                  @click="toggleTempo(tempo)"
                >
                  {{ t(`songs.tempo.${tempo}`) }}
                </button>
              </div>
            </section>

            <section class="song-filters-sheet__section">
              <h3>{{ t('songs.filter.key') }}</h3>
              <div class="song-filters-sheet__chips">
                <button
                  v-for="key in COMMON_KEYS"
                  :key="key"
                  type="button"
                  class="song-filters-sheet__chip"
                  :class="{ 'song-filters-sheet__chip--on': filters.keys.includes(key) }"
                  :aria-pressed="filters.keys.includes(key)"
                  @click="toggleKey(key)"
                >
                  {{ key }}
                </button>
              </div>
            </section>

            <section class="song-filters-sheet__section">
              <h3>{{ t('songs.filter.meter') }}</h3>
              <div class="song-filters-sheet__chips">
                <button
                  v-for="meter in meterChoices"
                  :key="meter"
                  type="button"
                  class="song-filters-sheet__chip song-filters-sheet__chip--meter"
                  :class="{ 'song-filters-sheet__chip--on': filters.timeSignatures.includes(meter) }"
                  :aria-pressed="filters.timeSignatures.includes(meter)"
                  @click="toggleMeter(meter)"
                >
                  {{ meter }}
                </button>
              </div>
            </section>

            <section class="song-filters-sheet__section">
              <h3>{{ t('songs.filter.activity') }}</h3>
              <div class="song-filters-sheet__chips">
                <button
                  v-for="activity in SONG_ACTIVITIES"
                  :key="activity"
                  type="button"
                  class="song-filters-sheet__chip"
                  :class="{ 'song-filters-sheet__chip--on': filters.activity.includes(activity) }"
                  :aria-pressed="filters.activity.includes(activity)"
                  @click="toggleActivity(activity)"
                >
                  {{ t(`songs.activity.${activity}`) }}
                </button>
              </div>
            </section>
          </div>

          <footer class="song-filters-sheet__foot">
            <button type="button" class="song-filters-sheet__done" @click="close">
              {{ t('common.done') }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.song-filters-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  padding-left: var(--app-safe-left);
  padding-right: var(--app-safe-right);
  background: color-mix(in srgb, #000 48%, transparent);
  cursor: pointer;
}

.song-filters-sheet {
  display: flex;
  flex-direction: column;
  width: min(32rem, 100%);
  max-height: calc(
    var(--app-frame-height, 100lvh) - var(--app-safe-top) - var(--app-overlay-gap)
  );
  border-radius: 1.25rem 1.25rem 0 0;
  background: var(--app-surface);
  color: var(--app-ink);
  box-shadow: 0 -16px 40px color-mix(in srgb, #000 32%, transparent);
  cursor: default;
}

.song-filters-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  flex-shrink: 0;
  padding: var(--app-space-5) var(--app-space-4) var(--app-space-3);
}

.song-filters-sheet__title {
  margin: 0;
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.song-filters-sheet__reset {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--app-accent-text);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 700;
  cursor: pointer;
}

.song-filters-sheet__body {
  overflow: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
  padding: 0 var(--app-space-4) var(--app-space-3);
  -webkit-overflow-scrolling: touch;
}

.song-filters-sheet__section h3 {
  margin: 0 0 0.45rem;
  font-size: var(--app-text-xs);
  font-weight: 650;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.song-filters-sheet__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.song-filters-sheet__chip {
  min-height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-pill);
  background: var(--app-bg);
  color: var(--app-ink);
  font: inherit;
  font-size: var(--app-text-xs);
  font-weight: 650;
  cursor: pointer;
}

.song-filters-sheet__chip--types {
  --chip-tone: #8b5cf6;
}

.song-filters-sheet__chip--themes {
  --chip-tone: #ec4899;
}

.song-filters-sheet__chip--tempo {
  --chip-tone: var(--app-warn);
}

.song-filters-sheet__chip--meter {
  --chip-tone: #06b6d4;
}

:global(html.app-dark) .song-filters-sheet__chip--types {
  --chip-tone: #a78bfa;
}

:global(html.app-dark) .song-filters-sheet__chip--themes {
  --chip-tone: #f472b6;
}

:global(html.app-dark) .song-filters-sheet__chip--meter {
  --chip-tone: #22d3ee;
}

.song-filters-sheet__chip--on {
  border-color: transparent;
  background: var(--app-accent);
  color: var(--app-accent-contrast);
}

.song-filters-sheet__chip--types.song-filters-sheet__chip--on,
.song-filters-sheet__chip--themes.song-filters-sheet__chip--on,
.song-filters-sheet__chip--tempo.song-filters-sheet__chip--on,
.song-filters-sheet__chip--meter.song-filters-sheet__chip--on {
  background: color-mix(in srgb, var(--chip-tone) 16%, transparent);
  color: var(--chip-tone);
}

:global(html.app-dark) .song-filters-sheet__chip--types.song-filters-sheet__chip--on,
:global(html.app-dark) .song-filters-sheet__chip--themes.song-filters-sheet__chip--on,
:global(html.app-dark) .song-filters-sheet__chip--tempo.song-filters-sheet__chip--on,
:global(html.app-dark) .song-filters-sheet__chip--meter.song-filters-sheet__chip--on {
  background: color-mix(in srgb, var(--chip-tone) 20%, transparent);
}

.song-filters-sheet__foot {
  flex-shrink: 0;
  padding: var(--app-space-2) var(--app-space-4) calc(var(--app-space-4) + var(--app-safe-bottom));
}

.song-filters-sheet__done {
  width: 100%;
  min-height: 2.75rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.song-filters-sheet-enter-active,
.song-filters-sheet-leave-active {
  transition: opacity 160ms var(--app-ease, ease);
}

.song-filters-sheet-enter-active .song-filters-sheet,
.song-filters-sheet-leave-active .song-filters-sheet {
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.song-filters-sheet-enter-from,
.song-filters-sheet-leave-to {
  opacity: 0;
}

.song-filters-sheet-enter-from .song-filters-sheet,
.song-filters-sheet-leave-to .song-filters-sheet {
  transform: translateY(12%);
}
</style>
