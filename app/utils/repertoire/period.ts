import {
  REPERTOIRE_THRESHOLDS,
  type RepertoirePeriodKey,
} from '~~/shared/repertoire/thresholds'
import { lookbackFrom } from '~/utils/repertoire/calendar'
import { localTodayKey } from '~/utils/dates'

export const REPERTOIRE_PERIODS: RepertoirePeriodKey[] = ['3m', '6m', '12m', 'all']

export function periodFromKey(
  period: RepertoirePeriodKey,
  today = localTodayKey(),
): { from: string; today: string } {
  if (period === 'all') {
    return { from: '1970-01-01', today }
  }
  const days = REPERTOIRE_THRESHOLDS.periodDays[period]
  return { from: lookbackFrom(today, days), today }
}

export function periodLabelKey(period: RepertoirePeriodKey): string {
  return `repertoire.period.${period}`
}
