import type { SongActivity, SongTempo, SongType } from '../songs/library'
import type { ChordChart } from './chordChart'
import type { EntityId, Timestamps } from './common'

/** Musical key label, e.g. "C", "Am", "F#". */
export type SongKey = string

export interface Song extends Timestamps {
  id: EntityId
  workspaceId: EntityId
  title: string
  /** Performer. Null until set. */
  artist: string | null
  key: SongKey
  /** Capo fret (0 = none). Chords are written as shapes with this capo. */
  capo: number
  /** Optional tempo in BPM; null when unset. */
  bpm: number | null
  /** Song types. Empty until set. */
  types: SongType[]
  /** Catalog slugs or custom labels. Empty until set. */
  themes: string[]
  /** Meter such as 4/4. Null until set. */
  timeSignature: string | null
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
  artist?: string | null
  key: SongKey
  capo?: number
  bpm?: number | null
  types?: SongType[]
  themes?: string[]
  timeSignature?: string | null
  chords?: string | null
  chordChart?: ChordChart | null
  lyrics?: string | null
  youtubeUrl?: string | null
}

export type { SongActivity, SongTempo, SongType }

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
