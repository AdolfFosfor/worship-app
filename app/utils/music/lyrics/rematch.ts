import type { ChordChart, SongLyricsDoc } from '~~/shared/types'

/**
 * Bind each lyrics block to the next unused chart section of the **same type**.
 * Never fall back to another type (outro must not steal Verse 1).
 */
export function rematchLyricChartSections(
  doc: SongLyricsDoc,
  chart: ChordChart | null | undefined,
): SongLyricsDoc {
  if (!chart?.sections.length) {
    return {
      ...doc,
      blocks: doc.blocks.map((b) => ({ ...b, chartSectionId: null })),
    }
  }

  const used = new Set<string>()
  const blocks = doc.blocks.map((block) => {
    const match = chart.sections.find((s) => s.type === block.type && !used.has(s.id))
    if (match) {
      used.add(match.id)
      return { ...block, chartSectionId: match.id }
    }
    return { ...block, chartSectionId: null }
  })
  return { ...doc, blocks }
}
