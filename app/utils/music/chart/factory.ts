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

export function createBar(items: BarItem[] = []): ChartBar {
  return { id: uid('bar'), items }
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
