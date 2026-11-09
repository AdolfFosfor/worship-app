import type { EntityId } from './common'

/** День с числом исполнений (sparse — только дни с активностью). */
export interface RepertoireActivityDay {
  d: string
  c: number
}

export interface RepertoireStaleHint {
  id: EntityId
  title: string
  lastDate: string
  total: number
  firstDate: string
}

export interface RepertoirePulseSummary {
  executionCount: number
  uniqueSongs: number
  newSongs: number
  from: string
  to: string
  activity: RepertoireActivityDay[]
  staleHint: RepertoireStaleHint[]
}

export interface RepertoireSongStat {
  songId: EntityId
  title: string
  executionCount: number
  count30: number
  count90: number
  count365: number
  totalAll: number
  firstDate: string
  lastDate: string
  isNewInPeriod: boolean
  activity: RepertoireActivityDay[]
}

export interface RepertoireDayPlay {
  setlistId: EntityId
  setlistTitle: string
  songId: EntityId
  songTitle: string
  position: number
}

/** Сырой JSON из RPC repertoire_pulse_summary */
export interface DbRepertoirePulseSummary {
  execution_count: number
  unique_songs: number
  new_songs: number
  from: string
  to: string
  activity: Array<{ d: string; c: number }>
  stale_hint: Array<{
    id: string
    title: string
    last_date: string
    total: number
    first_date: string
  }>
}

export interface DbRepertoireSongStat {
  song_id: string
  title: string
  execution_count: number
  count_30: number
  count_90: number
  count_365: number
  total_all: number
  first_date: string
  last_date: string
  is_new_in_period: boolean
  activity: Array<{ d: string; c: number }>
}

export interface DbRepertoireDayPlay {
  setlist_id: string
  setlist_title: string
  song_id: string
  song_title: string
  position: number
}

export type RepertoireSongStatus = 'new' | 'active' | 'cooling' | 'stale'
