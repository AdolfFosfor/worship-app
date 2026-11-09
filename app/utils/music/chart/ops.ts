import type {
  BarItem,
  ChartBar,
  ChartSection,
  ChordChart,
  SectionType,
} from '~~/shared/types'
import { cloneChart, createBar, createSection } from './factory'

export type ItemPath = { sectionId: string; barId: string; itemId: string }
export type BarPath = { sectionId: string; barId: string }
export type InsertTarget =
  | { sectionId: string; barId: string; index: number }
  | { sectionId: string; barId: string; atEnd: true }

function findSection(chart: ChordChart, sectionId: string): ChartSection | null {
  return chart.sections.find((s) => s.id === sectionId) ?? null
}

function findBar(section: ChartSection, barId: string): ChartBar | null {
  return section.bars.find((b) => b.id === barId) ?? null
}

export function withChart(chart: ChordChart, mutate: (draft: ChordChart) => void): ChordChart {
  const draft = cloneChart(chart)
  mutate(draft)
  return draft
}

export function addSection(
  chart: ChordChart,
  type: SectionType,
  title?: string,
): ChordChart {
  return withChart(chart, (d) => {
    d.sections.push(createSection(type, title))
  })
}

export function removeSection(chart: ChordChart, sectionId: string): ChordChart {
  return withChart(chart, (d) => {
    d.sections = d.sections.filter((s) => s.id !== sectionId)
  })
}

export function updateSection(
  chart: ChordChart,
  sectionId: string,
  patch: Partial<Pick<ChartSection, 'type' | 'title'>>,
): ChordChart {
  return withChart(chart, (d) => {
    const s = findSection(d, sectionId)
    if (!s) return
    if (patch.type !== undefined) {
      s.type = patch.type
      // Titles are auto-generated from type — drop custom label on retype.
      if (patch.title === undefined) delete s.title
    }
    if (patch.title !== undefined) {
      if (patch.title) s.title = patch.title
      else delete s.title
    }
  })
}

export function addBar(chart: ChordChart, sectionId: string, afterBarId?: string): ChordChart {
  return withChart(chart, (d) => {
    const s = findSection(d, sectionId)
    if (!s) return
    const bar = createBar()
    if (!afterBarId) {
      s.bars.push(bar)
      return
    }
    const idx = s.bars.findIndex((b) => b.id === afterBarId)
    if (idx < 0) s.bars.push(bar)
    else s.bars.splice(idx + 1, 0, bar)
  })
}

export function removeBar(chart: ChordChart, sectionId: string, barId: string): ChordChart {
  return withChart(chart, (d) => {
    const s = findSection(d, sectionId)
    if (!s) return
    s.bars = s.bars.filter((b) => b.id !== barId)
    if (!s.bars.length) s.bars.push(createBar())
  })
}

export function clearBar(chart: ChordChart, sectionId: string, barId: string): ChordChart {
  return withChart(chart, (d) => {
    const s = findSection(d, sectionId)
    const b = s ? findBar(s, barId) : null
    if (b) b.items = []
  })
}

export function mergeBars(
  chart: ChordChart,
  sectionId: string,
  leftBarId: string,
  rightBarId: string,
): ChordChart {
  return withChart(chart, (d) => {
    const s = findSection(d, sectionId)
    if (!s) return
    const leftIdx = s.bars.findIndex((b) => b.id === leftBarId)
    const rightIdx = s.bars.findIndex((b) => b.id === rightBarId)
    if (leftIdx < 0 || rightIdx < 0 || leftIdx === rightIdx) return
    const [a, b] = leftIdx < rightIdx ? [leftIdx, rightIdx] : [rightIdx, leftIdx]
    s.bars[a]!.items = [...s.bars[a]!.items, ...s.bars[b]!.items]
    s.bars.splice(b, 1)
  })
}

export function insertItem(
  chart: ChordChart,
  sectionId: string,
  barId: string,
  item: BarItem,
  index?: number,
): ChordChart {
  return withChart(chart, (d) => {
    const s = findSection(d, sectionId)
    const b = s ? findBar(s, barId) : null
    if (!b) return
    if (index == null || index < 0 || index >= b.items.length) b.items.push(item)
    else b.items.splice(index, 0, item)
  })
}

export function removeItem(
  chart: ChordChart,
  sectionId: string,
  barId: string,
  itemId: string,
): ChordChart {
  return withChart(chart, (d) => {
    const s = findSection(d, sectionId)
    const b = s ? findBar(s, barId) : null
    if (!b) return
    b.items = b.items.filter((i) => i.id !== itemId)
  })
}

export function setChordDuration(
  chart: ChordChart,
  sectionId: string,
  barId: string,
  itemId: string,
  beats: number | null,
): ChordChart {
  return withChart(chart, (d) => {
    const s = findSection(d, sectionId)
    const b = s ? findBar(s, barId) : null
    const item = b?.items.find((i) => i.id === itemId)
    if (!item || item.kind !== 'chord') return
    if (beats == null || beats <= 0) delete item.duration
    else item.duration = { beats }
  })
}

export function moveItem(
  chart: ChordChart,
  from: ItemPath,
  to: { sectionId: string; barId: string; index: number },
): ChordChart {
  return withChart(chart, (d) => {
    const fromSec = findSection(d, from.sectionId)
    const fromBar = fromSec ? findBar(fromSec, from.barId) : null
    if (!fromBar) return
    const itemIdx = fromBar.items.findIndex((i) => i.id === from.itemId)
    if (itemIdx < 0) return
    const [item] = fromBar.items.splice(itemIdx, 1)
    if (!item) return

    const toSec = findSection(d, to.sectionId)
    const toBar = toSec ? findBar(toSec, to.barId) : null
    if (!toBar) {
      fromBar.items.splice(itemIdx, 0, item)
      return
    }

    let insertAt = Math.max(0, Math.min(to.index, toBar.items.length))
    if (from.barId === to.barId && from.sectionId === to.sectionId && itemIdx < insertAt) {
      insertAt -= 1
    }
    toBar.items.splice(insertAt, 0, item)
  })
}

export function swapItems(chart: ChordChart, a: ItemPath, b: ItemPath): ChordChart {
  if (a.itemId === b.itemId) return chart
  return withChart(chart, (d) => {
    const secA = findSection(d, a.sectionId)
    const secB = findSection(d, b.sectionId)
    const barA = secA ? findBar(secA, a.barId) : null
    const barB = secB ? findBar(secB, b.barId) : null
    if (!barA || !barB) return
    const idxA = barA.items.findIndex((i) => i.id === a.itemId)
    const idxB = barB.items.findIndex((i) => i.id === b.itemId)
    if (idxA < 0 || idxB < 0) return
    const itemA = barA.items[idxA]!
    const itemB = barB.items[idxB]!
    barA.items[idxA] = itemB
    barB.items[idxB] = itemA
  })
}

export function moveBar(
  chart: ChordChart,
  from: BarPath,
  to: { sectionId: string; index: number },
): ChordChart {
  return withChart(chart, (d) => {
    const fromSec = findSection(d, from.sectionId)
    if (!fromSec) return
    const fromIdx = fromSec.bars.findIndex((b) => b.id === from.barId)
    if (fromIdx < 0) return
    const [bar] = fromSec.bars.splice(fromIdx, 1)
    if (!bar) return
    if (!fromSec.bars.length) fromSec.bars.push(createBar())

    const toSec = findSection(d, to.sectionId)
    if (!toSec) {
      fromSec.bars.splice(fromIdx, 0, bar)
      return
    }
    let insertAt = Math.max(0, Math.min(to.index, toSec.bars.length))
    if (from.sectionId === to.sectionId && fromIdx < insertAt) insertAt -= 1
    toSec.bars.splice(insertAt, 0, bar)
  })
}

/** Append chord to selection; auto-add bar when continuing at end of last bar if requested. */
export function appendChordToSelection(
  chart: ChordChart,
  selection: { sectionId: string; barId: string } | null,
  item: BarItem,
  opts?: { newBarIfLastFilled?: boolean },
): { chart: ChordChart; sectionId: string; barId: string } {
  let sectionId = selection?.sectionId
  let barId = selection?.barId

  if (!sectionId || !barId) {
    const lastSec = chart.sections[chart.sections.length - 1]
    const fallbackSec = lastSec ?? chart.sections[0]
    if (!fallbackSec) return { chart, sectionId: '', barId: '' }
    sectionId = fallbackSec.id
    barId = fallbackSec.bars[fallbackSec.bars.length - 1]?.id ?? fallbackSec.bars[0]?.id ?? ''
    if (!barId) return { chart, sectionId, barId: '' }
  }

  const section = chart.sections.find((s) => s.id === sectionId)
  const bar = section?.bars.find((b) => b.id === barId)
  const isLastBar =
    section && bar
      ? section.bars[section.bars.length - 1]?.id === bar.id
      : false

  // Auto-extend: if last bar already has chords and user taps "continue", optional.
  // Default: just append into selected bar (plan: do NOT create bar after every chord).
  void opts
  void isLastBar

  const next = insertItem(chart, sectionId, barId, item)
  return { chart: next, sectionId, barId }
}
