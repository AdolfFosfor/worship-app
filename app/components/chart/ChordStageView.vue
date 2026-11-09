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

const { t } = useAppLocale()

const props = defineProps<{
  chart: ChordChart
  fullscreen?: boolean
}>()

const emit = defineEmits<{
  'update:fullscreen': [value: boolean]
}>()

const size = ref<StageChordSize>(readStageChordSize())

const sizeOptions: { value: StageChordSize; label: string }[] = [
  { value: 'compact', label: 'S' },
  { value: 'standard', label: 'M' },
  { value: 'large', label: 'L' },
]

watch(size, (v) => writeStageChordSize(v))

function setFullscreen(value: boolean) {
  emit('update:fullscreen', value)
}

function sectionLabel(type: string) {
  return t(`chart.section.${type}`)
}

function autoSectionTitle(sectionId: string) {
  return sectionAutoTitle(props.chart.sections, sectionId, sectionLabel)
}
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
      <button
        type="button"
        class="chord-stage__fs"
        :aria-label="t('stage.ariaFullscreen')"
        @click="setFullscreen(true)"
      >
        <AppIcon :name="icons.share" size="1.1rem" />
        <span>{{ t('stage.fullscreen') }}</span>
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
      v-if="fullscreen"
      class="chord-stage chord-stage--fullscreen"
      :class="`chord-stage--${size}`"
      role="dialog"
      :aria-label="t('stage.ariaFullscreenDialog')"
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
        <button
          type="button"
          class="chord-stage__fs"
          :aria-label="t('stage.ariaExitFullscreen')"
          @click="setFullscreen(false)"
        >
          <AppIcon :name="icons.close" size="1.1rem" />
          <span>{{ t('common.close') }}</span>
        </button>
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
  position: fixed;
  inset: 0;
  z-index: 80;
  padding-top: var(--app-safe-top);
  padding-right: var(--app-safe-right);
  padding-bottom: var(--app-safe-bottom);
  padding-left: var(--app-safe-left);
  background: var(--app-bg);
  overflow: auto;
  gap: var(--app-space-4);
}

.chord-stage__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.chord-stage--fullscreen .chord-stage__toolbar {
  padding: var(--app-space-2) var(--app-space-4) 0;
}

.chord-stage__body {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.chord-stage--fullscreen .chord-stage__body {
  padding: 0 var(--app-space-4) var(--app-space-4);
}

.chord-stage__sizes {
  display: inline-flex;
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
}

.chord-stage__size--active {
  background: var(--app-surface);
  color: var(--app-ink);
  box-shadow: var(--app-shadow-soft);
}

.chord-stage__fs {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-2);
  min-height: 2.25rem;
  padding: 0 0.75rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-accent-text);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 650;
  cursor: pointer;
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
