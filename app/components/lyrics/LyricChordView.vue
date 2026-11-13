<script setup lang="ts">
import type { ChordChart, SongLyricsDoc } from '~~/shared/types'
import { SECTION_ACCENT_VAR, SECTION_COLOR_VAR } from '~/utils/music/chart/types'
import {
  lyricsBlockDisplayTitle,
  moveAnchor,
  relocateAnchor,
  removeAnchor,
  resolveLyricsDoc,
  sectionChordPalette,
  updateLineInDoc,
  upsertAnchor,
  type ResolvedLyricAnchor,
  type ResolvedLyricLine,
} from '~/utils/music/lyrics'
import { caretPointInElement, offsetAtClientPoint } from '~/utils/music/lyrics/measure'

const props = withDefaults(
  defineProps<{
    doc: SongLyricsDoc
    chart: ChordChart | null
    showChords?: boolean
    editable?: boolean
  }>(),
  {
    showChords: true,
    editable: false,
  },
)

const emit = defineEmits<{
  'update:doc': [doc: SongLyricsDoc]
}>()

const rootEl = ref<HTMLElement | null>(null)

const resolved = computed(() => resolveLyricsDoc(props.doc, props.chart))

const selectedItemId = ref<string | null>(null)

/**
 * Click after pointerdown on an anchor still bubbles to the line.
 * Without this, a tap on G places the next unused chord (e.g. Bm) on top.
 */
let suppressLineClick = false

/**
 * During drag we keep the source chord in the DOM (hidden) so pointer capture
 * is not cancelled when crossing lines. Preview target lives only in `drag`.
 * Commit happens on pointerup.
 */
const drag = ref<{
  blockId: string
  /** Line where the chord still lives in the document */
  sourceLineId: string
  /** Live preview line under the finger */
  targetLineId: string
  anchorId: string
  itemId: string
  symbol: string
  pointerId: number
  offset: number
  startOffset: number
  startX: number
  startY: number
  moved: boolean
  rowClientY: number
  ghostX: number
  ghostY: number
} | null>(null)

function blockTitle(blockId: string) {
  return lyricsBlockDisplayTitle(props.doc.blocks, blockId)
}

function paletteFor(blockId: string) {
  const block = props.doc.blocks.find((b) => b.id === blockId)
  return sectionChordPalette(props.chart, block?.chartSectionId ?? null)
}

/** Next chart chord for this line: unused in section order, else last selected / first. */
function itemIdForTap(blockId: string, lineId: string): string | null {
  const palette = paletteFor(blockId)
  if (!palette.length) return null
  const block = props.doc.blocks.find((b) => b.id === blockId)
  const rawLine = block?.lines.find((l) => l.id === lineId)
  const used = new Set((rawLine?.anchors ?? []).map((a) => a.itemId))
  const unused = palette.find((p) => !used.has(p.id))
  if (unused) return unused.id
  if (selectedItemId.value && palette.some((p) => p.id === selectedItemId.value)) {
    return selectedItemId.value
  }
  return palette[0]!.id
}

function onLineClick(blockId: string, line: ResolvedLyricLine, offset: number) {
  if (!props.editable || !props.showChords) return
  if (drag.value) return
  if (suppressLineClick) {
    suppressLineClick = false
    return
  }
  const block = props.doc.blocks.find((b) => b.id === blockId)
  const rawLine = block?.lines.find((l) => l.id === line.id)
  if (!rawLine) return
  // Don't invent a new chord on top of / next to an existing one
  const near = rawLine.anchors.some((a) => Math.abs(a.offset - offset) <= 1)
  if (near) return

  const itemId = itemIdForTap(blockId, line.id)
  if (!itemId) return
  selectedItemId.value = itemId
  const nextLine = upsertAnchor(rawLine, itemId, offset)
  emit('update:doc', updateLineInDoc(props.doc, blockId, line.id, nextLine))
}

function lineElsInBlock(blockId: string): HTMLElement[] {
  if (!rootEl.value) return []
  const blockEl = rootEl.value.querySelector(`[data-block-id="${blockId}"]`)
  if (!blockEl) return []
  return Array.from(blockEl.querySelectorAll<HTMLElement>('[data-line-id]'))
}

function hitTestLine(
  blockId: string,
  clientX: number,
  clientY: number,
): { lineId: string; textEl: HTMLElement; lineEl: HTMLElement } | null {
  const lines = lineElsInBlock(blockId)
  if (!lines.length) return null

  let best: { lineId: string; textEl: HTMLElement; lineEl: HTMLElement; dist: number } | null = null

  for (const lineEl of lines) {
    const lineId = lineEl.dataset.lineId
    const textEl = lineEl.querySelector('.lyric-chord__text') as HTMLElement | null
    if (!lineId || !textEl) continue
    const rect = lineEl.getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom && clientX >= rect.left && clientX <= rect.right) {
      return { lineId, textEl, lineEl }
    }
    const midY = (rect.top + rect.bottom) / 2
    const dist = Math.abs(clientY - midY)
    if (!best || dist < best.dist) best = { lineId, textEl, lineEl, dist }
  }

  return best ? { lineId: best.lineId, textEl: best.textEl, lineEl: best.lineEl } : null
}

function detachWindowDrag() {
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerCancel)
}

function endDrag() {
  detachWindowDrag()
  drag.value = null
  rootEl.value?.classList.remove('lyric-chord--dragging')
}

function commitDrag() {
  const d = drag.value
  if (!d) {
    endDrag()
    return
  }
  suppressLineClick = true

  const moved =
    d.moved ||
    d.targetLineId !== d.sourceLineId ||
    d.offset !== d.startOffset

  if (!moved) {
    endDrag()
    return
  }

  const block = props.doc.blocks.find((b) => b.id === d.blockId)
  if (!block) {
    endDrag()
    return
  }

  if (d.targetLineId === d.sourceLineId) {
    const line = block.lines.find((l) => l.id === d.sourceLineId)
    if (line) {
      emit(
        'update:doc',
        updateLineInDoc(props.doc, d.blockId, d.sourceLineId, moveAnchor(line, d.anchorId, d.offset)),
      )
    }
  } else {
    emit(
      'update:doc',
      relocateAnchor(
        props.doc,
        d.blockId,
        d.sourceLineId,
        d.targetLineId,
        d.anchorId,
        d.offset,
      ),
    )
  }
  endDrag()
}

function onWindowPointerMove(event: PointerEvent) {
  const d = drag.value
  if (!d || event.pointerId !== d.pointerId) return
  event.preventDefault()

  const hit = hitTestLine(d.blockId, event.clientX, event.clientY)
  if (!hit) {
    drag.value = {
      ...d,
      moved: true,
      ghostX: event.clientX,
      ghostY: event.clientY,
    }
    return
  }

  const sameAsSource = hit.lineId === d.sourceLineId
  const y = sameAsSource ? d.rowClientY : event.clientY
  const offset = offsetAtClientPoint(hit.textEl, event.clientX, y)
  const moved =
    d.moved ||
    hit.lineId !== d.sourceLineId ||
    offset !== d.startOffset ||
    Math.hypot(event.clientX - d.startX, event.clientY - d.startY) > 8

  const textRect = hit.textEl.getBoundingClientRect()
  drag.value = {
    ...d,
    targetLineId: hit.lineId,
    offset,
    moved,
    // When previewing another line, unlock Y to that line's ink for next small moves
    rowClientY: sameAsSource
      ? d.rowClientY
      : textRect.top + Math.min(8, textRect.height * 0.35),
    ghostX: event.clientX,
    ghostY: event.clientY,
  }
}

function onWindowPointerUp(event: PointerEvent) {
  if (!drag.value || event.pointerId !== drag.value.pointerId) return
  suppressLineClick = true
  commitDrag()
}

function onWindowPointerCancel(event: PointerEvent) {
  // Ignore cancel caused by transient UI — keep drag if we still have state.
  // Real OS cancels rarely; if pointer is gone, next up won't come — drop without commit? 
  // Safer: commit current preview so work isn't lost.
  if (!drag.value || event.pointerId !== drag.value.pointerId) return
  commitDrag()
}

function onAnchorDown(
  blockId: string,
  line: ResolvedLyricLine,
  anchor: ResolvedLyricAnchor,
  event: PointerEvent,
) {
  if (!props.editable || !props.showChords) return
  event.preventDefault()
  event.stopPropagation()
  suppressLineClick = true
  selectedItemId.value = anchor.itemId

  const hit = hitTestLine(blockId, event.clientX, event.clientY)
  let rowClientY = event.clientY
  if (hit) {
    const point = caretPointInElement(hit.textEl, hit.lineEl, anchor.offset)
    const lineRect = hit.lineEl.getBoundingClientRect()
    rowClientY = lineRect.top + point.top + point.height * 0.45
  }

  endDrag()
  suppressLineClick = true

  drag.value = {
    blockId,
    sourceLineId: line.id,
    targetLineId: line.id,
    anchorId: anchor.id,
    itemId: anchor.itemId,
    symbol: anchor.symbol,
    pointerId: event.pointerId,
    offset: anchor.offset,
    startOffset: anchor.offset,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    rowClientY,
    ghostX: event.clientX,
    ghostY: event.clientY,
  }
  rootEl.value?.classList.add('lyric-chord--dragging')

  // Capture on the original button — it stays mounted until pointerup
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  } catch {
    /* ignore */
  }

  window.addEventListener('pointermove', onWindowPointerMove, { passive: false })
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerCancel)
}

onBeforeUnmount(() => {
  endDrag()
})

/** Desktop right-click only — touch long-press must not delete (conflicts with drag). */
function onAnchorRemove(blockId: string, lineId: string, anchorId: string, event: Event) {
  if (!props.editable) return
  event.preventDefault()
  event.stopPropagation()
  const pe = event as PointerEvent
  if (pe.pointerType === 'touch') return
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
  const block = props.doc.blocks.find((b) => b.id === blockId)
  const rawLine = block?.lines.find((l) => l.id === lineId)
  if (!rawLine) return
  emit('update:doc', updateLineInDoc(props.doc, blockId, lineId, removeAnchor(rawLine, anchorId)))
}

/** Preview drop marker on the target line while dragging. */
const dropPreview = computed(() => {
  const d = drag.value
  if (!d) return null
  return {
    blockId: d.blockId,
    lineId: d.targetLineId,
    offset: d.offset,
    symbol: d.symbol,
  }
})
</script>

<template>
  <div
    ref="rootEl"
    class="lyric-chord"
    :class="{
      'lyric-chord--editable': editable && showChords,
      'lyric-chord--dragging': Boolean(drag),
    }"
  >
    <section
      v-for="block in resolved"
      :key="block.id"
      class="lyric-chord__block"
      :data-block-id="block.id"
      :style="{
        '--section-wash': SECTION_COLOR_VAR[block.type] ?? SECTION_COLOR_VAR.custom,
        '--section-accent': SECTION_ACCENT_VAR[block.type] ?? SECTION_ACCENT_VAR.custom,
      }"
    >
      <header class="lyric-chord__head">{{ blockTitle(block.id) }}</header>

      <LyricChordLine
        v-for="line in block.lines"
        :key="line.id"
        :line="line"
        :show-chords="showChords"
        :editable="editable"
        :selected-item-id="selectedItemId"
        :dragging-anchor-id="drag?.anchorId ?? null"
        :drop-preview="
          dropPreview && dropPreview.lineId === line.id && dropPreview.blockId === block.id
            ? dropPreview
            : null
        "
        @line-click="(offset) => onLineClick(block.id, line, offset)"
        @anchor-down="(anchor, event) => onAnchorDown(block.id, line, anchor, event)"
        @anchor-remove="(anchorId, event) => onAnchorRemove(block.id, line.id, anchorId, event)"
      />
    </section>

    <!-- Floating ghost follows the finger; source chord stays mounted (hidden) -->
    <Teleport to="body">
      <div
        v-if="drag"
        class="lyric-chord__ghost"
        :style="{ left: `${drag.ghostX}px`, top: `${drag.ghostY}px` }"
        aria-hidden="true"
      >
        {{ drag.symbol }}
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.lyric-chord {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.lyric-chord__block {
  border-radius: 12px;
  border-left: 3px solid var(--section-accent);
  background: var(--section-wash);
  padding: 0.65rem 0.75rem 0.75rem;
}

.lyric-chord__head {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
  margin-bottom: 0.45rem;
}

.lyric-chord--editable :deep(.lyric-chord__line) {
  cursor: text;
}

.lyric-chord--dragging {
  user-select: none;
  touch-action: none;
}

.lyric-chord--dragging :deep(.lyric-chord__line) {
  cursor: grabbing;
}

:deep(.lyric-chord__line) {
  position: relative;
  margin: 0.25rem 0;
  min-height: 1.6rem;
  touch-action: manipulation;
}

:deep(.lyric-chord__line--chords) {
  padding-top: 1.15rem;
}

.lyric-chord--editable :deep(.lyric-chord__line--chords) {
  /* Extra room for invisible hit pads above the lyric */
  padding-top: 1.55rem;
}

:deep(.lyric-chord__line--empty) {
  opacity: 0.35;
}

:deep(.lyric-chord__chords) {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

:deep(.lyric-chord__anchor) {
  position: absolute;
  appearance: none;
  border: 0;
  margin: 0;
  padding: 0;
  background: transparent;
  color: var(--section-accent);
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.1;
  pointer-events: none;
  white-space: nowrap;
  transform: none;
}

.lyric-chord--editable :deep(.lyric-chord__anchor) {
  pointer-events: auto;
  touch-action: none;
  cursor: grab;
  -webkit-tap-highlight-color: transparent;
}

/* Invisible hit pad — same look as view mode, easier to grab */
.lyric-chord--editable :deep(.lyric-chord__anchor)::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(100% + 1.5rem, 2.75rem);
  height: max(100% + 1.35rem, 2.75rem);
  transform: translate(-50%, -50%);
}

.lyric-chord--editable :deep(.lyric-chord__anchor:active),
.lyric-chord--editable :deep(.lyric-chord__anchor--dragging) {
  cursor: grabbing;
}

.lyric-chord--editable :deep(.lyric-chord__anchor--active) {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.lyric-chord--editable :deep(.lyric-chord__anchor--dragging) {
  opacity: 0.25;
}

:deep(.lyric-chord__drop) {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  color: var(--section-accent);
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.1;
  opacity: 0.55;
  pointer-events: none;
  white-space: nowrap;
}

:deep(.lyric-chord__text) {
  margin: 0;
  font-size: 1rem;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

:deep(.lyric-chord__line--chords .lyric-chord__text) {
  line-height: 2.35;
}

.lyric-chord--editable :deep(.lyric-chord__line--chords .lyric-chord__text) {
  line-height: 2.45;
}
</style>

<style>
/* Teleported ghost — unscoped */
.lyric-chord__ghost {
  position: fixed;
  z-index: 10000;
  transform: translate(-30%, -120%);
  padding: 0.12rem 0.4rem;
  border-radius: 4px;
  background: var(--app-surface, #fff);
  color: var(--app-ink, #111);
  box-shadow: var(--app-shadow-soft, 0 4px 16px rgba(0, 0, 0, 0.18));
  font-weight: 700;
  font-size: 0.85rem;
  line-height: 1.1;
  white-space: nowrap;
  pointer-events: none;
}
</style>
