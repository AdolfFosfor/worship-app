/** Local calendar Y-M-D for a Date. */
export function localDayKey(value: Date = new Date()): string {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Сегодняшняя календарная дата устройства (`YYYY-MM-DD`), не UTC. */
export function localTodayKey(now = new Date()): string {
  return localDayKey(now)
}

export function isSameLocalDay(isoDate: string, now = new Date()): boolean {
  try {
    return localDayKey(new Date(`${isoDate}T12:00:00`)) === localDayKey(now)
  } catch {
    return false
  }
}

const LOCALE_TAG: Record<string, string> = {
  ru: 'ru-RU',
  ro: 'ro-RO',
  en: 'en-GB',
}

/** Short pill for setlist service dates; marks today explicitly. */
export function formatServiceDatePill(
  iso: string,
  opts?: { locale?: string; todayPrefix?: (date: string) => string; now?: Date },
): string {
  const now = opts?.now ?? new Date()
  const tag = LOCALE_TAG[opts?.locale ?? 'en'] ?? opts?.locale ?? 'en-GB'
  try {
    const date = new Date(`${iso}T12:00:00`)
    if (isSameLocalDay(iso, now)) {
      const dayMonth = new Intl.DateTimeFormat(tag, {
        day: 'numeric',
        month: 'short',
      }).format(date)
      return opts?.todayPrefix?.(dayMonth) ?? `Today, ${dayMonth}`
    }
    return new Intl.DateTimeFormat(tag, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date)
  } catch {
    return iso
  }
}
