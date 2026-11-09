import { shiftRoot } from './keys'

/**
 * Chord token as a whole word — never a prefix of "Bridge", "Bass", etc.
 * Root + optional quality + optional slash bass; must not be followed by a letter.
 */
const CHORD_TOKEN =
  /\b([A-G](?:#|b)?)((?:maj|min|dim|aug|sus|add|m|M|°|ø)?\d*(?:sus\d+|add\d+|maj\d+|m\d+|dim|aug)?)?(?:\/([A-G](?:#|b)?))?(?![A-Za-z])/g

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
