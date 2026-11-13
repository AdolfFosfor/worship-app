import type {
  ChordChart,
  LyricChordAnchor,
  LyricLine,
  SongLyricsDoc,
} from '~~/shared/types'
import { lyricUid } from './ids'

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

/**
 * Auto-layout by bars: one bar → one lyric line when possible.
 * Preserves chord order inside each bar (left→right).
 */
export function autoPlaceBlock(
  doc: SongLyricsDoc,
  blockId: string,
  chart: ChordChart | null | undefined,
): SongLyricsDoc {
  const block = doc.blocks.find((b) => b.id === blockId)
  if (!block || !chart || !block.chartSectionId) return doc

  const section = chart.sections.find((s) => s.id === block.chartSectionId)
  if (!section) return doc

  const bars = section.bars.map((bar) =>
    bar.items.filter((item) => item.kind === 'chord').map((item) => ({ id: item.id, symbol: item.symbol })),
  )
  if (!bars.some((b) => b.length)) return doc

  const targets = block.lines.filter((l) => l.text.trim().length > 0)
  if (!targets.length) return doc

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

type ChordRef = { id: string; symbol: string }

/**
 * Map bars onto lyric lines:
 * - same count → 1:1
 * - fewer bars → stretch across lines (unique lines, last lines keep bars)
 * - more bars → merge consecutive bars onto lines
 */
function assignBarsToLines(bars: ChordRef[][], lineCount: number): ChordRef[][] {
  const out: ChordRef[][] = Array.from({ length: lineCount }, () => [])
  const nonEmpty = bars.filter((b) => b.length > 0)
  if (!nonEmpty.length || lineCount <= 0) return out

  if (nonEmpty.length === lineCount) {
    return nonEmpty.map((b) => [...b])
  }

  if (nonEmpty.length < lineCount) {
    // Stretch bars toward the end so the last lyric line still gets the last bar
    // (verse: 4 bars / 5 lines → lines 0..3 empty gap avoided via round spread)
    const used = new Set<number>()
    for (let b = 0; b < nonEmpty.length; b++) {
      let li =
        nonEmpty.length === 1
          ? 0
          : Math.round((b * (lineCount - 1)) / (nonEmpty.length - 1))
      // Resolve collisions forward, then backward
      if (used.has(li)) {
        let next = li + 1
        while (next < lineCount && used.has(next)) next += 1
        if (next < lineCount) li = next
        else {
          let prev = li - 1
          while (prev >= 0 && used.has(prev)) prev -= 1
          if (prev >= 0) li = prev
        }
      }
      used.add(li)
      out[li] = [...nonEmpty[b]!]
    }
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
  const base = Math.floor(total / buckets)
  const extra = total % buckets
  return Array.from({ length: buckets }, (_, i) => base + (i < extra ? 1 : 0))
}

function placeSliceOnLine(text: string, slice: ChordRef[]): LyricChordAnchor[] {
  if (!slice.length) return []
  const max = text.length
  const n = slice.length
  const anchors: LyricChordAnchor[] = slice.map((chord, i) => {
    const offset = n === 1 ? 0 : Math.round((i / n) * max)
    return { id: lyricUid('anc'), itemId: chord.id, offset: clampOffset(text, offset) }
  })
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
