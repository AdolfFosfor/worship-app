import type { ChartSection, ChordChart } from '~~/shared/types'

/** Fingerprint of chord symbols in a section (bars joined). */
export function sectionChordFingerprint(section: ChartSection): string {
  return section.bars
    .map((bar) =>
      bar.items
        .filter((item) => item.kind === 'chord')
        .map((item) => (item.kind === 'chord' ? item.symbol : ''))
        .join(' '),
    )
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' | ')
}

/**
 * Keep the first section for each unique chord sequence.
 * Identical repeats (Verse 2 = Verse 1, Chorus 3 = Chorus 1, …) are omitted on stage.
 */
export function collapseIdenticalSections(sections: ChartSection[]): ChartSection[] {
  const seen = new Set<string>()
  const out: ChartSection[] = []
  for (const section of sections) {
    const fp = sectionChordFingerprint(section)
    if (fp && seen.has(fp)) continue
    if (fp) seen.add(fp)
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
