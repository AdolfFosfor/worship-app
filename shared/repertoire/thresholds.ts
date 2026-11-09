/**
 * Единый источник порогов аналитики репертуара (спека Worship Team).
 *
 * Play = distinct (setlist_id, song_id), service_date < today.
 * Frequent = сортировка по execution_count за период (без порога «хит»).
 * New = first_date ∈ [period_from, today).
 * Stale = total_all ≥ 2, first_date старше medium, last_date по tiers ниже.
 * Frequent и stale не взаимоисключающие.
 */
export const REPERTOIRE_THRESHOLDS = {
  /** Период по умолчанию на главной и в hub. */
  defaultPeriod: '12m' as const,

  /** Дни lookback для пресетов периода (all → epoch). */
  periodDays: {
    '3m': 90,
    '6m': 180,
    '12m': 365,
  } as const,

  /**
   * Вспомогательные окна активности (не самостоятельные статусы «фаворит/ротация»).
   * medium = минимальный возраст first_date для попадания в stale.
   */
  windowDays: {
    short: 30,
    medium: 90,
    long: 365,
  },

  /**
   * Песня может попасть в stale только если уже была в ротации:
   * ≥2 исполнений за всё время и first_date старше medium-окна.
   */
  minPerformancesForStale: 2,

  /** Дней без исполнения → интервалы stale (приоритет: dormant > stale > cooling). */
  staleTiers: {
    cooling: 60,
    stale: 90,
    dormant: 180,
  } as const,

  /** Главная: топ frequent и индикатор stale из RPC-подсказки. */
  homeFrequentHintLimit: 3,
  homeStaleHintLimit: 3,

  /** Превью списков на hub до «показать все». */
  sectionPreviewLimit: 8,
} as const

export type RepertoirePeriodKey = '3m' | '6m' | '12m' | 'all'

export type RepertoireStaleTier = 'cooling' | 'stale' | 'dormant'

export type RepertoireThresholds = typeof REPERTOIRE_THRESHOLDS
