import type { RepertoirePeriodKey } from '~~/shared/repertoire/thresholds'
import type { RepertoireMonthlyBucket } from '~~/shared/types'
import { localTodayKey } from '~/utils/dates'

/** Мягкий потолок шкалы: 1 исполнение не растягивается на всю высоту. */
export const MONTHLY_SCALE_FLOOR = 4

export function ymFromIsoDate(iso: string): string {
  return iso.slice(0, 7)
}

export function currentYm(today = localTodayKey()): string {
  return today.slice(0, 7)
}

export function addMonthsYm(ym: string, delta: number): string {
  const [yearRaw, monthRaw] = ym.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const date = new Date(year, month - 1 + delta, 1)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Сколько месяцев в серии, включая текущий. `all` → null. */
export function monthSpanForPeriod(period: RepertoirePeriodKey): number | null {
  if (period === 'all') return null
  if (period === '3m') return 3
  if (period === '6m') return 6
  // 12 полных + текущий
  return 13
}

export function monthsInclusive(fromYm: string, toYm: string): string[] {
  if (!fromYm || !toYm || fromYm > toYm) return []
  const out: string[] = []
  let cursor = fromYm
  while (cursor <= toYm) {
    out.push(cursor)
    cursor = addMonthsYm(cursor, 1)
    if (out.length > 600) break
  }
  return out
}

export function monthlyRangeForPeriod(
  period: RepertoirePeriodKey,
  opts?: {
    today?: string
    firstDate?: string | null
    sparse?: RepertoireMonthlyBucket[]
  },
): { fromYm: string; toYm: string } {
  const today = opts?.today ?? localTodayKey()
  const toYm = currentYm(today)
  const span = monthSpanForPeriod(period)
  if (span != null) {
    return { fromYm: addMonthsYm(toYm, -(span - 1)), toYm }
  }

  let fromYm = toYm
  if (opts?.firstDate) fromYm = ymFromIsoDate(opts.firstDate)
  for (const row of opts?.sparse ?? []) {
    if (row.ym < fromYm) fromYm = row.ym
  }
  return { fromYm, toYm }
}

/**
 * Полный непрерывный ряд месяцев с нулями на пропуски.
 * Sparse-агрегация с бэка (только месяцы с исполнениями) дополняется на клиенте.
 */
export function fillMonthlyHistory(
  sparse: RepertoireMonthlyBucket[],
  period: RepertoirePeriodKey,
  opts?: { today?: string; firstDate?: string | null },
): RepertoireMonthlyBucket[] {
  const counts = new Map<string, number>()
  for (const row of sparse) {
    counts.set(row.ym, row.c)
  }
  const { fromYm, toYm } = monthlyRangeForPeriod(period, {
    today: opts?.today,
    firstDate: opts?.firstDate,
    sparse,
  })
  return monthsInclusive(fromYm, toYm).map((ym) => ({
    ym,
    c: counts.get(ym) ?? 0,
  }))
}

export function monthlySeriesMax(series: RepertoireMonthlyBucket[]): number {
  let max = 0
  for (const row of series) max = Math.max(max, row.c)
  return max
}

/** Высота относительно visualMax; нули → 0 (без искусственного минимума). */
export function monthlyBarHeightPct(count: number, dataMax: number, floor = MONTHLY_SCALE_FLOOR): number {
  if (count <= 0) return 0
  const visualMax = Math.max(dataMax, floor)
  return Math.round((count / visualMax) * 100)
}

export function monthlySeriesSum(series: RepertoireMonthlyBucket[]): number {
  return series.reduce((acc, row) => acc + row.c, 0)
}
