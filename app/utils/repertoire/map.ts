import type { RepertoireStaleTier } from '~~/shared/repertoire/thresholds'
import type {
  DbRepertoirePulseSummary,
  DbRepertoireSongDetail,
  DbRepertoireSongStat,
  RepertoirePulseSummary,
  RepertoireSongDetail,
  RepertoireSongHint,
  RepertoireSongStat,
} from '~~/shared/types'

function mapStaleTier(raw: string | null | undefined): RepertoireStaleTier | null {
  if (raw === 'cooling' || raw === 'stale' || raw === 'dormant') return raw
  return null
}

function mapHint(row: {
  id: string
  title: string
  last_date: string
  total: number
  first_date: string
  stale_tier?: string | null
}): RepertoireSongHint {
  return {
    id: row.id,
    title: row.title,
    lastDate: row.last_date,
    total: row.total,
    firstDate: row.first_date,
    staleTier: mapStaleTier(row.stale_tier),
  }
}

export function mapPulseSummary(raw: DbRepertoirePulseSummary): RepertoirePulseSummary {
  return {
    executionCount: raw.execution_count ?? 0,
    uniqueSongs: raw.unique_songs ?? 0,
    newSongs: raw.new_songs ?? 0,
    staleCount: raw.stale_count ?? 0,
    from: raw.from,
    to: raw.to,
    staleHint: (raw.stale_hint ?? []).map(mapHint),
    frequentHint: (raw.frequent_hint ?? []).map(mapHint),
  }
}

export function mapSongStat(raw: DbRepertoireSongStat): RepertoireSongStat {
  return {
    songId: raw.song_id,
    title: raw.title,
    executionCount: raw.execution_count ?? 0,
    count30: raw.count_30 ?? 0,
    count90: raw.count_90 ?? 0,
    count365: raw.count_365 ?? 0,
    totalAll: raw.total_all ?? 0,
    firstDate: raw.first_date,
    lastDate: raw.last_date,
    isNewInPeriod: Boolean(raw.is_new_in_period),
    staleTier: mapStaleTier(raw.stale_tier),
    activity: (raw.activity ?? []).map((row) => ({ d: row.d, c: row.c })),
  }
}

export function mapSongDetail(raw: DbRepertoireSongDetail): RepertoireSongDetail {
  return {
    songId: raw.song_id,
    title: raw.title,
    totalAll: raw.total_all ?? 0,
    firstDate: raw.first_date,
    lastDate: raw.last_date,
    performances: (raw.performances ?? []).map((row) => ({
      setlistId: row.setlist_id,
      setlistTitle: row.setlist_title,
      serviceDate: row.service_date,
    })),
    monthly: (raw.monthly ?? []).map((row) => ({ ym: row.ym, c: row.c })),
  }
}
