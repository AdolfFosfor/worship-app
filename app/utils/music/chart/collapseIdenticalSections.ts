import type { ChartSection, ChordChart } from '~~/shared/types'

/**
 * Fingerprint of bar structure + chord symbols.
 * Empty bars stay in the sequence so length/layout must match too.
 */
export function sectionChordFingerprint(section: ChartSection): string {
  return section.bars
    .map((bar) =>
      bar.items
        .filter((item) => item.kind === 'chord')
        .map((item) => (item.kind === 'chord' ? item.symbol : ''))
        .join(' '),
    )
    .join(' | ')
}

/**
 * On stage, omit a later section only when another section of the **same type**
 * already has the identical bar/chord sequence (Verse 2 = Verse 1, Chorus 3 = Chorus 1).
 * Intro ≠ Verse even if chords match.
 */
export function collapseIdenticalSections(sections: ChartSection[]): ChartSection[] {
  const seenByType = new Map<string, Set<string>>()
  const out: ChartSection[] = []
  for (const section of sections) {
    const fp = sectionChordFingerprint(section)
    if (fp.replace(/\s|\|/g, '').length === 0) {
      out.push(section)
      continue
    }
    let seen = seenByType.get(section.type)
    if (!seen) {
      seen = new Set()
      seenByType.set(section.type, seen)
    }
    if (seen.has(fp)) continue
    seen.add(fp)
    out.push(section)
  }
  return out
}

export function chartWithCollapsedSections(chart: ChordChart): ChordChart {
  return {
    ...chart,
    sections: collapseIdenticalSections(chart.sections),
  }
}
