import type { EntityId } from './common'
import type { RepertoireStaleTier } from '../repertoire/thresholds'

/** День с числом исполнений (sparse — только дни с активностью). */
export interface RepertoireActivityDay {
  d: string
  c: number
}

export interface RepertoireSongHint {
  id: EntityId
  title: string
  lastDate: string
  total: number
  firstDate: string
  staleTier?: RepertoireStaleTier | null
}

/** @deprecated use RepertoireSongHint */
export type RepertoireStaleHint = RepertoireSongHint

export interface RepertoirePulseSummary {
  executionCount: number
  uniqueSongs: number
  newSongs: number
  staleCount: number
  from: string
  to: string
  staleHint: RepertoireSongHint[]
  frequentHint: RepertoireSongHint[]
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
  staleTier: RepertoireStaleTier | null
  activity: RepertoireActivityDay[]
}

export interface RepertoireSongPerformance {
  setlistId: EntityId
  setlistTitle: string
  serviceDate: string
}

export interface RepertoireMonthlyBucket {
  ym: string
  c: number
}

export interface RepertoireSongDetail {
  songId: EntityId
  title: string
  totalAll: number
  firstDate: string | null
  lastDate: string | null
  performances: RepertoireSongPerformance[]
  monthly: RepertoireMonthlyBucket[]
}

/** Сырой JSON из RPC repertoire_pulse_summary */
export interface DbRepertoirePulseSummary {
  execution_count: number
  unique_songs: number
  new_songs: number
  stale_count: number
  from: string
  to: string
  stale_hint: Array<{
    id: string
    title: string
    last_date: string
    total: number
    first_date: string
    stale_tier?: string | null
  }>
  frequent_hint: Array<{
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
  stale_tier: string | null
  activity: Array<{ d: string; c: number }>
}

export interface DbRepertoireSongDetail {
  song_id: string
  title: string
  total_all: number
  first_date: string | null
  last_date: string | null
  performances: Array<{
    setlist_id: string
    setlist_title: string
    service_date: string
  }>
  monthly: Array<{ ym: string; c: number }>
}

export type RepertoireSongStatus = 'new' | 'active' | 'cooling' | 'stale' | 'dormant'

export type RepertoireSongSort = 'plays' | 'last' | 'first' | 'title'
