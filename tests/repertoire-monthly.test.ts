import { describe, expect, it } from 'vitest'
import {
  addMonthsYm,
  fillMonthlyHistory,
  monthlyBarHeightPct,
  monthlySeriesMax,
  monthlySeriesSum,
  monthsInclusive,
} from '../app/utils/repertoire/monthly'

const egypt = [
  { ym: '2024-03', c: 1 },
  { ym: '2024-04', c: 1 },
  { ym: '2024-09', c: 1 },
  { ym: '2024-12', c: 1 },
  { ym: '2025-02', c: 1 },
  { ym: '2025-11', c: 1 },
  { ym: '2025-12', c: 1 },
  { ym: '2026-03', c: 1 },
  { ym: '2026-07', c: 1 },
  { ym: '2026-10', c: 1 },
]

const grace = [
  { ym: '2025-07', c: 1 },
  { ym: '2025-08', c: 1 },
  { ym: '2025-11', c: 2 },
  { ym: '2026-02', c: 1 },
  { ym: '2026-05', c: 1 },
  { ym: '2026-06', c: 1 },
  { ym: '2026-08', c: 1 },
  { ym: '2026-09', c: 1 },
]

const domn = [{ ym: '2026-10', c: 1 }]

describe('fillMonthlyHistory', () => {
  it('monthsInclusive is continuous', () => {
    expect(monthsInclusive('2026-10', '2026-11')).toEqual(['2026-10', '2026-11'])
    expect(addMonthsYm('2025-12', 1)).toBe('2026-01')
  })

  it('12m: 13 months with zero gaps (Egypt)', () => {
    const series = fillMonthlyHistory(egypt, '12m', {
      today: '2026-11-09',
      firstDate: '2024-03-17',
    })
    expect(series).toHaveLength(13)
    expect(series[0]?.ym).toBe('2025-11')
    expect(series.at(-1)?.ym).toBe('2026-11')
    expect(series.find((m) => m.ym === '2025-11')?.c).toBe(1)
    expect(series.find((m) => m.ym === '2026-01')?.c).toBe(0)
    expect(series.find((m) => m.ym === '2026-04')?.c).toBe(0)
    // 2025-11, 12, 2026-03, 07, 10
    expect(monthlySeriesSum(series)).toBe(5)
  })

  it('all: Egypt sum = 10, gaps filled', () => {
    const series = fillMonthlyHistory(egypt, 'all', {
      today: '2026-11-09',
      firstDate: '2024-03-17',
    })
    expect(series[0]?.ym).toBe('2024-03')
    expect(series.at(-1)?.ym).toBe('2026-11')
    expect(monthlySeriesSum(series)).toBe(10)
    expect(series.some((m) => m.c === 0)).toBe(true)
    expect(monthlySeriesMax(series)).toBe(1)
  })

  it('Amazing Grace: Nov has 2, period sum matches', () => {
    const series = fillMonthlyHistory(grace, '12m', {
      today: '2026-11-09',
      firstDate: '2025-07-01',
    })
    expect(series.find((m) => m.ym === '2025-11')?.c).toBe(2)
    // Июл–авг 2025 вне окна 12m+текущий от ноя 2026
    expect(monthlySeriesSum(series)).toBe(7)
    expect(monthlySeriesMax(series)).toBe(2)
    const all = fillMonthlyHistory(grace, 'all', {
      today: '2026-11-09',
      firstDate: '2025-07-01',
    })
    expect(monthlySeriesSum(all)).toBe(9)
  })

  it('Domn: single play is small bar, not full height', () => {
    const series = fillMonthlyHistory(domn, '12m', {
      today: '2026-11-09',
      firstDate: '2026-10-09',
    })
    expect(monthlySeriesSum(series)).toBe(1)
    const max = monthlySeriesMax(series)
    expect(monthlyBarHeightPct(1, max)).toBe(25)
    expect(monthlyBarHeightPct(0, max)).toBe(0)
  })

  it('3m includes zeros', () => {
    const series = fillMonthlyHistory(domn, '3m', {
      today: '2026-11-09',
      firstDate: '2026-10-09',
    })
    expect(series.map((m) => m.ym)).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(series.map((m) => m.c)).toEqual([0, 1, 0])
  })
})
