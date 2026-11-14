import type {
  ChordChart,
  LyricChordAnchor,
  LyricLine,
  SongLyricsDoc,
} from '~~/shared/types'
import { lyricUid } from './ids'
import { rematchLyricChartSections } from './rematch'

function clampOffset(text: string, offset: number): number {
  return Math.max(0, Math.min(text.length, Math.floor(offset)))
}

export function upsertAnchor(
  line: LyricLine,
  itemId: string,
  offset: number,
  anchorId?: string,
): LyricLine {
  const nextOffset = clampOffset(line.text, offset)
  const anchors = line.anchors.filter((a) => a.id !== anchorId && a.itemId !== itemId)
  const id = anchorId && line.anchors.some((a) => a.id === anchorId) ? anchorId : lyricUid('anc')
  anchors.push({ id, itemId, offset: nextOffset })
  anchors.sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id))
  return { ...line, anchors }
}

export function moveAnchor(line: LyricLine, anchorId: string, offset: number): LyricLine {
  const anchors = line.anchors.map((a) =>
    a.id === anchorId ? { ...a, offset: clampOffset(line.text, offset) } : a,
  )
  anchors.sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id))
  return { ...line, anchors }
}

export function removeAnchor(line: LyricLine, anchorId: string): LyricLine {
  return { ...line, anchors: line.anchors.filter((a) => a.id !== anchorId) }
}

/** Move an anchor to another line in the same block (keeps id + itemId). */
export function relocateAnchor(
  doc: SongLyricsDoc,
  blockId: string,
  fromLineId: string,
  toLineId: string,
  anchorId: string,
  offset: number,
): SongLyricsDoc {
  if (fromLineId === toLineId) {
    const block = doc.blocks.find((b) => b.id === blockId)
    const line = block?.lines.find((l) => l.id === fromLineId)
    if (!line) return doc
    return updateLineInDoc(doc, blockId, fromLineId, moveAnchor(line, anchorId, offset))
  }

  const block = doc.blocks.find((b) => b.id === blockId)
  if (!block) return doc
  const from = block.lines.find((l) => l.id === fromLineId)
  const to = block.lines.find((l) => l.id === toLineId)
  if (!from || !to) return doc
  const anchor = from.anchors.find((a) => a.id === anchorId)
  if (!anchor) return doc

  const nextFrom = removeAnchor(from, anchorId)
  const nextTo = upsertAnchor(to, anchor.itemId, offset, anchorId)

  return {
    ...doc,
    blocks: doc.blocks.map((b) => {
      if (b.id !== blockId) return b
      return {
        ...b,
        lines: b.lines.map((l) => {
          if (l.id === fromLineId) return nextFrom
          if (l.id === toLineId) return nextTo
          return l
        }),
      }
    }),
  }
}

function clearBlockAnchors(doc: SongLyricsDoc, blockId: string): SongLyricsDoc {
  return {
    ...doc,
    blocks: doc.blocks.map((b) =>
      b.id !== blockId
        ? b
        : { ...b, lines: b.lines.map((l) => ({ ...l, anchors: [] })) },
    ),
  }
}

/**
 * Auto-layout by bars: one bar → one lyric line when possible.
 * Fewer bars → split each bar's chords across its share of lines.
 * More bars → merge consecutive bars onto lines.
 */
export function autoPlaceBlock(
  doc: SongLyricsDoc,
  blockId: string,
  chart: ChordChart | null | undefined,
): SongLyricsDoc {
  const block = doc.blocks.find((b) => b.id === blockId)
  if (!block || !chart) return doc

  if (!block.chartSectionId) return clearBlockAnchors(doc, blockId)

  const section = chart.sections.find((s) => s.id === block.chartSectionId)
  if (!section) return clearBlockAnchors(doc, blockId)

  const bars = section.bars.map((bar) =>
    bar.items
      .filter((item) => item.kind === 'chord')
      .map((item) => ({ id: item.id, symbol: item.symbol })),
  )
  if (!bars.some((b) => b.length)) return clearBlockAnchors(doc, blockId)

  const targets = block.lines.filter((l) => l.text.trim().length > 0)
  if (!targets.length) return clearBlockAnchors(doc, blockId)

  const assigned = assignBarsToLines(bars, targets.length)
  const perLine = new Map<string, LyricChordAnchor[]>()
  for (let i = 0; i < targets.length; i++) {
    const line = targets[i]!
    perLine.set(line.id, placeSliceOnLine(line.text, assigned[i] ?? []))
  }

  const lines = block.lines.map((line) => ({
    ...line,
    anchors: perLine.get(line.id) ?? [],
  }))

  return {
    ...doc,
    blocks: doc.blocks.map((b) => (b.id === blockId ? { ...b, lines } : b)),
  }
}

/** Rematch sections by type, then auto-place every block. */
export function autoPlaceAllBlocks(
  doc: SongLyricsDoc,
  chart: ChordChart | null | undefined,
): SongLyricsDoc {
  if (!chart) return doc
  let next = rematchLyricChartSections(doc, chart)
  for (const block of next.blocks) {
    next = autoPlaceBlock(next, block.id, chart)
  }
  return next
}

type ChordRef = { id: string; symbol: string }

/**
 * Map bars onto lyric lines:
 * - same count → 1:1
 * - fewer bars → each bar covers a share of lines; chords inside the bar are split
 * - more bars → merge consecutive bars onto lines
 */
export function assignBarsToLines(bars: ChordRef[][], lineCount: number): ChordRef[][] {
  const out: ChordRef[][] = Array.from({ length: lineCount }, () => [])
  const nonEmpty = bars.filter((b) => b.length > 0)
  if (!nonEmpty.length || lineCount <= 0) return out

  if (nonEmpty.length === lineCount) {
    return nonEmpty.map((b) => [...b])
  }

  if (nonEmpty.length < lineCount) {
    // How many lyric lines each bar should cover
    const linesPerBar = chunkCounts(lineCount, nonEmpty.length)
    const expanded: ChordRef[][] = []
    for (let bi = 0; bi < nonEmpty.length; bi++) {
      const nLines = linesPerBar[bi] ?? 1
      const chords = nonEmpty[bi]!
      const chordParts = chunkCounts(chords.length, nLines)
      let cursor = 0
      for (let i = 0; i < nLines; i++) {
        const n = chordParts[i] ?? 0
        expanded.push(chords.slice(cursor, cursor + n))
        cursor += n
      }
    }
    for (let i = 0; i < lineCount; i++) out[i] = expanded[i] ?? []
    return out
  }

  // More bars than lines — pack consecutive bars
  const counts = chunkCounts(nonEmpty.length, lineCount)
  let cursor = 0
  for (let li = 0; li < lineCount; li++) {
    const n = counts[li] ?? 0
    out[li] = nonEmpty.slice(cursor, cursor + n).flat()
    cursor += n
  }
  return out
}

function chunkCounts(total: number, buckets: number): number[] {
  if (buckets <= 0) return []
  if (total <= 0) return Array.from({ length: buckets }, () => 0)
  const base = Math.floor(total / buckets)
  const extra = total % buckets
  return Array.from({ length: buckets }, (_, i) => base + (i < extra ? 1 : 0))
}

function placeSliceOnLine(text: string, slice: ChordRef[]): LyricChordAnchor[] {
  if (!slice.length) return []
  const max = text.length
  const n = slice.length
  const anchors: LyricChordAnchor[] = slice.map((chord, i) => {
    const offset = n === 1 ? 0 : Math.round((i / (n - 1 || 1)) * max)
    return { id: lyricUid('anc'), itemId: chord.id, offset: clampOffset(text, offset) }
  })
  // Prefer start→end spread: first at 0, last at end when 2+
  if (n >= 2) {
    anchors[0]!.offset = 0
    anchors[n - 1]!.offset = max
    for (let i = 1; i < n - 1; i++) {
      anchors[i]!.offset = clampOffset(text, Math.round((i / (n - 1)) * max))
    }
  }
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1]!
    const cur = anchors[i]!
    if (cur.offset <= prev.offset) {
      cur.offset = Math.min(max, prev.offset + 1)
    }
  }
  return anchors
}

export function updateLineInDoc(
  doc: SongLyricsDoc,
  blockId: string,
  lineId: string,
  line: LyricLine,
): SongLyricsDoc {
  return {
    ...doc,
    blocks: doc.blocks.map((b) =>
      b.id !== blockId
        ? b
        : { ...b, lines: b.lines.map((l) => (l.id === lineId ? line : l)) },
    ),
  }
}
