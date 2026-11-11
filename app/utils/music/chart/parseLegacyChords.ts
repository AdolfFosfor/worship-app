import type {
  AnnotationPreset,
  BarItem,
  ChartBar,
  ChartSection,
  ChordChart,
  SectionType,
} from '~~/shared/types'
import { createAnnotation, createBar, createChord, createEmptyChart, createSection } from './factory'

const CHORD_TOKEN =
  /^([A-G](?:#|b)?)((?:maj|min|dim|aug|sus|add|m|M|°|ø)?\d*(?:sus\d+|add\d+|maj\d+|m\d+|dim|aug)?)?(?:\/([A-G](?:#|b)?))?$/i

/** Section name only (+ optional number) — do not use \\b (breaks Cyrillic). */
const SECTION_NAME =
  '(?:intro|outro|ending|chorus|refrain|ref\\.?|припев|bridge|бридж|pre[-\\s]?chorus|pre[-\\s]?ch\\.?|предприпев|verse|куплет|vers\\.?|tag|solo|instrumental|inst\\.?|проигрыш|вступление|конец)'

const SECTION_ALIASES: { pattern: RegExp; type: SectionType }[] = [
  { pattern: /^(intro|вступление)(?=$|[\s.:\-–—])/i, type: 'intro' },
  { pattern: /^(outro|ending|конец)(?=$|[\s.:\-–—])/i, type: 'outro' },
  { pattern: /^(chorus|refrain|ref\.?|припев)(?=$|[\s.:\-–—])/i, type: 'chorus' },
  { pattern: /^(bridge|бридж)(?=$|[\s.:\-–—])/i, type: 'bridge' },
  { pattern: /^(instrumental|inst\.?|solo|проигрыш)(?=$|[\s.:\-–—])/i, type: 'instrumental' },
  { pattern: /^(tag)(?=$|[\s.:\-–—])/i, type: 'tag' },
  { pattern: /^(pre[-\s]?chorus|pre[-\s]?ch\.?|предприпев)(?=$|[\s.:\-–—])/i, type: 'custom' },
  { pattern: /^(verse|куплет|vers\.?)(?=$|[\s.:\-–—|\d])/i, type: 'verse' },
]

const HEADER_PREFIX = new RegExp(`^${SECTION_NAME}(?=$|[\\s.:\\-–—|\\d])`, 'i')

const ANNOTATION_MAP: { pattern: RegExp; preset: AnnotationPreset; text: string }[] = [
  { pattern: /^[x×]2$/i, preset: 'x2', text: '×2' },
  { pattern: /^[x×]3$/i, preset: 'x3', text: '×3' },
  { pattern: /^[x×]4$/i, preset: 'x4', text: '×4' },
  { pattern: /^stop$/i, preset: 'stop', text: 'STOP' },
  { pattern: /^\(?inst(?:rumental)?\.?\)?$/i, preset: 'inst', text: 'Inst' },
  { pattern: /^\(?(?:vox|vocal|только\s*вокал)\)?$/i, preset: 'vox', text: 'Vocal' },
]

const SKIP_TOKENS = new Set(['|', '/', '—', '–', '-', '·', '•', ''])

function detectSectionType(title: string): SectionType {
  const cleaned = title.trim()
  for (const { pattern, type } of SECTION_ALIASES) {
    if (pattern.test(cleaned)) return type
  }
  return 'custom'
}

function splitHeaderAndBody(line: string): { header: string | null; body: string } {
  // Only the section keyword (+ optional number) is the header.
  // Do NOT swallow the rest of the line — em-dashes in "Em G — A" must stay in the body.
  const m = line.match(new RegExp(`^(${SECTION_NAME}(?:\\s*\\d+)?)\\s*[-–—:]\\s*(.+)$`, 'i'))
  if (m) return { header: m[1]!.trim(), body: m[2]!.trim() }
  return { header: null, body: line }
}

function isPureHeaderLine(line: string): boolean {
  if (!HEADER_PREFIX.test(line)) return false
  if (/[|/]/.test(line)) return false
  const withoutHead = line.replace(HEADER_PREFIX, '').replace(/^[\s.:\-–—]+/, '').trim()
  if (!withoutHead) return true
  return !/[A-G](?:#|b)?/i.test(withoutHead)
}

function parseToken(raw: string): BarItem | null {
  let token = raw.trim()
  if (!token || SKIP_TOKENS.has(token)) return null

  token = token.replace(/[,;]+$/g, '')
  if (!token || SKIP_TOKENS.has(token)) return null

  if (/^\([A-Za-zА-Яа-яЁё]\)$/u.test(token)) return null

  for (const { pattern, preset, text } of ANNOTATION_MAP) {
    if (pattern.test(token)) return createAnnotation(text, preset)
  }

  const bare = token.replace(/^\(+|\)+$/g, '')
  const m = bare.match(CHORD_TOKEN)
  if (m) {
    const root = m[1]![0]!.toUpperCase() + m[1]!.slice(1)
    const quality = m[2] ?? ''
    const bass = m[3] ? `/${m[3][0]!.toUpperCase()}${m[3]!.slice(1)}` : ''
    return createChord(`${root}${quality}${bass}`)
  }

  if (/^[x×]\d+$/i.test(token)) return createAnnotation(token.replace(/^x/i, '×'))
  if (token === '/' || token.length === 1) return null
  return null
}

function parseBarChunk(chunk: string): ChartBar {
  const items: BarItem[] = []
  for (const part of chunk.split(/\s+/).map((p) => p.trim()).filter(Boolean)) {
    const item = parseToken(part)
    if (item) items.push(item)
  }
  return createBar(items)
}

function parseBarsLine(line: string): ChartBar[] {
  const normalized = line
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/\s+\/\s+/g, ' | ')
    .replace(/^\s*\/\s*/, '')
    .replace(/\s*\/\s*$/, '')
    .trim()

  if (!normalized) return []

  const chunks = normalized.split('|').map((c) => c.trim())
  while (chunks.length > 1 && chunks[chunks.length - 1] === '') chunks.pop()
  if (!chunks.length) return []

  const bars = chunks.map(parseBarChunk)
  const nonEmpty = bars.filter((bar) => bar.items.length > 0)
  return nonEmpty.length ? nonEmpty : [createBar()]
}

/** Strip markdown/bold stars and normalize section separators for legacy text. */
export function normalizeLegacyChordsText(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((original) => {
      let line = original.trim()
      if (!line) return ''
      // *Verse: ...* / **chords** / stray emphasis
      line = line.replace(/^\*+\s*/, '').replace(/\s*\*+$/, '').replace(/\*+/g, '')
      line = line.replace(/\s{2,}/g, ' ').trim()
      // x2/x3/x4 → ×2/×3/×4
      line = line.replace(/\b[xх](\d+)\b/gi, '×$1')
      return line
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Best-effort conversion of free-form chord text into a structured chart.
 */
export function parseLegacyChords(text: string | null | undefined): ChordChart {
  const chart = createEmptyChart('4/4')
  chart.sections = []

  const raw = normalizeLegacyChordsText(text)
  if (!raw) {
    chart.sections = [createSection('verse')]
    return chart
  }

  let current: ChartSection | null = null

  const pushSection = (type: SectionType, title?: string) => {
    current = createSection(type, title, [])
    chart.sections.push(current)
  }

  for (const original of raw.split('\n')) {
    const line = original.trim()
    if (!line) continue

    if (isPureHeaderLine(line)) {
      const title = line.replace(/[:.\-–—]\s*$/, '').trim()
      pushSection(detectSectionType(title), title)
      continue
    }

    const { header, body } = splitHeaderAndBody(line)
    if (header) {
      pushSection(detectSectionType(header), header)
      if (body) current!.bars.push(...parseBarsLine(body))
      continue
    }

    if (!current) pushSection('verse')
    current!.bars.push(...parseBarsLine(line))
  }

  if (!chart.sections.length) chart.sections = [createSection('verse')]

  for (const section of chart.sections) {
    if (!section.bars.length) section.bars.push(createBar())
  }

  return chart
}
