import { shiftRoot } from './keys'

/**
 * Transpose chord tokens inside free-form chord/lyric text.
 * Matches roots like C, F#, Bb followed by optional quality (m, maj7, sus4…).
 */
const CHORD_TOKEN =
  /\b([A-G](?:#|b)?)((?:maj|min|dim|aug|sus|add|m|M|°|ø)?\d*)(?:\/([A-G](?:#|b)?))?/g

export function transposeChordSymbol(symbol: string, semitones: number): string {
  if (!semitones) return symbol
  return symbol.replace(CHORD_TOKEN, (_full, root: string, quality: string, bass?: string) => {
    const next = shiftRoot(root, semitones) + (quality ?? '')
    if (bass) return `${next}/${shiftRoot(bass, semitones)}`
    return next
  })
}

export function transposeText(text: string | null | undefined, semitones: number): string {
  if (!text) return ''
  if (!semitones) return text
  return text.replace(CHORD_TOKEN, (full) => transposeChordSymbol(full, semitones))
}
