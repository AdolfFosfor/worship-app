/**
 * Parse church Worship Chords markdown into song records.
 * Capo = fret; chords kept as shapes played with that capo.
 */

// Avoid \b after Cyrillic — JS word boundaries are ASCII-only
const CAPO_RE =
  /(?:capo|капо)\s*[-:]?\s*(\d{1,2})|(?:^|[\s\-–—(])(\d{1,2})\s*(?:lad|лад|capo|капо)(?=$|[\s\-–—,.)])|(\d{1,2})\s*🤡\s*lad/gi

const NO_CAPO_RE = /нет\s*лада/i

const RU_KEY_RE =
  /(?:^|[\s\-–—(,])(до#?|ре|ми|фа#?|соль#?|ля|си)\s*(мажор|минор|maj|min|m)?(?=$|[\s\-–—),])/gi

const RU_ROOT = {
  до: 'C',
  'до#': 'C#',
  ре: 'D',
  ми: 'E',
  фа: 'F',
  'фа#': 'F#',
  соль: 'G',
  'соль#': 'G#',
  ля: 'A',
  си: 'B',
}

const EXPLICIT_KEY_RE = /\(\s*([A-H](?:#|b)?m?)\s*(?:[-–].*?)?\)/i

const CHORD_TOKEN_RE =
  /\b([A-H](?:#|b)?)((?:maj|min|dim|aug|sus|add|m|M)?\d*)(?:\/([A-H](?:#|b)?))?/g

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const ENHARMONIC = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
  H: 'B',
}

function clampCapo(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(11, Math.round(n)))
}

function parseKeyParts(key) {
  const trimmed = String(key || 'C').trim()
  const minor = /m$/i.test(trimmed) && !/maj$/i.test(trimmed)
  let root = minor ? trimmed.slice(0, -1) : trimmed
  root = ENHARMONIC[root] || root
  return { root, minor }
}

function transposeKeyLabel(key, semitones) {
  const { root, minor } = parseKeyParts(key)
  const idx = CHROMATIC.indexOf(root)
  const base = idx >= 0 ? idx : 0
  const next = CHROMATIC[(base + semitones % 12 + 12) % 12]
  return minor ? `${next}m` : next
}

function extractCapo(title, body) {
  if (NO_CAPO_RE.test(title) || NO_CAPO_RE.test(body)) return 0

  const hay = `${title}\n${body}`
  let found = 0
  for (const match of hay.matchAll(CAPO_RE)) {
    const raw = match[1] || match[2] || match[3]
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0 && n <= 11) found = n
  }

  // Trailing lone digit in title like "Unstable God 4"
  if (!found) {
    const lone = title.match(/\s(\d{1,2})\s*$/)
    if (lone) {
      const n = Number(lone[1])
      if (n >= 1 && n <= 11) found = n
    }
  }

  return clampCapo(found)
}

function cleanTitle(rawTitle) {
  let title = rawTitle.trim()
  title = title.replace(CAPO_RE, ' ')
  title = title.replace(NO_CAPO_RE, ' ')
  title = title.replace(
    /\s*[-–—:]?\s*(?:до#?|ре|ми|фа#?|соль#?|ля|си)\s*(?:мажор|минор)\s*$/i,
    '',
  )
  title = title.replace(/\s*\(\s*[A-H](?:#|b)?m?\s*(?:[-–].*?)?\)\s*/gi, ' ')
  title = title.replace(/\s*[-–—:]\s*$/g, '')
  title = title.replace(/\s{2,}/g, ' ').trim()
  title = title.replace(/\s*[-–—]?\s*capo\s*$/i, '').trim()
  // "Grateful 2 лад" leftover digit after capo strip
  title = title.replace(/\s+\d{1,2}\s*$/g, '').trim()
  return title || rawTitle.trim()
}

function parseRuKey(text) {
  let last = null
  for (const match of text.matchAll(RU_KEY_RE)) {
    last = match
  }
  if (!last) return null
  const rootRaw = last[1].toLowerCase()
  const quality = (last[2] || 'мажор').toLowerCase()
  const root = RU_ROOT[rootRaw]
  if (!root) return null
  const minor = /минор|^m$|^min$/.test(quality)
  return minor ? `${root}m` : root
}

/** Cyrillic Es used as Latin C in chord lines only. */
function fixCyrillicChordC(text) {
  return text.replace(/(^|[\s|/,\-(×x])С(?=[\s|/,#bmM\d-]|$)/gm, '$1C')
}

export function normalizeChordText(text) {
  if (!text) return ''
  let t = fixCyrillicChordC(text)
  // German/Romanian H → B (Hm, Hmaj7, G/H)
  t = t.replace(
    /\bH([#b]?(?:maj|min|dim|aug|sus|add|m|M)?\d*)(\/[A-Hb][#b]?)?/g,
    (_full, quality, bass = '') => `B${quality || ''}${bass || ''}`,
  )
  t = t.replace(/\/H([#b]?)/g, '/B$1')
  // Lowercase roots like f#m → F#m
  t = t.replace(
    /\b([a-g])([#b]?)((?:maj|min|dim|aug|sus|add|m|M)?\d*)(?=\/|\b)/g,
    (_f, r, acc, q) => `${r.toUpperCase()}${acc}${q || ''}`,
  )
  return t.trim()
}

function inferKeyFromChords(chords) {
  const normalized = normalizeChordText(chords)
    .split('\n')
    .filter((line) => !/^\s*capo\b/i.test(line))
    .join('\n')

  CHORD_TOKEN_RE.lastIndex = 0
  let match
  while ((match = CHORD_TOKEN_RE.exec(normalized))) {
    const root = match[1] === 'H' ? 'B' : match[1]
    const quality = match[2] || ''
    // Skip bare letters that are likely typos inside words — already \b gated
    const minor = /^(?:m|min)/i.test(quality) && !/^maj/i.test(quality)
    return minor ? `${root}m` : root
  }
  return 'C'
}

function detectKey(title, body, chords, capo) {
  const hay = `${title}\n${body}`
  const fromChords = inferKeyFromChords(chords)
  const ru = parseRuKey(hay)

  // Russian label is concert/sounding key when capo is set → convert to shape key
  if (ru && capo > 0) return transposeKeyLabel(ru, -capo)
  if (ru) return ru

  const explicit = hay.match(EXPLICIT_KEY_RE)
  if (explicit) {
    let k = explicit[1].replace(/^H/, 'B')
    // "(D - ре минор)" → prefer Russian if present
    if (ru) return capo > 0 ? transposeKeyLabel(ru, -capo) : ru
    // Lone "(D)" with capo often means sounding key
    if (capo > 0 && !/[a-zа-я]/i.test(k)) {
      // Prefer chord-inferred shapes when letter disagrees heavily; else back-calc
      return fromChords
    }
    return k
  }

  return fromChords
}

/**
 * @param {string} markdown
 * @returns {{ title: string, key: string, capo: number, chords: string }[]}
 */
export function parseWorshipChordsMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  /** @type {{ title: string, key: string, capo: number, chords: string }[]} */
  const songs = []

  let currentTitle = null
  /** @type {string[]} */
  let bodyLines = []

  function flush() {
    if (!currentTitle) return
    const rawTitle = currentTitle
    const body = bodyLines.join('\n').trim()
    const capo = extractCapo(rawTitle, body)
    const title = cleanTitle(rawTitle)
    const chords = normalizeChordText(body)
    if (!title || !chords) {
      currentTitle = null
      bodyLines = []
      return
    }
    const key = detectKey(rawTitle, body, chords, capo)
    songs.push({ title, key, capo, chords })
    currentTitle = null
    bodyLines = []
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush()
      currentTitle = line.slice(3).trim()
      continue
    }
    if (!currentTitle) continue
    bodyLines.push(line)
  }
  flush()

  const byTitle = new Map()
  for (const song of songs) {
    byTitle.set(song.title.toLowerCase(), song)
  }
  return [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
}
