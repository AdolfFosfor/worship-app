import type { RepertoireActivityDay } from '~~/shared/types'
import { localDayKey } from '~/utils/dates'

export type ContributionLevel = 0 | 1 | 2 | 3 | 4

export interface ContributionCell {
  date: string
  count: number
  level: ContributionLevel
  /** Пустая клетка до начала диапазона / после конца. */
  empty?: boolean
}

export interface ContributionWeek {
  days: ContributionCell[]
}

/** Понедельник = 0 … воскресенье = 6 */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return localDayKey(d)
}

function startOfWeekMonday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - mondayIndex(d))
  return localDayKey(d)
}

export function activityMap(activity: RepertoireActivityDay[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of activity) {
    map.set(row.d, row.c)
  }
  return map
}

/** Интенсивность 0–4 по квартилям ненулевых дней (как у GitHub). */
export function contributionLevel(count: number, maxCount: number): ContributionLevel {
  if (count <= 0 || maxCount <= 0) return 0
  if (count === 1 && maxCount === 1) return 1
  const ratio = count / maxCount
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/**
 * Сетка недель (колонки) × дни пн–вс (строки) для диапазона [from, to].
 */
export function buildContributionGrid(
  from: string,
  to: string,
  activity: RepertoireActivityDay[],
): { weeks: ContributionWeek[]; maxCount: number } {
  const counts = activityMap(activity)
  let maxCount = 0
  for (const c of counts.values()) maxCount = Math.max(maxCount, c)

  const gridStart = startOfWeekMonday(from)
  const gridEnd = addDays(startOfWeekMonday(to), 6)

  const weeks: ContributionWeek[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    const days: ContributionCell[] = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(cursor, i)
      const outOfRange = date < from || date > to
      const count = outOfRange ? 0 : (counts.get(date) ?? 0)
      days.push({
        date,
        count,
        level: outOfRange ? 0 : contributionLevel(count, maxCount),
        empty: outOfRange,
      })
    }
    weeks.push({ days })
    cursor = addDays(cursor, 7)
  }

  return { weeks, maxCount }
}

/** Компактный спарклайн: уровни по дням периода (включая нули — равномерно сэмплируем). */
export function buildSparklineLevels(
  from: string,
  to: string,
  activity: RepertoireActivityDay[],
  buckets = 24,
): ContributionLevel[] {
  const counts = activityMap(activity)
  let maxCount = 0
  for (const c of counts.values()) maxCount = Math.max(maxCount, c)

  const start = Date.parse(`${from}T12:00:00`)
  const end = Date.parse(`${to}T12:00:00`)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start || buckets <= 0) {
    return Array.from({ length: buckets }, () => 0 as ContributionLevel)
  }

  const span = end - start
  const levels: ContributionLevel[] = []
  for (let i = 0; i < buckets; i++) {
    const t0 = start + Math.floor((span * i) / buckets)
    const t1 = start + Math.floor((span * (i + 1)) / buckets)
    let sum = 0
    for (let t = t0; t <= t1; t += 86_400_000) {
      sum += counts.get(localDayKey(new Date(t))) ?? 0
    }
    levels.push(contributionLevel(sum, maxCount))
  }
  return levels
}

export function lookbackFrom(today: string, days: number): string {
  return addDays(today, -days)
}

export { addDays, startOfWeekMonday }
