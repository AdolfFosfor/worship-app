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
const CHORD_GAP = 4

function measure() {
  const text = textEl.value
  const line = lineEl.value
  if (!text || !line || !props.showChords) {
    boxById.value = {}
    dropLeft.value = 0
    return
  }
  const next: Record<string, AnchorBox> = {}
  for (const anchor of props.line.anchors) {
    const point = caretPointInElement(text, line, anchor.offset)
    next[anchor.id] = {
      left: Math.max(0, point.left),
      top: Math.max(0, point.top - 15 - CHORD_GAP),
    }
  }
  boxById.value = next

  if (props.dropPreview) {
    const point = caretPointInElement(text, line, props.dropPreview.offset)
    dropLeft.value = Math.max(0, point.left)
  }
}

watch(
  () =>
    [props.line.text, props.line.anchors, props.showChords, props.dropPreview] as const,
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
  emit('lineClick', offsetAtClientPoint(textEl.value, event.clientX, event.clientY), event)
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
        :style="{ left: `${dropLeft}px` }"
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
        @contextmenu="emit('anchorRemove', anchor.id, $event)"
      >
        {{ anchor.symbol }}
      </button>
    </div>
    <p ref="textEl" class="lyric-chord__text">{{ line.text || '\u00a0' }}</p>
  </div>
</template>
