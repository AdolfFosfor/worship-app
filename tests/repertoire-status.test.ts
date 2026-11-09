import { describe, expect, it } from 'vitest'
import { classifySongStatus, isStaleSong, staleTierOf } from '../app/utils/repertoire/status'

const today = '2026-11-09'

function song(partial: {
  totalAll: number
  firstDate: string
  lastDate: string
  isNewInPeriod?: boolean
}) {
  return {
    totalAll: partial.totalAll,
    firstDate: partial.firstDate,
    lastDate: partial.lastDate,
    staleTier: null as null,
    isNewInPeriod: partial.isNewInPeriod ?? false,
    count30: 0,
    count90: 0,
  }
}

describe('repertoire stale rules (spec §5)', () => {
  it('6. one play → not stale', () => {
    const s = song({ totalAll: 1, firstDate: '2025-01-01', lastDate: '2025-01-01' })
    expect(isStaleSong(s, today)).toBe(false)
    expect(staleTierOf(s, today)).toBeNull()
  })

  it('7. two plays but first < 90 days ago → not stale', () => {
    const s = song({ totalAll: 2, firstDate: '2026-09-01', lastDate: '2026-09-01' })
    expect(isStaleSong(s, today)).toBe(false)
  })

  it('8. cooling at 60 days', () => {
    const s = song({ totalAll: 2, firstDate: '2025-01-01', lastDate: '2026-09-10' })
    expect(staleTierOf(s, today)).toBe('cooling')
  })

  it('9. stale at 90 days', () => {
    const s = song({ totalAll: 2, firstDate: '2025-01-01', lastDate: '2026-08-11' })
    expect(staleTierOf(s, today)).toBe('stale')
  })

  it('10. dormant at 180 days', () => {
    const s = song({ totalAll: 2, firstDate: '2025-01-01', lastDate: '2026-05-13' })
    expect(staleTierOf(s, today)).toBe('dormant')
  })

  it('no history → not stale', () => {
    const s = song({ totalAll: 0, firstDate: today, lastDate: today })
    expect(isStaleSong(s, today)).toBe(false)
  })

  it('new takes priority over stale-tier in classify', () => {
    const s = song({
      totalAll: 3,
      firstDate: '2025-01-01',
      lastDate: '2026-01-01',
      isNewInPeriod: true,
    })
    expect(classifySongStatus(s, today)).toBe('new')
  })

  it('active when recently played and in rotation', () => {
    const s = song({ totalAll: 5, firstDate: '2025-01-01', lastDate: '2026-11-01' })
    expect(classifySongStatus(s, today)).toBe('active')
  })
})
