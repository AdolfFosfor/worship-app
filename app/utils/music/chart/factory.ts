import type {
  AnnotationPreset,
  BarItem,
  ChartAnnotation,
  ChartBar,
  ChartChord,
  ChartSection,
  ChordChart,
  SectionType,
  TimeSignature,
} from '~~/shared/types'
import { SECTION_LABELS } from '~~/shared/types'

function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function createChord(symbol: string, duration?: ChartChord['duration']): ChartChord {
  return {
    id: uid('ch'),
    kind: 'chord',
    symbol,
    ...(duration ? { duration } : {}),
  }
}

export function createAnnotation(
  text: string,
  preset?: AnnotationPreset,
): ChartAnnotation {
  return {
    id: uid('an'),
    kind: 'annotation',
    text,
    ...(preset ? { preset } : {}),
  }
}

/** Копия чипа с новым id (Alt/Option+drag). */
export function cloneBarItem(item: BarItem): BarItem {
  if (item.kind === 'chord') return createChord(item.symbol, item.duration)
  return createAnnotation(item.text, item.preset)
}

export function createBar(items: BarItem[] = []): ChartBar {
  return { id: uid('bar'), items }
}

/** Копия такта с новыми id у такта и всех чипов. */
export function cloneBar(bar: ChartBar): ChartBar {
  return createBar(bar.items.map(cloneBarItem))
}

/** Копия секции с новыми id у секции, тактов и чипов. */
export function cloneSection(section: ChartSection): ChartSection {
  return {
    id: uid('sec'),
    type: section.type,
    ...(section.title ? { title: section.title } : {}),
    bars: section.bars.map(cloneBar),
  }
}

export function createSection(
  type: SectionType = 'verse',
  title?: string,
  bars?: ChartBar[],
): ChartSection {
  return {
    id: uid('sec'),
    type,
    title: title ?? (type === 'custom' ? SECTION_LABELS.custom : undefined),
    // `[]` means “start empty” (caller will push bars); omit → one blank bar
    bars: bars === undefined ? [createBar()] : bars,
  }
}

export function createEmptyChart(timeSignature: TimeSignature = '4/4'): ChordChart {
  return {
    v: 1,
    timeSignature,
    sections: [],
  }
}

/** Deep clone that works with Vue reactive proxies (structuredClone cannot). */
export function cloneChart(chart: ChordChart): ChordChart {
  return JSON.parse(JSON.stringify(chart)) as ChordChart
}

export function isChordChart(value: unknown): value is ChordChart {
  if (!value || typeof value !== 'object') return false
  const c = value as ChordChart
  return c.v === 1 && Array.isArray(c.sections) && typeof c.timeSignature === 'string'
}
