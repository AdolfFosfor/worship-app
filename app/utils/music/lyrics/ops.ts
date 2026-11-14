import type { ChordChart, LyricBlock, LyricLine, SectionType, SongLyricsDoc } from '~~/shared/types'
import { lyricUid } from './ids'
import { lyricsBlockDisplayTitle } from './sectionTitle'
import { rematchLyricChartSections } from './rematch'

function cloneDoc(doc: SongLyricsDoc): SongLyricsDoc {
  return JSON.parse(JSON.stringify(doc)) as SongLyricsDoc
}

function withDoc(doc: SongLyricsDoc, mutate: (draft: SongLyricsDoc) => void): SongLyricsDoc {
  const draft = cloneDoc(doc)
  mutate(draft)
  return draft
}

function emptyLine(): LyricLine {
  return { id: lyricUid('line'), text: '', anchors: [] }
}

function createBlock(type: SectionType, chart?: ChordChart | null): LyricBlock {
  return {
    id: lyricUid('blk'),
    type,
    title: undefined,
    chartSectionId: chart?.sections.find((s) => s.type === type)?.id ?? null,
    lines: [emptyLine()],
  }
}

function refreshTitles(doc: SongLyricsDoc) {
  for (const block of doc.blocks) {
    block.title = lyricsBlockDisplayTitle(doc.blocks, block.id)
  }
}

export function emptyLyricsDoc(): SongLyricsDoc {
  return { v: 1, blocks: [] }
}

export function addLyricBlock(
  doc: SongLyricsDoc,
  type: SectionType,
  chart?: ChordChart | null,
): SongLyricsDoc {
  return withDoc(doc, (d) => {
    d.blocks.push(createBlock(type, chart))
    refreshTitles(d)
  })
}

export function removeLyricBlock(doc: SongLyricsDoc, blockId: string): SongLyricsDoc {
  return withDoc(doc, (d) => {
    d.blocks = d.blocks.filter((b) => b.id !== blockId)
    refreshTitles(d)
  })
}

export function duplicateLyricBlock(doc: SongLyricsDoc, blockId: string): SongLyricsDoc {
  return withDoc(doc, (d) => {
    const idx = d.blocks.findIndex((b) => b.id === blockId)
    if (idx < 0) return
    const source = d.blocks[idx]!
    const copy: LyricBlock = {
      ...JSON.parse(JSON.stringify(source)) as LyricBlock,
      id: lyricUid('blk'),
      lines: source.lines.map((l) => ({
        id: lyricUid('line'),
        text: l.text,
        anchors: [],
      })),
    }
    d.blocks.splice(idx + 1, 0, copy)
    refreshTitles(d)
  })
}

export function moveLyricBlock(
  doc: SongLyricsDoc,
  blockId: string,
  toIndex: number,
): SongLyricsDoc {
  return withDoc(doc, (d) => {
    const fromIdx = d.blocks.findIndex((b) => b.id === blockId)
    if (fromIdx < 0) return
    const [block] = d.blocks.splice(fromIdx, 1)
    if (!block) return
    let insertAt = toIndex
    if (fromIdx < insertAt) insertAt -= 1
    insertAt = Math.max(0, Math.min(insertAt, d.blocks.length))
    d.blocks.splice(insertAt, 0, block)
    refreshTitles(d)
  })
}

export function setLyricBlockType(
  doc: SongLyricsDoc,
  blockId: string,
  type: SectionType,
  chart?: ChordChart | null,
): SongLyricsDoc {
  let next = withDoc(doc, (d) => {
    const block = d.blocks.find((b) => b.id === blockId)
    if (!block) return
    block.type = type
    block.title = undefined
    refreshTitles(d)
  })
  if (chart) next = rematchLyricChartSections(next, chart)
  return next
}

export function setLyricLineText(
  doc: SongLyricsDoc,
  blockId: string,
  lineId: string,
  text: string,
): SongLyricsDoc {
  return withDoc(doc, (d) => {
    const block = d.blocks.find((b) => b.id === blockId)
    const line = block?.lines.find((l) => l.id === lineId)
    if (!line) return
    const next = text.replace(/\r\n/g, '\n')
    // Keep anchors only if text still compatible; clamp offsets
    line.text = next
    line.anchors = line.anchors
      .map((a) => ({ ...a, offset: Math.max(0, Math.min(a.offset, next.length)) }))
      .filter((a) => a.offset <= next.length)
  })
}

export function addLyricLine(
  doc: SongLyricsDoc,
  blockId: string,
  afterLineId?: string | null,
): SongLyricsDoc {
  return withDoc(doc, (d) => {
    const block = d.blocks.find((b) => b.id === blockId)
    if (!block) return
    const line = emptyLine()
    if (!afterLineId) {
      block.lines.push(line)
      return
    }
    const idx = block.lines.findIndex((l) => l.id === afterLineId)
    if (idx < 0) block.lines.push(line)
    else block.lines.splice(idx + 1, 0, line)
  })
}

export function removeLyricLine(
  doc: SongLyricsDoc,
  blockId: string,
  lineId: string,
): SongLyricsDoc {
  return withDoc(doc, (d) => {
    const block = d.blocks.find((b) => b.id === blockId)
    if (!block) return
    if (block.lines.length <= 1) {
      block.lines = [emptyLine()]
      return
    }
    block.lines = block.lines.filter((l) => l.id !== lineId)
  })
}
