import type { ChordChart } from '~~/shared/types'
import { transposeChordSymbol } from '~/utils/music/transpose'
import { cloneChart } from './factory'

/** Transpose chord symbols in a chart copy; structure unchanged. */
export function transposeChart(chart: ChordChart, semitones: number): ChordChart {
  if (!semitones) return chart
  const next = cloneChart(chart)
  for (const section of next.sections) {
    for (const bar of section.bars) {
      for (const item of bar.items) {
        if (item.kind === 'chord') {
          item.symbol = transposeChordSymbol(item.symbol, semitones)
        }
      }
    }
  }
  return next
}
