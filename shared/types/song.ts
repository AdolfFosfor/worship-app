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
  chords: string | null
  lyrics: string | null
  youtubeUrl: string | null
  createdBy: EntityId | null
}

export interface SongInput {
  title: string
  key: SongKey
  capo?: number
  chords?: string | null
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
