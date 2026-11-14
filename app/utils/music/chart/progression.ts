import type { ChartBar, ChordChart, SongLyricsDoc, TimeSignature } from '~~/shared/types'
import { matchSectionHeader } from '~/utils/music/sectionHeaders'
import { cloneBar, createEmptyChart, createSection } from './factory'
import { normalizeLegacyChordsText, parseBarsLine } from './parseLegacyChords'

/**
 * Plain chord text that is a song-wide progression (not a sectioned sheet):
 * «C G Am F - G», «F C G», multi-line without Verse/Chorus headers.
 */
export function isPlainProgression(text: string | null | undefined): boolean {
  const raw = normalizeLegacyChordsText(text)
  if (!raw) return false
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return false
  if (lines.some((l) => matchSectionHeader(l))) return false
  // Long multi-bar sheets without headers still count as progression source
  return lines.length <= 8 && raw.length <= 200
}

/** Parse progression; ` - ` and `|` split bars. */
export function parseProgressionBars(text: string | null | undefined): ChartBar[] {
  const raw = normalizeLegacyChordsText(text)
  if (!raw) return []
  const joined = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' | ')
    .replace(/\s+-\s+/g, ' | ')
  return parseBarsLine(joined)
}

/**
 * Build a chart: one section per lyrics block (same progression cloned),
 * or a single Verse if there are no lyric blocks.
 */
export function chartFromProgressionAndLyrics(
  plain: string | null | undefined,
  lyrics: SongLyricsDoc | null | undefined,
  timeSignature: TimeSignature = '4/4',
): ChordChart {
  const chart = createEmptyChart(timeSignature)
  const template = parseProgressionBars(plain)
  if (!template.length) {
    chart.sections = [createSection('verse')]
    return chart
  }

  const blocks = lyrics?.blocks ?? []
  if (!blocks.length) {
    chart.sections = [createSection('verse', undefined, template.map(cloneBar))]
    return chart
  }

  chart.sections = blocks.map((block) =>
    createSection(
      block.type,
      undefined,
      template.map(cloneBar),
    ),
  )
  return chart
}
