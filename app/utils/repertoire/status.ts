import {
  REPERTOIRE_THRESHOLDS,
  type RepertoireStaleTier,
} from '~~/shared/repertoire/thresholds'
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
 * Stale-tier по спеке:
 * - totalAll ≥ 2
 * - first_date старше 90 дней
 * - last_date: dormant ≥180 / stale ≥90 / cooling ≥60
 */
export function staleTierOf(
  song: Pick<RepertoireSongStat, 'totalAll' | 'firstDate' | 'lastDate' | 'staleTier'>,
  today = localTodayKey(),
  thresholds = REPERTOIRE_THRESHOLDS,
): RepertoireStaleTier | null {
  if (song.staleTier) return song.staleTier

  const since = daysSinceLastPlay(song.lastDate, today)
  const firstAge = daysSinceLastPlay(song.firstDate, today)
  const inRotation =
    song.totalAll >= thresholds.minPerformancesForStale &&
    firstAge >= thresholds.windowDays.medium

  if (!inRotation) return null
  if (since >= thresholds.staleTiers.dormant) return 'dormant'
  if (since >= thresholds.staleTiers.stale) return 'stale'
  if (since >= thresholds.staleTiers.cooling) return 'cooling'
  return null
}

export function isStaleSong(
  song: Pick<RepertoireSongStat, 'totalAll' | 'firstDate' | 'lastDate' | 'staleTier'>,
  today = localTodayKey(),
): boolean {
  return staleTierOf(song, today) != null
}

/**
 * Компактный статус для UI: new → stale-tier → active.
 * Не вводит категории «фаворит / в ротации / редко».
 */
export function classifySongStatus(
  song: Pick<
    RepertoireSongStat,
    'totalAll' | 'firstDate' | 'lastDate' | 'isNewInPeriod' | 'staleTier'
  >,
  today = localTodayKey(),
): RepertoireSongStatus {
  if (song.isNewInPeriod) return 'new'
  const tier = staleTierOf(song, today)
  if (tier) return tier
  return 'active'
}

/** Человекочитаемый интервал «N дн./мес. назад». */
export function formatSinceLast(
  lastDate: string,
  t: (key: string, params?: Record<string, string | number>) => string,
  today = localTodayKey(),
): string {
  const days = daysSinceLastPlay(lastDate, today)
  if (days <= 0) return t('repertoire.sinceToday')
  if (days < 30) return t('repertoire.sinceDays', { count: days })
  const months = Math.max(1, Math.round(days / 30))
  if (months < 12) return t('repertoire.sinceMonths', { count: months })
  const years = Math.max(1, Math.round(days / 365))
  return t('repertoire.sinceYears', { count: years })
}
