<script setup lang="ts">
import type { ChordChart, SectionType, SongLyricsDoc } from '~~/shared/types'
import { SECTION_TYPES } from '~~/shared/types'
import { SECTION_ACCENT_VAR, SECTION_COLOR_VAR } from '~/utils/music/chart/types'
import {
  addLyricBlock,
  addLyricLine,
  duplicateLyricBlock,
  lyricsBlockDisplayTitle,
  moveLyricBlock,
  removeLyricBlock,
  removeLyricLine,
  setLyricBlockType,
  setLyricLineText,
} from '~/utils/music/lyrics'
import { icons } from '~/utils/icons'

const { t } = useAppLocale()
const { requireDanger } = useAppConfirm()
const haptics = useHaptics()

const props = defineProps<{
  modelValue: SongLyricsDoc
  chart?: ChordChart | null
  title?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [doc: SongLyricsDoc]
  'edit-plain': []
}>()

const pickableTypes = SECTION_TYPES.filter((type) => type !== 'custom') as SectionType[]

const typeOptions = computed(() =>
  pickableTypes.map((value) => ({
    value,
    label: t(`chart.section.${value}`),
  })),
)

const blockSwipeActions = computed(() => [
  {
    id: 'duplicate',
    label: t('common.duplicate'),
    icon: icons.copy,
    tone: 'accent' as const,
  },
  {
    id: 'delete',
    label: t('common.delete'),
    icon: icons.trash,
    tone: 'danger' as const,
  },
])

const typeMenu = ref<{ blockId: string; top: number; left: number } | null>(null)
const drag = ref<{ blockId: string } | null>(null)
const dragArmed = ref<{ blockId: string; x: number; y: number } | null>(null)
const dropIndex = ref<number | null>(null)
const suppressBadgeClick = ref(false)
let longPressTimer: ReturnType<typeof setTimeout> | null = null

function commit(doc: SongLyricsDoc) {
  emit('update:modelValue', doc)
}

function blockTitle(blockId: string) {
  return lyricsBlockDisplayTitle(props.modelValue.blocks, blockId)
}

function sectionLabel(type: string) {
  return t(`chart.section.${type}`)
}

function onAddBlock(type: SectionType) {
  commit(addLyricBlock(props.modelValue, type, props.chart))
  haptics.impact('light')
}

function onDuplicate(blockId: string) {
  commit(duplicateLyricBlock(props.modelValue, blockId))
  haptics.impact('medium')
}

function onRemove(blockId: string) {
  commit(removeLyricBlock(props.modelValue, blockId))
}

function confirmRemove(blockId: string) {
  const title = blockTitle(blockId)
  requireDanger({
    title: t('lyrics.deleteBlockConfirmTitle'),
    message: t('lyrics.deleteBlockConfirmMessage', { title }),
    acceptLabel: t('common.delete'),
    accept: () => onRemove(blockId),
  })
}

function onSwipeAction(blockId: string, actionId: string) {
  if (actionId === 'duplicate') onDuplicate(blockId)
  else if (actionId === 'delete') confirmRemove(blockId)
}

function closeTypeMenu() {
  typeMenu.value = null
}

function onBadgeClick(event: MouseEvent, blockId: string) {
  if (suppressBadgeClick.value) {
    suppressBadgeClick.value = false
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  typeMenu.value = {
    blockId,
    top: rect.bottom + 6,
    left: Math.min(rect.left, window.innerWidth - 180),
  }
}

function pickType(type: SectionType) {
  if (!typeMenu.value) return
  commit(setLyricBlockType(props.modelValue, typeMenu.value.blockId, type, props.chart))
  closeTypeMenu()
}

function onLineInput(blockId: string, lineId: string, event: Event) {
  const el = event.target as HTMLTextAreaElement
  commit(setLyricLineText(props.modelValue, blockId, lineId, el.value))
  autosize(el)
}

function onLineKeydown(blockId: string, lineId: string, event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    commit(addLyricLine(props.modelValue, blockId, lineId))
    nextTick(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        `[data-lyric-line-input][data-block-id="${blockId}"]:focus`,
      )
      // focus next line after current
      const inputs = [
        ...document.querySelectorAll<HTMLTextAreaElement>(
          `[data-lyric-line-input][data-block-id="${blockId}"]`,
        ),
      ]
      const idx = inputs.findIndex((n) => n.dataset.lineId === lineId)
      inputs[idx + 1]?.focus()
      void el
    })
    return
  }
  if (event.key === 'Backspace') {
    const el = event.target as HTMLTextAreaElement
    if (el.value === '') {
      event.preventDefault()
      const block = props.modelValue.blocks.find((b) => b.id === blockId)
      if (!block || block.lines.length <= 1) return
      const idx = block.lines.findIndex((l) => l.id === lineId)
      commit(removeLyricLine(props.modelValue, blockId, lineId))
      nextTick(() => {
        const inputs = [
          ...document.querySelectorAll<HTMLTextAreaElement>(
            `[data-lyric-line-input][data-block-id="${blockId}"]`,
          ),
        ]
        inputs[Math.max(0, idx - 1)]?.focus()
      })
    }
  }
}

function autosize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.max(28, el.scrollHeight)}px`
}

function onLineFocus(event: FocusEvent) {
  autosize(event.target as HTMLTextAreaElement)
}

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function beginDrag(blockId: string) {
  if (drag.value) return
  clearLongPress()
  closeTypeMenu()
  suppressBadgeClick.value = true
  drag.value = { blockId }
  dropIndex.value = null
  haptics.grab()
  document.documentElement.classList.add('app-drag-active')
}

function startBlockDrag(blockId: string, e: PointerEvent) {
  if (e.button != null && e.button !== 0) return
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture?.(e.pointerId)
  clearLongPress()
  suppressBadgeClick.value = false
  dragArmed.value = { blockId, x: e.clientX, y: e.clientY }
  longPressTimer = setTimeout(() => beginDrag(blockId), 320)
}

function onBadgePointerMove(e: PointerEvent) {
  const armed = dragArmed.value
  if (!armed || drag.value) return
  const dx = e.clientX - armed.x
  const dy = e.clientY - armed.y
  if (Math.hypot(dx, dy) >= 8) beginDrag(armed.blockId)
  if (!drag.value) return
  updateDropAt(e.clientY)
}

function updateDropAt(clientY: number) {
  if (!drag.value) return
  const nodes = [
    ...document.querySelectorAll<HTMLElement>('[data-drop-lyric-block]'),
  ]
  if (!nodes.length) {
    dropIndex.value = 0
    return
  }
  for (let i = 0; i < nodes.length; i++) {
    const rect = nodes[i]!.getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    if (clientY < mid) {
      dropIndex.value = i
      return
    }
  }
  dropIndex.value = nodes.length
}

function endDrag(clientY?: number) {
  clearLongPress()
  dragArmed.value = null
  const d = drag.value
  if (d && clientY != null) updateDropAt(clientY)
  const to = dropIndex.value
  drag.value = null
  dropIndex.value = null
  document.documentElement.classList.remove('app-drag-active')
  if (!d || to == null) return
  commit(moveLyricBlock(props.modelValue, d.blockId, to))
}

function onBadgePointerUp(e: PointerEvent) {
  clearLongPress()
  if (drag.value) endDrag(e.clientY)
  dragArmed.value = null
}

function onBadgePointerCancel() {
  clearLongPress()
  dragArmed.value = null
  if (drag.value) {
    drag.value = null
    dropIndex.value = null
    document.documentElement.classList.remove('app-drag-active')
  }
}

function onWindowPointerMove(e: PointerEvent) {
  if (!drag.value) return
  e.preventDefault()
  updateDropAt(e.clientY)
}

function onWindowPointerUp(e: PointerEvent) {
  if (!drag.value) return
  endDrag(e.clientY)
}

onMounted(() => {
  window.addEventListener('pointermove', onWindowPointerMove, { passive: false })
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onBadgePointerCancel)
})

onBeforeUnmount(() => {
  clearLongPress()
  document.documentElement.classList.remove('app-drag-active')
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onBadgePointerCancel)
})

watch(
  () => typeMenu.value,
  (menu) => {
    if (!menu) return
    const onDoc = (e: Event) => {
      const t = e.target as HTMLElement | null
      if (t?.closest?.('.lyrics-editor__type-menu')) return
      closeTypeMenu()
    }
    nextTick(() => document.addEventListener('pointerdown', onDoc, { once: true }))
  },
)

const typeMenuCurrent = computed(() => {
  if (!typeMenu.value) return null
  return props.modelValue.blocks.find((b) => b.id === typeMenu.value!.blockId)?.type ?? null
})
</script>

<template>
  <div class="lyrics-editor" :class="{ 'lyrics-editor--dragging': Boolean(drag) }">
    <div class="lyrics-editor__toolbar">
      <h3 v-if="title" class="lyrics-editor__title">{{ title }}</h3>
      <button type="button" class="lyrics-editor__plain" @click="emit('edit-plain')">
        <AppIcon :name="icons.documentText" size="1rem" />
        {{ t('lyrics.editPlain') }}
      </button>
    </div>

    <div class="lyrics-editor__add">
      <button
        v-for="type in pickableTypes"
        :key="type"
        type="button"
        class="lyrics-editor__add-pill"
        @click="onAddBlock(type)"
      >
        + {{ sectionLabel(type) }}
      </button>
    </div>

    <div v-if="!modelValue.blocks.length" class="lyrics-editor__empty">
      <p>{{ t('lyrics.emptyBlocks') }}</p>
      <button type="button" class="lyrics-editor__empty-btn" @click="onAddBlock('verse')">
        {{ t('common.create') }}
      </button>
    </div>

    <div v-else class="lyrics-editor__score">
      <SwipeDeleteRow
        v-for="(block, blockIndex) in modelValue.blocks"
        :key="block.id"
        class="lyrics-editor__swipe"
        :disabled="Boolean(drag)"
        :end-actions="blockSwipeActions"
        @action="onSwipeAction(block.id, $event)"
      >
        <section
          class="lyrics-editor__block"
          :class="{
            'lyrics-editor__block--dragging': drag?.blockId === block.id,
            'lyrics-editor__block--drop-before': dropIndex === blockIndex,
            'lyrics-editor__block--drop-after':
              dropIndex === modelValue.blocks.length && blockIndex === modelValue.blocks.length - 1,
          }"
          data-drop-lyric-block
          :data-block-id="block.id"
          :data-block-index="blockIndex"
          :style="{
            '--section-wash': SECTION_COLOR_VAR[block.type] ?? SECTION_COLOR_VAR.custom,
            '--section-accent': SECTION_ACCENT_VAR[block.type] ?? SECTION_ACCENT_VAR.custom,
          }"
        >
          <header class="lyrics-editor__head">
            <button
              type="button"
              class="lyrics-editor__badge"
              :aria-label="t('lyrics.moveBlock')"
              aria-haspopup="menu"
              @pointerdown.stop="startBlockDrag(block.id, $event)"
              @pointermove="onBadgePointerMove"
              @pointerup="onBadgePointerUp"
              @pointercancel="onBadgePointerCancel"
              @click="onBadgeClick($event, block.id)"
            >
              <span class="lyrics-editor__dot" aria-hidden="true" />
              <span>{{ blockTitle(block.id) }}</span>
            </button>
          </header>

          <div class="lyrics-editor__lines">
            <textarea
              v-for="line in block.lines"
              :key="line.id"
              class="lyrics-editor__line"
              rows="1"
              data-lyric-line-input
              :data-block-id="block.id"
              :data-line-id="line.id"
              :value="line.text"
              :placeholder="t('lyrics.linePlaceholder')"
              @focus="onLineFocus"
              @input="onLineInput(block.id, line.id, $event)"
              @keydown="onLineKeydown(block.id, line.id, $event)"
            />
            <button
              type="button"
              class="lyrics-editor__add-line"
              @click="commit(addLyricLine(modelValue, block.id))"
            >
              <AppIcon :name="icons.plus" size="0.95rem" />
              {{ t('lyrics.addLine') }}
            </button>
          </div>
        </section>
      </SwipeDeleteRow>
    </div>

    <Teleport to="body">
      <div
        v-if="typeMenu"
        class="lyrics-editor__type-menu"
        role="menu"
        :aria-label="t('chart.sectionTypeMenu')"
        :style="{ top: `${typeMenu.top}px`, left: `${typeMenu.left}px` }"
      >
        <button
          v-for="opt in typeOptions"
          :key="opt.value"
          type="button"
          class="lyrics-editor__type-item"
          :class="{ 'lyrics-editor__type-item--on': typeMenuCurrent === opt.value }"
          :style="{
            '--type-accent': SECTION_ACCENT_VAR[opt.value] ?? SECTION_ACCENT_VAR.custom,
          }"
          role="menuitemradio"
          :aria-checked="typeMenuCurrent === opt.value"
          @click="pickType(opt.value)"
        >
          <span class="lyrics-editor__type-dot" aria-hidden="true" />
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.lyrics-editor {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.lyrics-editor--dragging,
.lyrics-editor--dragging * {
  cursor: grabbing !important;
  user-select: none;
}

.lyrics-editor__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.lyrics-editor__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.lyrics-editor__plain {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 0;
  background: transparent;
  color: var(--app-accent-text);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 650;
  cursor: pointer;
  padding: 0.2rem 0;
}

.lyrics-editor__add {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.lyrics-editor__add-pill {
  border: 0;
  border-radius: 999px;
  padding: 0.28rem 0.65rem;
  background: var(--app-hover);
  color: var(--app-ink);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 650;
  cursor: pointer;
}

.lyrics-editor__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border-radius: var(--app-radius-lg);
  background: var(--app-hover);
}

.lyrics-editor__empty p {
  margin: 0;
  color: var(--app-muted);
  font-size: 0.9rem;
}

.lyrics-editor__empty-btn {
  border: 0;
  border-radius: var(--app-radius);
  padding: 0.45rem 0.85rem;
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}

.lyrics-editor__score {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.lyrics-editor__block {
  border-radius: 12px;
  border-left: 3px solid var(--section-accent);
  background: var(--section-wash);
  padding: 0.55rem 0.7rem 0.7rem;
}

.lyrics-editor__block--dragging {
  opacity: 0.55;
}

.lyrics-editor__block--drop-before {
  box-shadow: inset 0 2px 0 var(--section-accent);
}

.lyrics-editor__block--drop-after {
  box-shadow: inset 0 -2px 0 var(--section-accent);
}

.lyrics-editor__head {
  margin-bottom: 0.35rem;
}

.lyrics-editor__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 0;
  background: transparent;
  color: var(--app-muted);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: grab;
  padding: 0.1rem 0;
  touch-action: none;
}

.lyrics-editor__dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: var(--section-accent);
}

.lyrics-editor__lines {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

.lyrics-editor__line {
  width: 100%;
  min-height: 1.75rem;
  resize: none;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  padding: 0.35rem 0.45rem;
  background: color-mix(in srgb, var(--app-surface) 72%, transparent);
  color: var(--app-ink);
  font: inherit;
  font-size: 0.95rem;
  line-height: 1.35;
}

.lyrics-editor__line:focus {
  outline: none;
  box-shadow: var(--app-focus-ring);
}

.lyrics-editor__add-line {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--app-muted);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.2rem 0.1rem;
}

.lyrics-editor__type-menu {
  position: fixed;
  z-index: 80;
  min-width: 10.5rem;
  padding: 0.35rem;
  border-radius: var(--app-radius-lg);
  background: var(--app-surface);
  box-shadow: var(--app-shadow-soft);
  border: 1px solid var(--app-border);
}

.lyrics-editor__type-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  border: 0;
  border-radius: var(--app-radius);
  background: transparent;
  color: var(--app-ink);
  font: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  padding: 0.45rem 0.55rem;
  cursor: pointer;
  text-align: left;
}

.lyrics-editor__type-item--on {
  background: var(--app-hover);
}

.lyrics-editor__type-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: var(--type-accent);
}
</style>
