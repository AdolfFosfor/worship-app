<script setup lang="ts">
import type {
  AnnotationPreset,
  ChordChart,
  SectionType,
  TimeSignature,
} from '~~/shared/types'
import { SECTION_TYPES, TIME_SIGNATURES } from '~~/shared/types'
import {
  ChartHistory,
  SECTION_ACCENT_VAR,
  SECTION_COLOR_VAR,
  createAnnotation,
  createChord,
  createEmptyChart,
  getMeter,
  parseLegacyChords,
  sectionAutoTitle,
} from '~/utils/music/chart'
import {
  addBar,
  addSection,
  clearBar,
  mergeBars,
  moveBar,
  moveItem,
  swapItems,
  removeBar,
  removeItem,
  removeSection,
  updateSection,
  withChart,
  insertItem,
} from '~/utils/music/chart/ops'
import { icons } from '~/utils/icons'
import { useEditorReveal } from '~/composables/useEditorReveal'

const { t } = useAppLocale()
const haptics = useHaptics()

function sectionLabel(type: string) {
  return t(`chart.section.${type}`)
}

function autoSectionTitle(sectionId: string) {
  return sectionAutoTitle(chart.value.sections, sectionId, sectionLabel)
}

const props = withDefaults(
  defineProps<{
    modelValue: ChordChart | null
    legacyChords?: string | null
    /** Optional song tempo; edited next to time signature. */
    bpm?: number | null
  }>(),
  {
    legacyChords: null,
    bpm: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: ChordChart]
  'update:legacyChords': [value: string | null]
  'update:bpm': [value: number | null]
}>()

function onBpmInput(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) {
    emit('update:bpm', null)
    return
  }
  const n = Math.round(Number(value))
  emit('update:bpm', Math.max(30, Math.min(300, n)))
}

const { revealElement, revealSelector } = useEditorReveal()

const history = new ChartHistory()
const canUndo = ref(false)
const canRedo = ref(false)
const keyboardOpen = ref(false)
const typeMenu = ref<{ sectionId: string; top: number; left: number } | null>(null)

const timeSignatureOptions = TIME_SIGNATURES.map((value) => ({ label: value, value }))
/** UI-facing section types — no freeform «Секция». */
const pickableSectionTypes = SECTION_TYPES.filter((type) => type !== 'custom') as SectionType[]
const sectionTypeOptions = computed(() =>
  pickableSectionTypes.map((value) => ({
    label: t(`chart.section.${value}`),
    value,
  })),
)

type Selection = {
  sectionId: string
  barId: string
  /** Index where the next chord/annotation will be inserted. */
  insertIndex: number
  itemId?: string
}

const selected = ref<Selection | null>(null)

/** Stable draft while parent has not yet committed chordChart (avoids new IDs every render). */
const draftChart = ref<ChordChart>(props.modelValue ?? createEmptyChart())

const chart = computed(() => props.modelValue ?? draftChart.value)
const hasLegacy = computed(() => Boolean(props.legacyChords?.trim()))
const showConvert = computed(() => hasLegacy.value && !props.modelValue)
const showReconvert = computed(() => hasLegacy.value && Boolean(props.modelValue))

const typeMenuCurrentType = computed(() => {
  const id = typeMenu.value?.sectionId
  if (!id) return null
  return chart.value.sections.find((s) => s.id === id)?.type ?? null
})

type DragKind = 'item' | 'bar'
const drag = ref<{
  kind: DragKind
  sectionId: string
  barId: string
  itemId?: string
} | null>(null)
const dropHint = ref<{
  sectionId: string
  barId?: string
  index: number
  /** Край чипа-цели: линия до/после */
  edge?: 'before' | 'after'
  overItemId?: string
  mode?: 'insert' | 'swap'
} | null>(null)
const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null)

function syncHistoryFlags() {
  canUndo.value = history.canUndo
  canRedo.value = history.canRedo
}

function currentChart(): ChordChart {
  return props.modelValue ?? draftChart.value
}

function commit(next: ChordChart) {
  history.push(currentChart())
  draftChart.value = next
  emit('update:modelValue', next)
  syncHistoryFlags()
}

function undo() {
  const prev = history.undo(currentChart())
  if (!prev) return
  draftChart.value = prev
  emit('update:modelValue', prev)
  syncHistoryFlags()
}

function redo() {
  const next = history.redo(currentChart())
  if (!next) return
  draftChart.value = next
  emit('update:modelValue', next)
  syncHistoryFlags()
}

const barMenuId = ref<string | null>(null)

function ensureChart(): ChordChart {
  if (props.modelValue) {
    draftChart.value = props.modelValue
    return props.modelValue
  }
  emit('update:modelValue', draftChart.value)
  return draftChart.value
}

function openKeyboard() {
  ensureChart()
  barMenuId.value = null
  keyboardOpen.value = true
}

function closeChrome() {
  keyboardOpen.value = false
}

function revealSelection(opts?: { force?: boolean }) {
  const sel = selected.value
  if (!sel) return
  void nextTick(() => {
    if (sel.itemId) {
      revealSelector(`[data-item-id="${sel.itemId}"]`, opts)
      return
    }
    const insert = document.querySelector(
      `[data-insert-slot][data-bar-id="${sel.barId}"][data-index="${sel.insertIndex}"]`,
    )
    if (insert) {
      revealElement(insert, opts)
      return
    }
    revealSelector(`[data-bar-id="${sel.barId}"].chart-bar`, opts)
  })
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) draftChart.value = value
  },
)

/** Keep selection barId valid after chart commits (parent may remount chart identity). */
watch(chart, (live) => {
  const sel = selected.value
  if (!sel) return
  const section = live.sections.find((s) => s.id === sel.sectionId)
  if (!section) {
    selected.value = null
    return
  }
  if (!section.bars.some((b) => b.id === sel.barId)) {
    const bar = section.bars[0]
    selected.value = bar
      ? { sectionId: section.id, barId: bar.id, insertIndex: Math.min(sel.insertIndex, bar.items.length) }
      : null
  }
})

function convertLegacy() {
  const parsed = parseLegacyChords(props.legacyChords)
  history.clear()
  draftChart.value = parsed
  emit('update:modelValue', parsed)
  syncHistoryFlags()
  const first = parsed.sections[0]
  const bar = first?.bars[0]
  if (first && bar) {
    selected.value = { sectionId: first.id, barId: bar.id, insertIndex: bar.items.length }
  }
}

function setTimeSignature(ts: TimeSignature) {
  const { barPulses } = getMeter(ts)
  commit(
    withChart(currentChart(), (d) => {
      d.timeSignature = ts
      // Keep sequence intact; only clamp explicit durations that no longer fit the pulse grid.
      for (const section of d.sections) {
        for (const bar of section.bars) {
          for (const item of bar.items) {
            if (item.kind === 'chord' && item.duration && item.duration.beats > barPulses) {
              item.duration = { ...item.duration, beats: barPulses }
            }
          }
        }
      }
    }),
  )
}

function sectionIsEmpty(sectionId: string) {
  const section = chart.value.sections.find((s) => s.id === sectionId)
  if (!section) return true
  return section.bars.every((b) => b.items.length === 0)
}

/** Hide empty CTA once user started inserting into this section. */
function sectionShowsEmptyCta(sectionId: string) {
  if (selected.value?.sectionId === sectionId) return false
  return sectionIsEmpty(sectionId)
}

function startFirstBar(sectionId: string) {
  const live = ensureChart()
  const section = live.sections.find((s) => s.id === sectionId) ?? live.sections[0]
  if (!section) return
  let bar = section.bars[0]
  if (!bar) {
    const next = addBar(live, section.id)
    commit(next)
    bar = next.sections.find((s) => s.id === section.id)?.bars[0]
  }
  if (!bar) return
  selected.value = { sectionId: section.id, barId: bar.id, insertIndex: 0 }
  openKeyboard()
}

function onAddSection(type: SectionType) {
  const next = addSection(currentChart(), type)
  commit(next)
  const added = next.sections[next.sections.length - 1]
  const bar = added?.bars[0]
  if (added && bar) {
    selected.value = { sectionId: added.id, barId: bar.id, insertIndex: 0 }
    openKeyboard()
  }
}

function onRemoveSection(sectionId: string) {
  commit(removeSection(currentChart(), sectionId))
  if (selected.value?.sectionId === sectionId) selected.value = null
}

function changeSectionType(sectionId: string, type: SectionType) {
  commit(updateSection(currentChart(), sectionId, { type }))
}

function closeTypeMenu() {
  typeMenu.value = null
}

function toggleTypeMenu(event: MouseEvent, sectionId: string) {
  event.preventDefault()
  event.stopPropagation()
  if (typeMenu.value?.sectionId === sectionId) {
    closeTypeMenu()
    return
  }
  const el = event.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  const menuWidth = 168
  const left = Math.min(
    Math.max(8, rect.left),
    Math.max(8, window.innerWidth - menuWidth - 8),
  )
  typeMenu.value = {
    sectionId,
    top: rect.bottom + 6,
    left,
  }
}

function pickSectionType(type: SectionType) {
  const sectionId = typeMenu.value?.sectionId
  if (sectionId) changeSectionType(sectionId, type)
  closeTypeMenu()
}

function onTypeMenuPointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (!target) return
  if ((target as Element).closest?.('.chart-type-menu, .chart-section__badge')) return
  closeTypeMenu()
}

function selectInsert(sectionId: string, barId: string, insertIndex: number) {
  ensureChart()
  selected.value = { sectionId, barId, insertIndex }
  openKeyboard()
  revealSelection({ force: true })
}

function selectBar(sectionId: string, barId: string, itemCount: number) {
  selected.value = { sectionId, barId, insertIndex: itemCount }
  barMenuId.value = barMenuId.value === barId ? null : barId
  revealSelection()
}

function selectItem(sectionId: string, barId: string, itemId: string, afterIndex: number) {
  barMenuId.value = null
  selected.value = { sectionId, barId, insertIndex: afterIndex + 1, itemId }
  revealSelection()
}

function onAddBar(sectionId: string, afterBarId?: string) {
  const next = addBar(currentChart(), sectionId, afterBarId)
  commit(next)
  const section = next.sections.find((s) => s.id === sectionId)
  const newBar = afterBarId
    ? section?.bars[section.bars.findIndex((b) => b.id === afterBarId) + 1]
    : section?.bars[section.bars.length - 1]
  if (newBar) {
    selected.value = { sectionId, barId: newBar.id, insertIndex: 0 }
    openKeyboard()
    revealSelection({ force: true })
  }
}

function onRemoveBar(sectionId: string, barId: string) {
  commit(removeBar(currentChart(), sectionId, barId))
  if (selected.value?.barId === barId) selected.value = null
}

function onClearBar(sectionId: string, barId: string) {
  commit(clearBar(currentChart(), sectionId, barId))
  if (selected.value?.barId === barId) {
    selected.value = { sectionId, barId, insertIndex: 0 }
  }
}

function onMergeWithNext(sectionId: string, barId: string) {
  const section = currentChart().sections.find((s) => s.id === sectionId)
  if (!section) return
  const idx = section.bars.findIndex((b) => b.id === barId)
  const next = section.bars[idx + 1]
  if (!next) return
  commit(mergeBars(currentChart(), sectionId, barId, next.id))
}

function resolveInsertTarget(base: ChordChart) {
  const target = selected.value
  const section =
    (target && base.sections.find((s) => s.id === target.sectionId)) || base.sections[0]
  if (!section) return null
  const bar =
    (target && section.bars.find((b) => b.id === target.barId)) || section.bars[0]
  if (!bar) return null
  const insertIndex = target?.insertIndex ?? bar.items.length
  return { sectionId: section.id, barId: bar.id, insertIndex }
}

function onChord(symbol: string) {
  const base = currentChart()
  const target = resolveInsertTarget(base)
  if (!target) return
  commit(insertItem(base, target.sectionId, target.barId, createChord(symbol), target.insertIndex))
  selected.value = {
    sectionId: target.sectionId,
    barId: target.barId,
    insertIndex: target.insertIndex + 1,
  }
  void nextTick(() => revealSelection({ force: true }))
}

function onAnnotation(text: string, preset?: AnnotationPreset) {
  const base = currentChart()
  const target = resolveInsertTarget(base)
  if (!target) return
  commit(
    insertItem(base, target.sectionId, target.barId, createAnnotation(text, preset), target.insertIndex),
  )
  selected.value = {
    sectionId: target.sectionId,
    barId: target.barId,
    insertIndex: target.insertIndex + 1,
  }
  void nextTick(() => revealSelection({ force: true }))
}

function onNextBar() {
  const base = currentChart()
  const sectionId = selected.value?.sectionId ?? base.sections[0]?.id
  if (!sectionId) return
  const section = base.sections.find((s) => s.id === sectionId)
  if (!section) return
  const afterId = selected.value?.barId ?? section.bars[section.bars.length - 1]?.id
  const next = addBar(base, sectionId, afterId)
  commit(next)
  const updated = next.sections.find((s) => s.id === sectionId)
  const afterIdx = afterId ? (updated?.bars.findIndex((x) => x.id === afterId) ?? -1) : -1
  const newBar = updated?.bars[afterIdx + 1] ?? updated?.bars[updated.bars.length - 1]
  if (newBar) selected.value = { sectionId, barId: newBar.id, insertIndex: 0 }
  void nextTick(() => revealSelection({ force: true }))
}

function onRemoveItem(sectionId: string, barId: string, itemId: string) {
  const bar = currentChart().sections.find((s) => s.id === sectionId)?.bars.find((b) => b.id === barId)
  const idx = bar?.items.findIndex((i) => i.id === itemId) ?? -1
  commit(removeItem(currentChart(), sectionId, barId, itemId))
  selected.value = {
    sectionId,
    barId,
    insertIndex: Math.max(0, idx),
  }
}

function clearLongPress() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

function startItemDrag(sectionId: string, barId: string, itemId: string, e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture?.(e.pointerId)
  clearLongPress()
  longPressTimer.value = setTimeout(() => {
    drag.value = { kind: 'item', sectionId, barId, itemId }
    haptics.grab()
  }, e.pointerType === 'touch' ? 320 : 0)
}

function startBarDrag(sectionId: string, barId: string, e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture?.(e.pointerId)
  clearLongPress()
  longPressTimer.value = setTimeout(() => {
    barMenuId.value = null
    drag.value = { kind: 'bar', sectionId, barId }
    haptics.grab()
  }, e.pointerType === 'touch' ? 320 : 0)
}

function barDropHintFromBar(
  bar: HTMLElement,
  clientX: number,
): {
  sectionId: string
  barId: string
  index: number
  edge: 'before' | 'after'
  mode: 'insert'
} {
  const sectionId = bar.dataset.sectionId!
  const barId = bar.dataset.barId!
  const barIndex = Number(bar.dataset.barIndex ?? 0)
  const rect = bar.getBoundingClientRect()
  const edge: 'before' | 'after' = clientX < rect.left + rect.width / 2 ? 'before' : 'after'
  return {
    sectionId,
    barId,
    index: edge === 'before' ? barIndex : barIndex + 1,
    edge,
    mode: 'insert',
  }
}

watch(
  () =>
    dropHint.value
      ? `${dropHint.value.sectionId}:${dropHint.value.barId ?? ''}:${dropHint.value.index}:${dropHint.value.edge ?? ''}:${dropHint.value.mode ?? ''}`
      : null,
  (next, prev) => {
    if (!drag.value || !next || next === prev) return
    haptics.tick()
  },
)

function itemDropHintFromBar(
  bar: HTMLElement,
  clientX: number,
  dragItemId: string,
): {
  sectionId: string
  barId: string
  index: number
  edge?: 'before' | 'after'
  overItemId?: string
  mode?: 'insert' | 'swap'
} {
  const sectionId = bar.dataset.sectionId!
  const barId = bar.dataset.barId!
  const chips = [...bar.querySelectorAll<HTMLElement>('[data-drop-item]')].filter(
    (c) => c.dataset.itemId && c.dataset.itemId !== dragItemId,
  )
  if (!chips.length) {
    return { sectionId, barId, index: 0, mode: 'insert' }
  }

  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i]!
    const rect = chip.getBoundingClientRect()
    const next = chips[i + 1]
    const zoneRight = next
      ? (rect.right + next.getBoundingClientRect().left) / 2
      : rect.right + 48
    if (clientX > zoneRight) continue

    const itemIndex = Number(chip.dataset.itemIndex ?? 0)
    const overItemId = chip.dataset.itemId!

    if (clientX < rect.left) {
      return {
        sectionId,
        barId,
        index: itemIndex,
        edge: 'before',
        overItemId,
        mode: 'insert',
      }
    }
    if (clientX > rect.right) {
      return {
        sectionId,
        barId,
        index: itemIndex + 1,
        edge: 'after',
        overItemId,
        mode: 'insert',
      }
    }

    const rel = clientX - rect.left
    const w = rect.width
    if (rel < w * 0.2) {
      return {
        sectionId,
        barId,
        index: itemIndex,
        edge: 'before',
        overItemId,
        mode: 'insert',
      }
    }
    if (rel > w * 0.8) {
      return {
        sectionId,
        barId,
        index: itemIndex + 1,
        edge: 'after',
        overItemId,
        mode: 'insert',
      }
    }
    return {
      sectionId,
      barId,
      index: itemIndex,
      overItemId,
      mode: 'swap',
    }
  }

  const last = chips[chips.length - 1]!
  return {
    sectionId,
    barId,
    index: Number(last.dataset.itemIndex ?? 0) + 1,
    edge: 'after',
    overItemId: last.dataset.itemId,
    mode: 'insert',
  }
}

function onPointerMove(e: PointerEvent) {
  if (!drag.value) return
  const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
  if (!target) return

  if (drag.value.kind === 'item') {
    const bar = target.closest('[data-drop-bar]') as HTMLElement | null
    if (!bar || !drag.value.itemId) return
    dropHint.value = itemDropHintFromBar(bar, e.clientX, drag.value.itemId)
  } else {
    const bar = target.closest('[data-drop-bar]') as HTMLElement | null
    if (!bar) return
    // Не целимся в сам перетаскиваемый такт — иначе линия «мигает» на нём
    if (bar.dataset.barId === drag.value.barId) return
    dropHint.value = barDropHintFromBar(bar, e.clientX)
  }
}

function onPointerUp() {
  clearLongPress()
  let moved = false
  if (drag.value && dropHint.value) {
    if (drag.value.kind === 'item' && dropHint.value.barId && drag.value.itemId) {
      const fromPath = {
        sectionId: drag.value.sectionId,
        barId: drag.value.barId,
        itemId: drag.value.itemId,
      }
      if (
        dropHint.value.mode === 'swap' &&
        dropHint.value.overItemId &&
        dropHint.value.overItemId !== drag.value.itemId
      ) {
        const toPath = {
          sectionId: dropHint.value.sectionId,
          barId: dropHint.value.barId,
          itemId: dropHint.value.overItemId,
        }
        const next = swapItems(currentChart(), fromPath, toPath)
        commit(next)
        const bar = next.sections
          .find((s) => s.id === toPath.sectionId)
          ?.bars.find((b) => b.id === toPath.barId)
        const newIdx = bar?.items.findIndex((i) => i.id === fromPath.itemId) ?? -1
        selected.value = {
          sectionId: toPath.sectionId,
          barId: toPath.barId,
          insertIndex: newIdx >= 0 ? newIdx + 1 : dropHint.value.index,
        }
        moved = true
      } else if (dropHint.value.mode !== 'swap') {
        const sameBar =
          drag.value.sectionId === dropHint.value.sectionId &&
          drag.value.barId === dropHint.value.barId
        const fromBar = currentChart()
          .sections.find((s) => s.id === drag.value!.sectionId)
          ?.bars.find((b) => b.id === drag.value!.barId)
        const fromIdx = fromBar?.items.findIndex((i) => i.id === drag.value!.itemId) ?? -1
        const unchanged =
          sameBar && (fromIdx === dropHint.value.index || fromIdx + 1 === dropHint.value.index)
        if (!unchanged) {
          commit(
            moveItem(currentChart(), fromPath, {
              sectionId: dropHint.value.sectionId,
              barId: dropHint.value.barId,
              index: dropHint.value.index,
            }),
          )
          selected.value = {
            sectionId: dropHint.value.sectionId,
            barId: dropHint.value.barId,
            insertIndex: dropHint.value.index + 1,
          }
          moved = true
        }
      }
    } else if (drag.value.kind === 'bar') {
      const fromIdx =
        currentChart()
          .sections.find((s) => s.id === drag.value!.sectionId)
          ?.bars.findIndex((b) => b.id === drag.value!.barId) ?? -1
      const sameSection = drag.value.sectionId === dropHint.value.sectionId
      const unchanged =
        sameSection &&
        fromIdx >= 0 &&
        (fromIdx === dropHint.value.index || fromIdx + 1 === dropHint.value.index)
      if (!unchanged && fromIdx >= 0) {
        commit(
          moveBar(
            currentChart(),
            { sectionId: drag.value.sectionId, barId: drag.value.barId },
            { sectionId: dropHint.value.sectionId, index: dropHint.value.index },
          ),
        )
        moved = true
      }
    }
  }
  if (moved) haptics.drop()
  drag.value = null
  dropHint.value = null
}

function onKeydown(e: KeyboardEvent) {
  const meta = e.metaKey || e.ctrlKey
  if (e.key === 'Escape' && typeMenu.value) {
    e.preventDefault()
    closeTypeMenu()
    return
  }
  if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  } else if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault()
    redo()
  } else if ((e.key === 'Backspace' || e.key === 'Delete') && selected.value) {
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
    e.preventDefault()
    if (selected.value.itemId) {
      onRemoveItem(selected.value.sectionId, selected.value.barId, selected.value.itemId)
    } else {
      onRemoveBar(selected.value.sectionId, selected.value.barId)
    }
  }
}

function isInsertActive(sectionId: string, barId: string, index: number) {
  return (
    keyboardOpen.value &&
    selected.value?.sectionId === sectionId &&
    selected.value?.barId === barId &&
    selected.value.insertIndex === index
  )
}

function isItemSelected(itemId: string) {
  return selected.value?.itemId === itemId
}

function isBarSelected(sectionId: string, barId: string) {
  return selected.value?.sectionId === sectionId && selected.value?.barId === barId
}

function isDropOnItem(itemId: string, edge: 'before' | 'after') {
  return (
    dropHint.value?.mode === 'insert' &&
    dropHint.value.overItemId === itemId &&
    dropHint.value.edge === edge
  )
}

function isDropSwap(itemId: string) {
  return dropHint.value?.mode === 'swap' && dropHint.value.overItemId === itemId
}

function isBarDropEdge(barId: string, edge: 'before' | 'after') {
  return (
    drag.value?.kind === 'bar' &&
    dropHint.value?.mode === 'insert' &&
    dropHint.value.barId === barId &&
    dropHint.value.edge === edge
  )
}

watch(keyboardOpen, (open) => {
  if (!open) return
  void nextTick(() => revealSelection({ force: true }))
})

watch(
  selected,
  () => {
    if (!keyboardOpen.value) return
    void nextTick(() => revealSelection({ force: true }))
  },
  { deep: true },
)

onMounted(() => {
  if (!props.modelValue && !props.legacyChords?.trim()) {
    ensureChart()
  } else if (props.modelValue) {
    draftChart.value = props.modelValue
  }
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onTypeMenuPointerDown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onTypeMenuPointerDown, true)
  clearLongPress()
  document.documentElement.style.setProperty('--chart-kb-inset', '0px')
})
</script>

<template>
  <div
    class="chart-editor"
    :class="{
      'chart-editor--kb-open': keyboardOpen,
      'chart-editor--dragging': Boolean(drag),
      'chart-editor--dragging-bar': drag?.kind === 'bar',
    }"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div v-if="showConvert || showReconvert" class="chart-editor__banner">
      <p>{{ showConvert ? t('chart.convertAsk') : t('chart.reconvertAsk') }}</p>
      <button type="button" class="chart-editor__banner-btn" @click="convertLegacy">
        {{ showConvert ? t('chart.convert') : t('chart.reconvert') }}
      </button>
    </div>

    <div class="chart-editor__chrome">
      <Select
        :model-value="chart.timeSignature"
        :options="timeSignatureOptions"
        option-label="label"
        option-value="value"
        class="chart-editor__ts"
        @update:model-value="setTimeSignature($event as TimeSignature)"
      />

      <div v-if="bpm != null" class="chart-editor__bpm">
        <InputNumber
          :model-value="bpm"
          :min="30"
          :max="300"
          :use-grouping="false"
          :min-fraction-digits="0"
          :max-fraction-digits="0"
          inputmode="numeric"
          :aria-label="t('song.fieldBpm')"
          class="chart-editor__bpm-input"
          @update:model-value="onBpmInput($event as number | null)"
        />
        <span class="chart-editor__bpm-suffix" aria-hidden="true">{{ t('song.bpmUnit') }}</span>
      </div>

      <div class="chart-editor__history">
        <button type="button" :disabled="!canUndo" :aria-label="t('chart.undo')" @click="undo">
          <AppIcon :name="icons.undo" size="1rem" />
        </button>
        <button type="button" :disabled="!canRedo" :aria-label="t('chart.redo')" @click="redo">
          <AppIcon :name="icons.redo" size="1rem" />
        </button>
      </div>
    </div>

    <div class="chart-editor__add-sections">
      <button
        v-for="type in pickableSectionTypes"
        :key="type"
        type="button"
        class="chart-editor__add-pill"
        @click="onAddSection(type)"
      >
        + {{ t(`chart.section.${type}`) }}
      </button>
    </div>

    <div class="chart-editor__score">
      <div v-if="!chart.sections.length" class="chart-editor__empty">
        <p class="chart-editor__empty-text">{{ t('chart.emptySections') }}</p>
        <button
          type="button"
          class="chart-editor__empty-btn"
          @click="onAddSection('verse')"
        >
          {{ t('common.create') }}
        </button>
      </div>
      <section
        v-for="section in chart.sections"
        :key="section.id"
        class="chart-section"
        :style="{
          '--section-wash': SECTION_COLOR_VAR[section.type] ?? SECTION_COLOR_VAR.custom,
          '--section-accent': SECTION_ACCENT_VAR[section.type] ?? SECTION_ACCENT_VAR.custom,
        }"
      >
        <button
          type="button"
          class="chart-section__trash"
          :aria-label="t('chart.deleteSection')"
          @click="onRemoveSection(section.id)"
        >
          <AppIcon :name="icons.trash" size="0.85rem" />
        </button>

        <header class="chart-section__head">
          <button
            type="button"
            class="chart-section__badge"
            :aria-label="t('chart.sectionTypeAria', { title: autoSectionTitle(section.id) })"
            aria-haspopup="menu"
            @click="toggleTypeMenu($event, section.id)"
          >
            <span class="chart-section__dot" aria-hidden="true" />
            <span>{{ autoSectionTitle(section.id) }}</span>
          </button>
        </header>

        <button
          v-if="sectionShowsEmptyCta(section.id)"
          type="button"
          class="chart-bar-add chart-bar-add--first"
          @click="startFirstBar(section.id)"
        >
          {{ t('chart.addFirstBar') }}
        </button>

        <div v-else class="chart-section__flow">
          <div
            v-for="(bar, barIndex) in section.bars"
            :key="bar.id"
            class="chart-bar"
            :class="{
              'chart-bar--selected': isBarSelected(section.id, bar.id),
              'chart-bar--empty': !bar.items.length,
              'chart-bar--dragging': drag?.kind === 'bar' && drag.barId === bar.id,
              'chart-bar--drop-before': isBarDropEdge(bar.id, 'before'),
              'chart-bar--drop-after': isBarDropEdge(bar.id, 'after'),
            }"
            data-drop-bar
            :data-section-id="section.id"
            :data-bar-id="bar.id"
            :data-bar-index="barIndex"
            :data-item-count="bar.items.length"
            @click="selectBar(section.id, bar.id, bar.items.length)"
          >
            <button
              type="button"
              class="chart-bar__grip"
              :aria-label="t('chart.moveBar')"
              @pointerdown.stop="startBarDrag(section.id, bar.id, $event)"
              @click.stop
            >
              <AppIcon :name="icons.grip" size="0.9rem" />
            </button>

            <span class="chart-bar__pipe" aria-hidden="true">|</span>

            <div class="chart-bar__items" :class="{ 'chart-bar__items--dragging': drag?.kind === 'item' }">
              <button
                v-if="!bar.items.length"
                type="button"
                class="chart-insert"
                :class="{
                  'chart-insert--on': isInsertActive(section.id, bar.id, 0),
                }"
                data-insert-slot
                :data-bar-id="bar.id"
                data-index="0"
                :aria-label="t('chart.addChord')"
                @click.stop="selectInsert(section.id, bar.id, 0)"
              >
                +
              </button>

              <template v-for="(item, itemIndex) in bar.items" :key="item.id">
                <button
                  type="button"
                  class="chart-chip"
                  :class="[
                    item.kind === 'annotation' ? 'chart-chip--note' : 'chart-chip--chord',
                    {
                      'chart-chip--selected': isItemSelected(item.id),
                      'chart-chip--dragging':
                        drag?.kind === 'item' && drag.itemId === item.id,
                      'chart-chip--drop-before': isDropOnItem(item.id, 'before'),
                      'chart-chip--drop-after': isDropOnItem(item.id, 'after'),
                      'chart-chip--drop-swap': isDropSwap(item.id),
                    },
                  ]"
                  data-drop-item
                  :data-item-id="item.id"
                  :data-section-id="section.id"
                  :data-bar-id="bar.id"
                  :data-item-index="itemIndex"
                  @pointerdown.stop="startItemDrag(section.id, bar.id, item.id, $event)"
                  @click.stop="selectItem(section.id, bar.id, item.id, itemIndex)"
                >
                  <template v-if="item.kind === 'chord'">
                    {{ item.symbol }}
                    <small v-if="item.duration">{{ item.duration.beats }}</small>
                  </template>
                  <template v-else>{{ item.text }}</template>
                </button>

                <button
                  type="button"
                  class="chart-insert"
                  :class="{
                    'chart-insert--on': isInsertActive(section.id, bar.id, itemIndex + 1),
                  }"
                  data-insert-slot
                  :data-bar-id="bar.id"
                  :data-index="itemIndex + 1"
                  :aria-label="t('chart.insertHere')"
                  @click.stop="selectInsert(section.id, bar.id, itemIndex + 1)"
                >
                  +
                </button>
              </template>
            </div>

            <button
              v-if="isBarSelected(section.id, bar.id)"
              type="button"
              class="chart-bar__trash"
              :aria-label="t('chart.deleteBar')"
              @click.stop="onRemoveBar(section.id, bar.id)"
            >
              <AppIcon :name="icons.trash" size="0.85rem" />
            </button>

            <div
              v-if="barMenuId === bar.id"
              class="chart-bar__menu"
              @click.stop
            >
              <button type="button" @click="selectInsert(section.id, bar.id, bar.items.length)">
                {{ t('chart.addChordShort') }}
              </button>
              <button type="button" @click="onClearBar(section.id, bar.id); barMenuId = null">
                {{ t('chart.clearBar') }}
              </button>
              <button
                v-if="barIndex < section.bars.length - 1"
                type="button"
                @click="onMergeWithNext(section.id, bar.id); barMenuId = null"
              >
                {{ t('chart.mergeBars') }}
              </button>
              <button
                type="button"
                class="chart-bar__menu-danger"
                @click="onRemoveBar(section.id, bar.id); barMenuId = null"
              >
                {{ t('common.delete') }}
              </button>
            </div>
          </div>

          <button
            type="button"
            class="chart-bar-add"
            :aria-label="t('chart.addBar')"
            @click="onAddBar(section.id, section.bars[section.bars.length - 1]?.id)"
          >
            {{ t('chart.addBarShort') }}
          </button>
        </div>
      </section>
    </div>

    <ChordKeyboard
      :open="keyboardOpen"
      @close="closeChrome"
      @chord="onChord"
      @annotation="onAnnotation"
      @next-bar="onNextBar"
    />

    <Teleport to="body">
      <div
        v-if="typeMenu"
        class="chart-type-menu"
        role="menu"
        :aria-label="t('chart.sectionTypeMenu')"
        :style="{ top: `${typeMenu.top}px`, left: `${typeMenu.left}px` }"
      >
        <button
          v-for="opt in sectionTypeOptions"
          :key="opt.value"
          type="button"
          class="chart-type-menu__item"
          :class="{ 'chart-type-menu__item--on': typeMenuCurrentType === opt.value }"
          :style="{
            '--type-accent': SECTION_ACCENT_VAR[opt.value] ?? SECTION_ACCENT_VAR.custom,
          }"
          role="menuitemradio"
          :aria-checked="typeMenuCurrentType === opt.value"
          @click="pickSectionType(opt.value)"
        >
          <span class="chart-type-menu__dot" aria-hidden="true" />
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.chart-editor {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.chart-editor--kb-open {
  /* Только ChordDock — viewport/OS KB не поднимаем */
  padding-bottom: calc(var(--chart-kb-inset, 0px) + var(--app-space-3));
}

.chart-editor__banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border-radius: var(--app-radius-lg);
  background: var(--app-accent-muted);
}

.chart-editor__banner p {
  margin: 0;
  font-size: var(--app-text-sm);
  font-weight: 600;
}

.chart-editor__banner-btn {
  flex-shrink: 0;
  min-height: 2rem;
  padding: 0 0.75rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 700;
  cursor: pointer;
}

.chart-editor__chrome {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}

.chart-editor__ts {
  width: 5.25rem;
  min-width: 5.25rem;
}

.chart-editor__bpm {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 0;
  height: 2.875rem;
  border-radius: var(--app-radius);
  border: 1px solid var(--app-border);
  background: var(--app-bg);
  overflow: hidden;
}

.chart-editor__bpm-input {
  width: 4.75rem;
}

.chart-editor__bpm-input :deep(.p-inputnumber),
.chart-editor__bpm-input :deep(.p-inputnumber-input) {
  width: 100%;
  min-height: 100%;
  height: 2.875rem;
}

.chart-editor__bpm-input :deep(.p-inputnumber-input) {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 2.15rem 0 0.55rem !important;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.chart-editor__bpm-suffix {
  position: absolute;
  right: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 0.65rem;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-muted);
  opacity: 0.75;
}

.chart-editor__history {
  margin-left: auto;
  display: inline-flex;
  gap: 0.2rem;
}

.chart-editor__history button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-ink);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.chart-editor__history button:disabled {
  opacity: 0.3;
  cursor: default;
}

.chart-editor__score {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
  /* Room for trash sitting on the outer card corner */
  padding: 0.4rem 0.5rem 0.1rem 0;
  overflow: visible;
}

.chart-editor__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  margin: 0;
  padding: var(--app-space-3) 0.15rem;
  text-align: center;
}

.chart-editor__empty-text {
  margin: 0;
  font-size: var(--app-text-sm);
  font-weight: 550;
  color: var(--app-muted);
}

.chart-editor__empty-btn {
  min-height: 1.75rem;
  padding: 0 0.65rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-accent-text);
  font: inherit;
  font-size: var(--app-text-2xs);
  font-weight: 750;
  cursor: pointer;
}

.chart-editor__empty-btn:active {
  background: var(--app-press);
}

.chart-section {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.5rem 0.75rem 0.55rem;
  border-radius: var(--app-radius-lg);
  border-left: 3px solid var(--section-accent);
  background: var(--section-wash);
  overflow: visible;
}

.chart-section__head {
  display: flex;
  align-items: center;
  min-height: 1.4rem;
}

.chart-section__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 100%;
  min-height: 1.4rem;
  padding: 0.12rem 0.55rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: color-mix(in srgb, var(--section-accent) 16%, transparent);
  color: var(--app-ink);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
  cursor: pointer;
}

.chart-section__badge:hover {
  background: color-mix(in srgb, var(--section-accent) 24%, transparent);
}

.chart-section__dot {
  width: 0.4rem;
  height: 0.4rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--section-accent);
}

.chart-section__trash {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.55rem;
  height: 1.55rem;
  border: 0;
  border-radius: 999px;
  background: var(--app-surface);
  color: var(--app-danger);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--app-danger) 35%, transparent),
    var(--app-shadow-soft);
  transform: translate(35%, -35%);
  cursor: pointer;
}

.chart-section__trash:hover {
  background: color-mix(in srgb, var(--app-danger) 14%, var(--app-surface));
}

.chart-section__flow {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  column-gap: 0.15rem;
  row-gap: 0.45rem;
}

.chart-bar {
  position: relative;
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.1rem;
  max-width: 100%;
  padding: 0.1rem 0.15rem;
  border-radius: var(--app-radius-sm);
  cursor: pointer;
  transition: background-color var(--app-duration) var(--app-ease);
}

.chart-bar--selected {
  background: color-mix(in srgb, var(--app-accent) 10%, transparent);
}

.chart-bar--dragging {
  opacity: 0.4;
}

.chart-bar--drop-before,
.chart-bar--drop-after {
  position: relative;
  z-index: 1;
}

.chart-bar--drop-before::before,
.chart-bar--drop-after::after {
  content: '';
  position: absolute;
  top: 0.1rem;
  bottom: 0.1rem;
  width: 3px;
  border-radius: 999px;
  background: var(--app-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 28%, transparent);
  pointer-events: none;
}

.chart-bar--drop-before::before {
  left: -0.2rem;
}

.chart-bar--drop-after::after {
  right: -0.2rem;
}

.chart-bar__grip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.75rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-faint);
  cursor: grab;
  touch-action: none;
  opacity: 0;
  transition: opacity var(--app-duration) var(--app-ease);
}

.chart-bar--selected .chart-bar__grip,
.chart-bar:hover .chart-bar__grip,
.chart-editor--dragging-bar .chart-bar__grip {
  opacity: 1;
}

.chart-bar__trash {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.45rem;
  height: 1.45rem;
  margin-left: 0.1rem;
  padding: 0;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-muted);
  cursor: pointer;
}

.chart-bar__trash:hover {
  background: color-mix(in srgb, var(--app-danger) 14%, var(--app-surface));
  color: var(--app-danger);
}

.chart-bar__pipe {
  color: var(--app-faint);
  font-weight: 600;
  font-size: var(--app-text-sm);
  user-select: none;
}

.chart-bar__items {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem;
}

/* Во время DnD плюсы не цели — приглушаем и клики сквозь к чипам */
.chart-bar__items--dragging .chart-insert {
  opacity: 0.2;
  pointer-events: none;
}

.chart-insert {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--app-faint);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  opacity: 0.55;
  transition:
    opacity var(--app-duration) var(--app-ease),
    background-color var(--app-duration) var(--app-ease),
    color var(--app-duration) var(--app-ease);
}

.chart-bar:hover .chart-insert,
.chart-bar--selected .chart-insert {
  opacity: 1;
}

.chart-insert--on {
  opacity: 1;
  background: var(--app-accent);
  color: var(--app-accent-contrast);
}

.chart-bar__menu {
  position: absolute;
  left: 0;
  top: calc(100% + 0.25rem);
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-width: 11rem;
  padding: 0.35rem;
  border-radius: var(--app-radius);
  background: var(--app-surface);
  box-shadow: var(--app-shadow-soft);
}

.chart-bar__menu button {
  min-height: 1.65rem;
  padding: 0 0.5rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-ink);
  font: inherit;
  font-size: var(--app-text-2xs);
  font-weight: 650;
  cursor: pointer;
}

.chart-bar__menu-danger {
  color: var(--app-destructive) !important;
}

.chart-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  min-height: 1.85rem;
  padding: 0 0.5rem;
  border: 0;
  border-radius: var(--app-radius-sm);
  font: inherit;
  font-size: var(--app-text-md);
  font-weight: 750;
  letter-spacing: -0.02em;
  cursor: pointer;
  touch-action: none;
  transition:
    transform var(--app-duration) var(--app-ease),
    box-shadow var(--app-duration) var(--app-ease),
    background-color var(--app-duration) var(--app-ease);
}

.chart-chip--chord {
  background: var(--app-surface);
  color: var(--app-ink);
  box-shadow: 0 0 0 1px var(--app-border);
}

.chart-chip--note {
  background: var(--chart-annotation-bg);
  color: var(--chart-annotation-ink);
  font-size: var(--app-text-sm);
}

.chart-chip--selected {
  box-shadow: 0 0 0 2px var(--app-accent);
}

.chart-chip--dragging {
  opacity: 0.45;
  transform: scale(0.96);
}

.chart-chip--drop-before,
.chart-chip--drop-after {
  position: relative;
  z-index: 1;
}

.chart-chip--drop-before::before,
.chart-chip--drop-after::after {
  content: '';
  position: absolute;
  top: 0.15rem;
  bottom: 0.15rem;
  width: 3px;
  border-radius: 999px;
  background: var(--app-accent);
  pointer-events: none;
}

.chart-chip--drop-before::before {
  left: -0.2rem;
}

.chart-chip--drop-after::after {
  right: -0.2rem;
}

.chart-chip--drop-swap {
  z-index: 1;
  box-shadow: 0 0 0 2px var(--app-accent);
  background: color-mix(in srgb, var(--app-accent) 14%, transparent);
}

.chart-chip small {
  font-size: 0.65em;
  opacity: 0.55;
  font-weight: 700;
}

.chart-bar-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.7rem;
  margin-left: 0.2rem;
  padding: 0 0.55rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-accent-text);
  font: inherit;
  font-size: var(--app-text-2xs);
  font-weight: 750;
  cursor: pointer;
}

.chart-bar-add--first {
  display: flex;
  width: 100%;
  margin-left: 0;
  min-height: 2rem;
  padding: 0 0.75rem;
  border-radius: var(--app-radius);
  font-size: var(--app-text-xs);
}

.chart-editor__add-sections {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.1rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
}

.chart-editor__add-sections::-webkit-scrollbar {
  display: none;
}

.chart-editor__add-pill {
  flex-shrink: 0;
  min-height: 2rem;
  padding: 0 0.7rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
  color: var(--app-muted);
  font: inherit;
  font-size: var(--app-text-xs);
  font-weight: 700;
  cursor: pointer;
}

</style>

<style>
.chart-type-menu {
  position: fixed;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  width: min(10.5rem, calc(100vw - 1rem));
  padding: 0.3rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-surface);
  color: var(--app-ink);
  box-shadow: var(--app-shadow-soft);
}

.chart-type-menu__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 2.1rem;
  padding: 0.35rem 0.55rem;
  border: 0;
  border-radius: var(--app-radius);
  background: transparent;
  color: var(--app-ink);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.chart-type-menu__item:hover,
.chart-type-menu__item:active {
  background: var(--app-hover);
}

.chart-type-menu__item--on {
  background: color-mix(in srgb, var(--type-accent, var(--app-accent)) 14%, transparent);
}

.chart-type-menu__dot {
  width: 0.45rem;
  height: 0.45rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--type-accent, var(--app-accent));
}
</style>
