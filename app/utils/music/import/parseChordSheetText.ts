/**
 * Holychords / chord-over-lyric PDF text → chart source + lyrics plain.
 * Собираем по секциям: строки аккордов zip’ятся со строками текста (1 такт = 1 строка).
 */

import { SECTION_LABELS } from '~~/shared/types'
import { matchSectionHeader, SECTION_NAME_PATTERN } from '~/utils/music/sectionHeaders'

export type ChordSheetImportMode = 'chordsOnly' | 'lyricsAndChords'

export type ParsedChordSheet = {
  chordText: string
  lyricsPlain: string
}

const HEADER_RE = new RegExp(`^${SECTION_NAME_PATTERN}(?:\\s*\\d+)?\\s*[:.\\-–—]?\\s*$`, 'i')
const NUMBERED_HEADER_RE = new RegExp(
  `^(\\d+)\\s*(${SECTION_NAME_PATTERN})\\s*[:.\\-–—]?\\s*$`,
  'i',
)
const CHORUS_RANGE_RE = new RegExp(
  `^(${SECTION_NAME_PATTERN})\\s*[:.\\-–—]?\\s*(\\d+)(?:\\s*[&и,/]\\s*\\d+)?\\s*$`,
  'i',
)
const HEADER_INLINE_RE = new RegExp(
  `^(${SECTION_NAME_PATTERN}(?:\\s*\\d+)?)\\s*[-–—:]\\s*(.+)$`,
  'i',
)

const CHORD_TOKEN_RE =
  /^[A-H](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M|°|ø)?\d*(?:sus\d+|add\d+|maj\d+|m\d+|dim|aug)?(?:\/[A-H](?:#|b)?)?$/i

const SKIP_TOKEN_RE = /^[|/·•—–\-×x]\d*$/i

type RowKind = 'blank' | 'header' | 'chord' | 'lyric' | 'noise'

type SheetRow = {
  kind: RowKind
  text: string
  header?: string
}

type SectionBucket = {
  title: string
  chords: string[]
  lyrics: string[]
}

function normalizeLine(line: string): string {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function isChordToken(raw: string): boolean {
  let token = raw.replace(/^\(+|\)+$/g, '').trim()
  if (!token) return false
  if (token === '/' || token.startsWith('/')) return true
  if (token.endsWith('/')) token = token.slice(0, -1)
  if (SKIP_TOKEN_RE.test(token)) return true
  if (/^[x×]\d+$/i.test(token)) return true
  return CHORD_TOKEN_RE.test(token)
}

function coalesceChordTokens(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i]!
    const next = tokens[i + 1]
    if (next && /^[A-H](?:#|b)?\/$/i.test(cur) && /^[A-H](?:#|b)?$/i.test(next)) {
      out.push(cur + next)
      i++
      continue
    }
    if (next && /^[A-H](?:#|b)?$/i.test(cur) && /^\/[A-H](?:#|b)?$/i.test(next)) {
      out.push(cur + next)
      i++
      continue
    }
    out.push(cur)
  }
  return out
}

export function isChordLine(line: string): boolean {
  const t = normalizeLine(line)
  if (!t || englishHeaderFrom(t)) return false
  const tokens = coalesceChordTokens(t.split(/\s+/).filter(Boolean))
  if (!tokens.length) return false
  const chordish = tokens.filter(isChordToken)
  if (!chordish.length) return false
  const hasLyricWord = tokens.some((tok) => {
    if (isChordToken(tok)) return false
    return /[a-zăâîșțáäöüа-яё]{3,}/i.test(tok)
  })
  if (hasLyricWord) return false
  return chordish.length >= Math.ceil(tokens.length * 0.5)
}

function titleFromMatch(type: keyof typeof SECTION_LABELS, num: string | null): string {
  const label = SECTION_LABELS[type]
  return num ? `${label} ${num}` : label
}

export function englishHeaderFrom(line: string): string | null {
  const t = normalizeLine(line)
  if (!t) return null

  // Inline «Verse: G C» — header only if body is chords/noise, not lyrics
  const inline = t.match(HEADER_INLINE_RE)
  if (inline) {
    const body = inline[2]!.trim()
    if (body && !isChordToken(body.split(/\s+/)[0] ?? '') && /[a-zăâîșțа-яё]{4,}/i.test(body)) {
      return null
    }
  }

  const hit = matchSectionHeader(t)
  if (hit) return titleFromMatch(hit.type, hit.number)

  // Range form already covered by matchSectionHeader number capture; keep regex fallbacks
  if (NUMBERED_HEADER_RE.test(t) || HEADER_RE.test(t) || CHORUS_RANGE_RE.test(t)) {
    const again = matchSectionHeader(t.replace(/\s*[&и,/]\s*\d+\s*$/, ''))
    if (again) return titleFromMatch(again.type, again.number)
  }

  return null
}

function isNoiseLine(line: string): boolean {
  if (/^https?:\/\//i.test(line)) return true
  if (/^page\s*\d+/i.test(line)) return true
  if (/holychords|ultimate[- ]?guitar|chordie|copyright|©/i.test(line)) return true
  if (/^\d+$/.test(line)) return true
  if (/^(слова|аккорды|скачать|перевод|capo\s*\d*|капо\s*\d*)$/i.test(line)) return true
  if (/^build my life$/i.test(line)) return true
  if (/^pat barrett$/i.test(line)) return true
  return false
}

function splitMixedLine(line: string): { chords: string | null; lyric: string | null } {
  const tokens = coalesceChordTokens(normalizeLine(line).split(/\s+/).filter(Boolean))
  if (!tokens.length) return { chords: null, lyric: null }

  let i = 0
  while (i < tokens.length && isChordToken(tokens[i]!)) i++
  if (i === 0) return { chords: null, lyric: tokens.join(' ') }
  if (i === tokens.length) return { chords: tokens.join(' '), lyric: null }

  const rest = tokens.slice(i).join(' ')
  if (!/[a-zăâîșțáäöüа-яё]{3,}/i.test(rest)) {
    return { chords: tokens.join(' '), lyric: null }
  }
  return { chords: tokens.slice(0, i).join(' '), lyric: rest }
}

export function normalizeChordAlphabet(text: string): string {
  return text
    // Optional chord in PDF: (C) / (G/H)
    .replace(/\(\s*([A-Ha-h][^)]*?)\s*\)/g, '$1')
    .replace(/\/H(?=#|b|\s|$|[mMdijausaugsusadd°ø\d)/])/gi, '/B')
    .replace(/(^|[\s|/([])H(?=#|b|\s|$|[mMdijausaugsusadd°ø\d/)])/g, '$1B')
    .replace(/(^|[\s|/([])С(?=#|b|\s|$|[mMdijausaugsusadd°ø\d/)])/g, '$1C')
}

function classifyRows(plain: string): SheetRow[] {
  const lines = plain.replace(/\r\n/g, '\n').split('\n')
  const rows: SheetRow[] = []

  for (const original of lines) {
    const line = normalizeLine(original)
    if (!line) {
      rows.push({ kind: 'blank', text: '' })
      continue
    }
    if (isNoiseLine(line)) {
      rows.push({ kind: 'noise', text: line })
      continue
    }

    const header = englishHeaderFrom(line)
    if (header) {
      const inline = line.match(HEADER_INLINE_RE)
      rows.push({ kind: 'header', text: line, header })
      if (inline?.[2]) {
        const body = normalizeLine(inline[2])
        if (/^\d+(?:\s*[&и,/]\s*\d+)?$/.test(body)) {
          /* range */
        } else if (isChordLine(body)) {
          rows.push({ kind: 'chord', text: normalizeChordAlphabet(body) })
        } else if (body && !/^\d/.test(body)) {
          rows.push({ kind: 'lyric', text: body })
        }
      }
      continue
    }

    if (isChordLine(line)) {
      rows.push({ kind: 'chord', text: normalizeChordAlphabet(line) })
      continue
    }

    const mixed = splitMixedLine(line)
    if (mixed.chords && mixed.lyric) {
      rows.push({ kind: 'chord', text: normalizeChordAlphabet(mixed.chords) })
      rows.push({ kind: 'lyric', text: mixed.lyric })
      continue
    }
    if (mixed.chords && !mixed.lyric) {
      rows.push({ kind: 'chord', text: normalizeChordAlphabet(mixed.chords) })
      continue
    }

    rows.push({ kind: 'lyric', text: line })
  }

  return rows
}

/**
 * Zip chord lines onto lyric lines within a section.
 * Prefer 1:1; if more chord lines — merge extras; if fewer — pad with empty bars.
 */
function zipSection(bucket: SectionBucket): { chordLines: string[]; lyricLines: string[] } {
  const chords = bucket.chords.map(normalizeLine).filter(Boolean)
  const lyrics = bucket.lyrics.map(normalizeLine).filter(Boolean)

  if (!lyrics.length) {
    // Instrumental / intro — только схема
    return { chordLines: chords, lyricLines: [] }
  }

  if (!chords.length) {
    return {
      chordLines: lyrics.map(() => '|'),
      lyricLines: lyrics,
    }
  }

  if (chords.length === lyrics.length) {
    return { chordLines: chords, lyricLines: lyrics }
  }

  if (chords.length < lyrics.length) {
    const out: string[] = lyrics.map((_, i) => (i < chords.length ? chords[i]! : '|'))
    return { chordLines: out, lyricLines: lyrics }
  }

  // chords.length > lyrics.length — склеить лишние аккорды в соседние строки
  const chordLines: string[] = []
  const ratio = chords.length / lyrics.length
  let cursor = 0
  for (let i = 0; i < lyrics.length; i++) {
    const end =
      i === lyrics.length - 1
        ? chords.length
        : Math.round((i + 1) * ratio)
    const slice = chords.slice(cursor, Math.max(cursor + 1, end))
    cursor = Math.max(cursor + 1, end)
    chordLines.push(normalizeLine(slice.join(' ')))
  }
  return { chordLines, lyricLines: lyrics }
}

function bucketsFromRows(rows: SheetRow[]): SectionBucket[] {
  const buckets: SectionBucket[] = []
  let current: SectionBucket | null = null

  function start(title: string) {
    current = { title, chords: [], lyrics: [] }
    buckets.push(current)
  }

  for (const row of rows) {
    if (row.kind === 'blank' || row.kind === 'noise') continue
    if (row.kind === 'header') {
      start(row.header ?? 'Section')
      continue
    }
    if (!current) start('Verse 1')
    if (row.kind === 'chord') current.chords.push(row.text)
    else if (row.kind === 'lyric') current.lyrics.push(row.text)
  }

  return buckets
}

export function parseChordSheetText(plain: string): ParsedChordSheet {
  const rows = classifyRows(plain)
  const buckets = bucketsFromRows(rows)

  const chordParts: string[] = []
  const lyricParts: string[] = []

  for (const bucket of buckets) {
    const { chordLines, lyricLines } = zipSection(bucket)
    if (!chordLines.length && !lyricLines.length) continue

    chordParts.push(`${bucket.title}:`)
    for (const line of chordLines) chordParts.push(line || '|')

    if (lyricLines.length) {
      lyricParts.push(`${bucket.title}:`)
      for (const line of lyricLines) lyricParts.push(line)
    }
  }

  return {
    chordText: chordParts.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    lyricsPlain: lyricParts.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
  }
}
