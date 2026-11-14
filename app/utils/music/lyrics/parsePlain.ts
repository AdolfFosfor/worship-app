import type { ChordChart, LyricBlock, LyricLine, SectionType, SongLyricsDoc } from '~~/shared/types'
import { matchSectionHeader } from '~/utils/music/sectionHeaders'
import { lyricUid } from './ids'
import { englishSectionTitle, lyricsBlockDisplayTitle } from './sectionTitle'

interface HeaderMatch {
  type: SectionType
  title: string
}

function matchHeader(line: string): HeaderMatch | null {
  const hit = matchSectionHeader(line)
  if (!hit) return null
  return {
    type: hit.type,
    title: englishSectionTitle(hit.type, hit.number),
  }
}

function nextChartSectionId(
  chart: ChordChart | null | undefined,
  type: SectionType,
  used: Set<string>,
): string | null {
  const match = chart?.sections.find((s) => s.type === type && !used.has(s.id))
  if (match) used.add(match.id)
  return match?.id ?? null
}

function emptyLine(): LyricLine {
  return { id: lyricUid('line'), text: '', anchors: [] }
}

function hasLyricText(block: LyricBlock): boolean {
  return block.lines.some((l) => l.text.trim().length > 0)
}

/** Build lyrics_doc from plain text; optionally reuse anchors from previous doc by block+line index. */
export function parsePlainLyrics(
  plain: string,
  chart?: ChordChart | null,
  previous?: SongLyricsDoc | null,
): SongLyricsDoc | null {
  const trimmed = plain.replace(/\r\n/g, '\n').trim()
  if (!trimmed) return null

  const blocks: LyricBlock[] = []
  let current: LyricBlock | null = null
  const usedSections = new Set<string>()

  function startBlock(type: SectionType, title: string) {
    current = {
      id: lyricUid('blk'),
      type,
      title,
      chartSectionId: nextChartSectionId(chart, type, usedSections),
      lines: [],
    }
    blocks.push(current)
  }

  for (const raw of trimmed.split('\n')) {
    const header = matchHeader(raw)
    if (header) {
      startBlock(header.type, header.title)
      continue
    }
    // Канон: без пустых строк внутри блока и без крайних пробелов
    const text = raw.trim().replace(/[ \t]+/g, ' ')
    if (!text) continue
    if (!current) startBlock('custom', 'Section')
    current.lines.push({ id: lyricUid('line'), text, anchors: [] })
  }

  // Drop empty custom leftovers (e.g. lone «Section:» from a previous serialize)
  const kept = blocks.filter((b) => b.type !== 'custom' || hasLyricText(b))

  for (const block of kept) {
    if (block.lines.length === 0) block.lines.push(emptyLine())
  }

  if (!kept.length) return null

  // Normalize titles to English auto labels (Verse 1 / Chorus 2 / …)
  for (const block of kept) {
    block.title = lyricsBlockDisplayTitle(kept, block.id)
  }

  if (previous?.blocks.length) reuseAnchors(kept, previous)

  return { v: 1, blocks: kept }
}

function reuseAnchors(next: LyricBlock[], previous: SongLyricsDoc) {
  for (let bi = 0; bi < next.length; bi++) {
    const nb = next[bi]!
    const pb =
      previous.blocks.find((b) => b.type === nb.type && (b.title ?? '') === (nb.title ?? '')) ??
      previous.blocks.find((b) => b.type === nb.type) ??
      previous.blocks[bi]
    if (!pb) continue
    if (!nb.chartSectionId && pb.chartSectionId) nb.chartSectionId = pb.chartSectionId
    for (let li = 0; li < nb.lines.length; li++) {
      const nl = nb.lines[li]!
      const pl = pb.lines[li]
      if (!pl?.anchors.length) continue
      if (pl.text === nl.text) {
        nl.anchors = pl.anchors.map((a) => ({
          ...a,
          offset: Math.min(a.offset, nl.text.length),
        }))
      }
    }
  }
}

export function serializeLyricsDoc(doc: SongLyricsDoc | null | undefined): string {
  if (!doc?.blocks.length) return ''
  const parts: string[] = []
  for (const block of doc.blocks) {
    // Skip empty custom noise
    if (block.type === 'custom' && !block.lines.some((l) => l.text.trim())) continue
    const header = lyricsBlockDisplayTitle(doc.blocks, block.id)
    parts.push(`${header}:`)
    for (const line of block.lines) {
      const text = line.text.trim()
      if (!text) continue
      // Don't re-emit a lyric line that is only the same section header
      if (matchSectionHeader(text)) continue
      parts.push(line.text)
    }
    parts.push('')
  }
  return parts.join('\n').trim()
}
