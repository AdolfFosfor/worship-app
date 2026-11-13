<script setup lang="ts">
import type { ResolvedLyricAnchor, ResolvedLyricLine } from '~/utils/music/lyrics'
import { caretPointInElement, offsetAtClientPoint } from '~/utils/music/lyrics/measure'

const props = defineProps<{
  line: ResolvedLyricLine
  showChords: boolean
  editable: boolean
  selectedItemId: string | null
  draggingAnchorId?: string | null
  dropPreview?: { offset: number; symbol: string } | null
}>()

const emit = defineEmits<{
  lineClick: [offset: number, event: MouseEvent]
  anchorDown: [anchor: ResolvedLyricAnchor, event: PointerEvent]
  anchorRemove: [anchorId: string, event: Event]
}>()

const lineEl = ref<HTMLElement | null>(null)
const textEl = ref<HTMLElement | null>(null)

interface AnchorBox {
  left: number
  top: number
}

const boxById = ref<Record<string, AnchorBox>>({})
const dropLeft = ref(0)
const dropTop = ref(0)
const CHORD_GAP = 4
const ROW_SLACK = 10

function symbolWidth(symbol: string): number {
  // ~tabular chord glyph width; keep separation light so layout stays natural
  return Math.max(12, symbol.length * 8)
}

function resolveOverlaps(
  boxes: { id: string; left: number; top: number; width: number }[],
  maxRight: number,
): Record<string, AnchorBox> {
  if (!boxes.length) return {}
  const byRow = new Map<number, typeof boxes>()
  for (const box of boxes) {
    const key = Math.round(box.top / ROW_SLACK)
    const list = byRow.get(key) ?? []
    list.push(box)
    byRow.set(key, list)
  }

  const out: Record<string, AnchorBox> = {}
  for (const row of byRow.values()) {
    row.sort((a, b) => a.left - b.left || a.id.localeCompare(b.id))
    let cursor = -Infinity
    for (const box of row) {
      let left = Math.max(box.left, cursor)
      if (maxRight > 0 && left + box.width > maxRight) {
        left = Math.max(0, maxRight - box.width)
      }
      out[box.id] = { left, top: box.top }
      cursor = left + box.width + 4
    }
  }
  return out
}

function measure() {
  const text = textEl.value
  const line = lineEl.value
  if (!text || !line || !props.showChords) {
    boxById.value = {}
    dropLeft.value = 0
    dropTop.value = 0
    return
  }
  const lift = 15
  const measured: { id: string; left: number; top: number; width: number }[] = []
  for (const anchor of props.line.anchors) {
    const point = caretPointInElement(text, line, anchor.offset)
    measured.push({
      id: anchor.id,
      left: Math.max(0, point.left),
      top: Math.max(0, point.top - lift - CHORD_GAP),
      width: symbolWidth(anchor.symbol),
    })
  }

  if (measured.length > 1) {
    const maxRight = line.clientWidth || text.clientWidth || 0
    boxById.value = resolveOverlaps(measured, maxRight)
  } else {
    const next: Record<string, AnchorBox> = {}
    for (const box of measured) next[box.id] = { left: box.left, top: box.top }
    boxById.value = next
  }

  if (props.dropPreview) {
    const point = caretPointInElement(text, line, props.dropPreview.offset)
    dropLeft.value = Math.max(0, point.left)
    dropTop.value = Math.max(0, point.top - lift - CHORD_GAP)
  }
}

watch(
  () =>
    [
      props.line.text,
      props.line.anchors,
      props.showChords,
      props.editable,
      props.dropPreview,
    ] as const,
  () => {
    void nextTick(() => measure())
  },
  { deep: true, immediate: true },
)

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'undefined' || !lineEl.value) return
  resizeObserver = new ResizeObserver(() => measure())
  resizeObserver.observe(lineEl.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

function onClick(event: MouseEvent) {
  if (!props.editable || !textEl.value) return
  if (props.draggingAnchorId) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.lyric-chord__anchor')) return
  emit('lineClick', offsetAtClientPoint(textEl.value, event.clientX, event.clientY), event)
}

function onAnchorClick(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
}
</script>

<template>
  <div
    ref="lineEl"
    class="lyric-chord__line"
    :class="{
      'lyric-chord__line--empty': !line.text.trim(),
      'lyric-chord__line--chords': showChords,
    }"
    :data-line-id="line.id"
    @click="onClick"
  >
    <div v-if="showChords" class="lyric-chord__chords" aria-hidden="true">
      <span
        v-if="dropPreview"
        class="lyric-chord__drop"
        :style="{ left: `${dropLeft}px`, top: `${dropTop}px` }"
      >
        {{ dropPreview.symbol }}
      </span>
      <button
        v-for="anchor in line.anchors"
        :key="anchor.id"
        type="button"
        class="lyric-chord__anchor"
        :class="{
          'lyric-chord__anchor--active': selectedItemId === anchor.itemId,
          'lyric-chord__anchor--dragging': draggingAnchorId === anchor.id,
        }"
        :style="{
          left: `${boxById[anchor.id]?.left ?? 0}px`,
          top: `${boxById[anchor.id]?.top ?? 0}px`,
        }"
        :aria-label="anchor.symbol"
        @pointerdown="emit('anchorDown', anchor, $event)"
        @click="onAnchorClick"
        @contextmenu="emit('anchorRemove', anchor.id, $event)"
      >
        {{ anchor.symbol }}
      </button>
    </div>
    <p ref="textEl" class="lyric-chord__text">{{ line.text || '\u00a0' }}</p>
  </div>
</template>
