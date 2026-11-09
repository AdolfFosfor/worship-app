import type {
  DbRepertoireDayPlay,
  DbRepertoirePulseSummary,
  DbRepertoireSongStat,
  RepertoireDayPlay,
  RepertoirePulseSummary,
  RepertoireSongStat,
} from '~~/shared/types'

export function mapPulseSummary(raw: DbRepertoirePulseSummary): RepertoirePulseSummary {
  return {
    executionCount: raw.execution_count ?? 0,
    uniqueSongs: raw.unique_songs ?? 0,
    newSongs: raw.new_songs ?? 0,
    from: raw.from,
    to: raw.to,
    activity: (raw.activity ?? []).map((row) => ({ d: row.d, c: row.c })),
    staleHint: (raw.stale_hint ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      lastDate: row.last_date,
      total: row.total,
      firstDate: row.first_date,
    })),
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
    activity: (raw.activity ?? []).map((row) => ({ d: row.d, c: row.c })),
  }
}

export function mapDayPlay(raw: DbRepertoireDayPlay): RepertoireDayPlay {
  return {
    setlistId: raw.setlist_id,
    setlistTitle: raw.setlist_title,
    songId: raw.song_id,
    songTitle: raw.song_title,
    position: raw.position,
  }
}
