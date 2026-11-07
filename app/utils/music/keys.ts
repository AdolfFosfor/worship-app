import { COMMON_KEYS } from '~~/shared/types'

export const KEY_OPTIONS = COMMON_KEYS.map((value) => ({
  label: value,
  value,
}))

/** Chromatic scale for transposition (sharps preferred). */
export const CHROMATIC = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

const ENHARMONIC: Record<string, string> = {
  Db: 'C#',
  Eb: 'D#',
  Fb: 'E',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
  Cb: 'B',
  'E#': 'F',
  'B#': 'C',
}

export function normalizeRoot(root: string): string {
  const cleaned = root.trim()
  if (!cleaned) return 'C'
  const base = cleaned[0]!.toUpperCase() + cleaned.slice(1)
  return ENHARMONIC[base] ?? base
}

export function parseKey(key: string): { root: string; minor: boolean } {
  const trimmed = key.trim()
  const minor = /m$/i.test(trimmed) && !/^maj/i.test(trimmed.slice(-3))
  const rootPart = minor ? trimmed.replace(/m$/i, '') : trimmed
  return { root: normalizeRoot(rootPart), minor }
}

export function formatKey(root: string, minor: boolean): string {
  return minor ? `${root}m` : root
}

export function semitoneIndex(root: string): number {
  const n = normalizeRoot(root)
  const idx = CHROMATIC.indexOf(n as (typeof CHROMATIC)[number])
  return idx >= 0 ? idx : 0
}

export function shiftRoot(root: string, semitones: number): string {
  const idx = semitoneIndex(root)
  const next = (idx + semitones + 120) % 12
  return CHROMATIC[next]!
}

export function keyDistance(fromKey: string, toKey: string): number {
  const from = parseKey(fromKey)
  const to = parseKey(toKey)
  return (semitoneIndex(to.root) - semitoneIndex(from.root) + 12) % 12
}

export function transposeKeyLabel(key: string, semitones: number): string {
  const { root, minor } = parseKey(key)
  return formatKey(shiftRoot(root, semitones), minor)
}
