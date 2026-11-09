import { REPERTOIRE_THRESHOLDS } from '~~/shared/repertoire/thresholds'
import type { RepertoireSongStat, RepertoireSongStatus } from '~~/shared/types'
import { localTodayKey } from '~/utils/dates'

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T12:00:00`)
  const b = Date.parse(`${toIso}T12:00:00`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

export function daysSinceLastPlay(lastDate: string, today = localTodayKey()): number {
  return daysBetween(lastDate, today)
}

/**
 * Понятный статус без «рейтинга»:
 * - new: впервые в периоде
 * - active: было исполнение за short-окно
 * - cooling: тишина в short, но ещё звучала в medium
 * - stale: давно в ротации и не звучала дольше staleAfterDays
 */
export function classifySongStatus(
  song: Pick<
    RepertoireSongStat,
    'count30' | 'count90' | 'totalAll' | 'firstDate' | 'lastDate' | 'isNewInPeriod'
  >,
  today = localTodayKey(),
  thresholds = REPERTOIRE_THRESHOLDS,
): RepertoireSongStatus {
  if (song.isNewInPeriod) return 'new'

  const since = daysSinceLastPlay(song.lastDate, today)
  const firstAge = daysSinceLastPlay(song.firstDate, today)
  const inRotation =
    song.totalAll >= thresholds.minPerformancesForStale &&
    firstAge >= thresholds.windowDays.medium

  if (inRotation && since >= thresholds.staleAfterDays) return 'stale'
  if (song.count30 > 0) return 'active'
  if (song.count90 > 0) return 'cooling'
  if (inRotation) return 'stale'
  return 'cooling'
}

export function isStaleSong(
  song: Pick<
    RepertoireSongStat,
    'count30' | 'count90' | 'totalAll' | 'firstDate' | 'lastDate' | 'isNewInPeriod'
  >,
  today = localTodayKey(),
  thresholds = REPERTOIRE_THRESHOLDS,
): boolean {
  return classifySongStatus(song, today, thresholds) === 'stale'
}

export function filterStaleHints<T extends {
  firstDate: string
  lastDate: string
  total: number
}>(
  hints: T[],
  today = localTodayKey(),
  thresholds = REPERTOIRE_THRESHOLDS,
): T[] {
  return hints.filter((hint) => {
    const since = daysSinceLastPlay(hint.lastDate, today)
    const firstAge = daysSinceLastPlay(hint.firstDate, today)
    return (
      hint.total >= thresholds.minPerformancesForStale &&
      firstAge >= thresholds.windowDays.medium &&
      since >= thresholds.staleAfterDays
    )
  })
}
