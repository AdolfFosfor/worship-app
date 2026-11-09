import type { ChordChart } from '~~/shared/types'
import { sectionAutoTitle } from './types'

/** Denormalize structured chart to plain text for legacy `chords` column. */
export function serializeChart(chart: ChordChart | null | undefined): string | null {
  if (!chart?.sections?.length) return null
  const lines: string[] = []

  for (const section of chart.sections) {
    lines.push(sectionAutoTitle(chart.sections, section.id))
    const barParts = section.bars.map((bar) => {
      if (!bar.items.length) return '|'
      return bar.items
        .map((item) => (item.kind === 'chord' ? item.symbol : item.text))
        .join(' ')
    })
    lines.push(barParts.join(' | '))
    lines.push('')
  }

  const text = lines.join('\n').trim()
  return text || null
}
