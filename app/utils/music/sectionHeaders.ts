import type { SectionType } from '~~/shared/types'

/**
 * Shared EN / RO / RU section-header vocabulary for lyrics + chord parsers.
 * Longer aliases first so «prerefren» wins over «refren».
 */
export const SECTION_NAME_PATTERN =
  '(?:prerefren|pre[-\\s]?refren|pre[-\\s]?chorus|pre[-\\s]?ch\\.?|предприпев|пред[-\\s]?припев|intro|outro|ending|coda|кода|chorus|refrain|ref\\.?|припев|refren|bridge|бридж|verse|куплет|vers\\.?|strofa|strofă|tag|тэг|тег|solo|instrumental|inst\\.?|проигрыш|вступление|интро|аутро|конец|section|секция)'

export type MatchedSectionHeader = {
  type: SectionType
  /** Optional ordinal from «Strofa 1» / «1 Verse» */
  number: string | null
}

/** Strip wrapping quotes and trailing `: . —` so `"Strofa 1:"` matches. */
export function normalizeHeaderCandidate(line: string): string {
  return line
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/^["'«»„“]+/, '')
    .replace(/["'«»„“]+$/, '')
    .trim()
    .replace(/[:.\-–—]+\s*$/, '')
    .trim()
}

const ALIASES: { type: SectionType; re: RegExp }[] = [
  {
    type: 'prechorus',
    re: /^(?:prerefren|pre[-\s]?refren|pre[-\s]?chorus|pre[-\s]?ch\.?|предприпев|пред[-\s]?припев)(?=$|[\s.:\-–—\d])/i,
  },
  {
    type: 'verse',
    re: /^(?:strofa|strofă|verse|куплет|vers\.?)(?=$|[\s.:\-–—\d])/i,
  },
  {
    type: 'chorus',
    re: /^(?:chorus|refrain|ref\.?|припев|refren)(?=$|[\s.:\-–—\d])/i,
  },
  {
    type: 'bridge',
    re: /^(?:bridge|бридж)(?=$|[\s.:\-–—\d])/i,
  },
  {
    type: 'intro',
    re: /^(?:intro|вступление|интро)(?=$|[\s.:\-–—\d])/i,
  },
  {
    type: 'outro',
    re: /^(?:outro|ending|coda|кода|конец|аутро)(?=$|[\s.:\-–—\d])/i,
  },
  {
    type: 'instrumental',
    re: /^(?:instrumental|inst\.?|solo|проигрыш)(?=$|[\s.:\-–—\d])/i,
  },
  {
    type: 'tag',
    re: /^(?:tag|тэг|тег)(?=$|[\s.:\-–—\d])/i,
  },
  {
    // Canonical English label from serialize — must not become a lyric line
    type: 'custom',
    re: /^(?:section|секция)(?=$|[\s.:\-–—\d])/i,
  },
]

/**
 * Whole-line section header → type + optional number.
 * Accepts: Strofa 1 / "Prerefren:" / 2 Verse / Chorus 1 & 2 (takes first number).
 */
export function matchSectionHeader(line: string): MatchedSectionHeader | null {
  let raw = normalizeHeaderCandidate(line)
  if (!raw) return null

  // «1 Strofa» / «2 Verse»
  const leadingNum = raw.match(/^(\d+)\s+(.+)$/)
  if (leadingNum) {
    raw = leadingNum[2]!.trim()
    const inner = matchSectionHeader(raw)
    if (inner) return { type: inner.type, number: leadingNum[1]! }
  }

  for (const { type, re } of ALIASES) {
    if (!re.test(raw)) continue
    const num = raw.match(/(\d+)(?:\s*[&и,/]\s*\d+)?\s*$/)?.[1] ?? null
    return { type, number: num }
  }
  return null
}
