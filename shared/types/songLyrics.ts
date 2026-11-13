import type { SectionType } from './chordChart'

/** Chord marker on a lyric line — symbol resolved live from chord_chart by itemId. */
export interface LyricChordAnchor {
  id: string
  /** Chart BarItem id (chord preferred). */
  itemId: string
  /** Character offset in LyricLine.text (0 = before first char). */
  offset: number
}

export interface LyricLine {
  id: string
  text: string
  anchors: LyricChordAnchor[]
}

export interface LyricBlock {
  id: string
  type: SectionType
  title?: string
  /** chord_chart section that supplies chord symbols for anchors. */
  chartSectionId: string | null
  lines: LyricLine[]
}

export interface SongLyricsDoc {
  v: 1
  blocks: LyricBlock[]
}
