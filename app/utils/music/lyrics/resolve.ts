import type { ChordChart, SongLyricsDoc } from '~~/shared/types'

export interface ResolvedLyricAnchor {
  id: string
  itemId: string
  offset: number
  symbol: string
}

export interface ResolvedLyricLine {
  id: string
  text: string
  anchors: ResolvedLyricAnchor[]
}

export interface ResolvedLyricBlock {
  id: string
  type: SongLyricsDoc['blocks'][number]['type']
  title?: string
  chartSectionId: string | null
  lines: ResolvedLyricLine[]
}

function buildItemSymbolMap(chart: ChordChart | null | undefined): Map<string, string> {
  const map = new Map<string, string>()
  if (!chart) return map
  for (const section of chart.sections) {
    for (const bar of section.bars) {
      for (const item of bar.items) {
        if (item.kind === 'chord') map.set(item.id, item.symbol)
        else map.set(item.id, item.text)
      }
    }
  }
  return map
}

/** Resolve anchor itemIds → display symbols via (possibly transposed) chart. */
export function resolveLyricsDoc(
  doc: SongLyricsDoc | null | undefined,
  chart: ChordChart | null | undefined,
): ResolvedLyricBlock[] {
  if (!doc?.blocks.length) return []
  const symbols = buildItemSymbolMap(chart)
  return doc.blocks.map((block) => ({
    id: block.id,
    type: block.type,
    title: block.title,
    chartSectionId: block.chartSectionId,
    lines: block.lines.map((line) => ({
      id: line.id,
      text: line.text,
      anchors: line.anchors
        .map((a) => {
          const symbol = symbols.get(a.itemId)
          if (!symbol) return null
          return {
            id: a.id,
            itemId: a.itemId,
            offset: Math.min(Math.max(0, a.offset), line.text.length),
            symbol,
          }
        })
        .filter((a): a is ResolvedLyricAnchor => a != null),
    })),
  }))
}

/** Flat list of chord items (id+symbol) from a chart section, in bar order. */
export function sectionChordPalette(
  chart: ChordChart | null | undefined,
  sectionId: string | null,
): { id: string; symbol: string }[] {
  if (!chart || !sectionId) return []
  const section = chart.sections.find((s) => s.id === sectionId)
  if (!section) return []
  const out: { id: string; symbol: string }[] = []
  for (const bar of section.bars) {
    for (const item of bar.items) {
      if (item.kind === 'chord') out.push({ id: item.id, symbol: item.symbol })
    }
  }
  return out
}
