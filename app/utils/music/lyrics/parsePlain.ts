import type { ChordChart, LyricBlock, LyricLine, SectionType, SongLyricsDoc } from '~~/shared/types'
import { lyricUid } from './ids'
import { englishSectionTitle, lyricsBlockDisplayTitle } from './sectionTitle'

interface HeaderMatch {
  type: SectionType
  title: string
}

function matchHeader(line: string): HeaderMatch | null {
  const raw = line.trim().replace(/:+\s*$/, '')
  if (!raw) return null

  let m = raw.match(/^(?:STROFA|STROFĂ|VERSE|КУПЛЕТ)\s*(\d*)$/i)
  if (m || /^(?:STROFA|STROFĂ|VERSE|КУПЛЕТ)\b/i.test(raw)) {
    const n = (m?.[1] || raw.match(/(\d+)\s*$/)?.[1] || '').trim()
    return { type: 'verse', title: englishSectionTitle('verse', n || null) }
  }

  m = raw.match(/^(?:REFREN|REFRAIN|CHORUS|ПРИПЕВ)\s*(\d*)$/i)
  if (m || /^(?:REFREN|REFRAIN|CHORUS|ПРИПЕВ)\b/i.test(raw)) {
    const n = (m?.[1] || raw.match(/(\d+)\s*$/)?.[1] || '').trim()
    return { type: 'chorus', title: englishSectionTitle('chorus', n || null) }
  }

  if (/^(?:TAG|ТЭГ|ТЕГ)$/i.test(raw)) return { type: 'tag', title: englishSectionTitle('tag') }
  if (/^(?:BRIDGE|БРИДЖ|ПРОИГРЫШ)$/i.test(raw)) {
    return { type: 'bridge', title: englishSectionTitle('bridge') }
  }
  if (/^(?:INTRO|ИНТРО)$/i.test(raw)) return { type: 'intro', title: englishSectionTitle('intro') }
  if (/^(?:OUTRO|АУТРО)$/i.test(raw)) return { type: 'outro', title: englishSectionTitle('outro') }
  if (/^(?:INST|INSTRUMENTAL|ИНСТР\.?)$/i.test(raw)) {
    return { type: 'instrumental', title: englishSectionTitle('instrumental') }
  }
  return null
}

function firstChartSectionId(chart: ChordChart | null | undefined, type: SectionType): string | null {
  return chart?.sections.find((s) => s.type === type)?.id ?? null
}

function emptyLine(): LyricLine {
  return { id: lyricUid('line'), text: '', anchors: [] }
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

  function startBlock(type: SectionType, title: string) {
    current = {
      id: lyricUid('blk'),
      type,
      title,
      chartSectionId: firstChartSectionId(chart, type),
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
    if (!current) startBlock('custom', 'Section')
    const text = raw.replace(/\s+$/, '')
    if (!text && current.lines.length === 0) continue
    current.lines.push({ id: lyricUid('line'), text, anchors: [] })
  }

  for (const block of blocks) {
    while (block.lines.length && !block.lines[block.lines.length - 1]!.text.trim()) {
      block.lines.pop()
    }
    if (block.lines.length === 0) block.lines.push(emptyLine())
  }

  // Normalize titles to English auto labels (Verse 1 / Chorus 2 / …)
  for (const block of blocks) {
    block.title = lyricsBlockDisplayTitle(blocks, block.id)
  }

  if (previous?.blocks.length) reuseAnchors(blocks, previous)

  return { v: 1, blocks }
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
    const header = lyricsBlockDisplayTitle(doc.blocks, block.id)
    parts.push(`${header}:`)
    for (const line of block.lines) parts.push(line.text)
    parts.push('')
  }
  return parts.join('\n').trim()
}
