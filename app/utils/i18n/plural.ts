export type PluralForm = 'one' | 'few' | 'many'

/** Slavic-style plural pick for RU; EN/RO → one vs many. */
export function pluralForm(count: number, locale: string): PluralForm {
  const n = Math.abs(Math.trunc(count))
  if (locale === 'en' || locale === 'ro') {
    return n === 1 ? 'one' : 'many'
  }
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'one'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few'
  return 'many'
}
