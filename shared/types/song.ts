import type { ChordChart } from './chordChart'
import type { EntityId, Timestamps } from './common'

/** Musical key label, e.g. "C", "Am", "F#". */
export type SongKey = string

export interface Song extends Timestamps {
  id: EntityId
  workspaceId: EntityId
  title: string
  key: SongKey
  /** Capo fret (0 = none). Chords are written as shapes with this capo. */
  capo: number
  /** Optional tempo in BPM; null when unset. */
  bpm: number | null
  /** Legacy / denormalized plain-text chord sheet. */
  chords: string | null
  /** Structured chord chart (preferred when present). */
  chordChart: ChordChart | null
  lyrics: string | null
  youtubeUrl: string | null
  createdBy: EntityId | null
}

export interface SongInput {
  title: string
  key: SongKey
  capo?: number
  bpm?: number | null
  chords?: string | null
  chordChart?: ChordChart | null
  lyrics?: string | null
  youtubeUrl?: string | null
}

export const COMMON_KEYS = [
  'C',
  'C#',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
  'Cm',
  'C#m',
  'Dm',
  'Ebm',
  'Em',
  'Fm',
  'F#m',
  'Gm',
  'Abm',
  'Am',
  'Bbm',
  'Bm',
] as const
