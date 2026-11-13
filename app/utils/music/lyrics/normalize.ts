import type { Json, LyricBlock, LyricChordAnchor, LyricLine, SectionType, SongLyricsDoc } from '~~/shared/types'
import { SECTION_TYPES } from '~~/shared/types'
import { lyricUid } from './ids'

function isSectionType(value: unknown): value is SectionType {
  return typeof value === 'string' && (SECTION_TYPES as string[]).includes(value)
}

function normalizeAnchor(raw: unknown): LyricChordAnchor | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const itemId = typeof o.itemId === 'string' ? o.itemId : ''
  if (!itemId) return null
  const offset = typeof o.offset === 'number' && Number.isFinite(o.offset) ? Math.max(0, Math.floor(o.offset)) : 0
  const id = typeof o.id === 'string' && o.id ? o.id : lyricUid('anc')
  return { id, itemId, offset }
}

function normalizeLine(raw: unknown): LyricLine | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const text = typeof o.text === 'string' ? o.text : ''
  const id = typeof o.id === 'string' && o.id ? o.id : lyricUid('line')
  const anchorsRaw = Array.isArray(o.anchors) ? o.anchors : []
  const anchors = anchorsRaw
    .map(normalizeAnchor)
    .filter((a): a is LyricChordAnchor => a != null)
    .map((a) => ({ ...a, offset: Math.min(a.offset, text.length) }))
    .sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id))
  return { id, text, anchors }
}

function normalizeBlock(raw: unknown): LyricBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isSectionType(o.type)) return null
  const id = typeof o.id === 'string' && o.id ? o.id : lyricUid('blk')
  const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim() : undefined
  const chartSectionId =
    typeof o.chartSectionId === 'string' && o.chartSectionId ? o.chartSectionId : null
  const linesRaw = Array.isArray(o.lines) ? o.lines : []
  const lines = linesRaw.map(normalizeLine).filter((l): l is LyricLine => l != null)
  return { id, type: o.type, ...(title ? { title } : {}), chartSectionId, lines }
}

export function isSongLyricsDoc(value: unknown): value is SongLyricsDoc {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return o.v === 1 && Array.isArray(o.blocks)
}

export function normalizeLyricsDoc(value: Json | SongLyricsDoc | null | undefined): SongLyricsDoc | null {
  if (value == null) return null
  if (!isSongLyricsDoc(value)) return null
  const blocks = value.blocks.map(normalizeBlock).filter((b): b is LyricBlock => b != null)
  return { v: 1, blocks }
}
