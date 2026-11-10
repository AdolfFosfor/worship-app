/** Каталог библиотеки песен: типы, темы, темп из BPM, активность. */

export const SONG_TYPES = ['worship', 'praise', 'thanksgiving', 'prayer'] as const
export type SongType = (typeof SONG_TYPES)[number]

export const SONG_THEMES = [
  'gods_love',
  'faith',
  'grace',
  'cross',
  'resurrection',
  'salvation',
  'faithfulness',
] as const
export type SongThemeId = (typeof SONG_THEMES)[number]

export const SONG_TEMPOS = ['slow', 'medium', 'fast'] as const
export type SongTempo = (typeof SONG_TEMPOS)[number]

export const SONG_ACTIVITIES = ['frequent', 'new', 'stale'] as const
export type SongActivity = (typeof SONG_ACTIVITIES)[number]

export const SONG_METERS = ['4/4', '3/4', '6/8', '2/4', '12/8'] as const

/** Пороги темпа по уже сохранённому BPM. Песня без BPM ни в одну группу не входит. */
export const TEMPO_BPM: Record<SongTempo, { min: number; max: number }> = {
  slow: { min: 30, max: 79 },
  medium: { min: 80, max: 119 },
  fast: { min: 120, max: 300 },
}

export const SONG_ARTIST_MAX = 120
export const SONG_THEME_MAX = 40
export const SONG_THEME_LIMIT = 12

const TIME_SIGNATURE = /^[1-9]\d?\/[1-9]\d?$/

export interface SongLibraryFilters {
  types: SongType[]
  themes: string[]
  tempos: SongTempo[]
  keys: string[]
  timeSignatures: string[]
  activity: SongActivity[]
}

export function emptySongLibraryFilters(): SongLibraryFilters {
  return {
    types: [],
    themes: [],
    tempos: [],
    keys: [],
    timeSignatures: [],
    activity: [],
  }
}

export function isSongType(value: string): value is SongType {
  return (SONG_TYPES as readonly string[]).includes(value)
}

export function isSongThemeId(value: string): value is SongThemeId {
  return (SONG_THEMES as readonly string[]).includes(value)
}

export function isSongTempo(value: string): value is SongTempo {
  return (SONG_TEMPOS as readonly string[]).includes(value)
}

export function isSongActivity(value: string): value is SongActivity {
  return (SONG_ACTIVITIES as readonly string[]).includes(value)
}

export function songThemeMessageKey(theme: string): string | null {
  return isSongThemeId(theme) ? `songs.theme.${theme}` : null
}

export function normalizeArtist(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null
  return trimmed.slice(0, SONG_ARTIST_MAX)
}

export function normalizeTypes(value: readonly string[] | null | undefined): SongType[] {
  const selected = new Set(value ?? [])
  return SONG_TYPES.filter((type) => selected.has(type))
}

export function normalizeThemes(value: readonly string[] | null | undefined): string[] {
  const out: string[] = []
  for (const item of value ?? []) {
    const theme = item.trim()
    if (!theme || theme.length > SONG_THEME_MAX) continue
    const duplicate = out.some(
      (existing) => existing.localeCompare(theme, undefined, { sensitivity: 'accent' }) === 0,
    )
    if (duplicate) continue
    out.push(theme)
    if (out.length >= SONG_THEME_LIMIT) break
  }
  return out
}

export function normalizeTimeSignature(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!TIME_SIGNATURE.test(trimmed)) return null
  return trimmed
}

export function normalizeLibraryFilters(
  filters: Partial<SongLibraryFilters> | null | undefined,
): SongLibraryFilters {
  const keys: string[] = []
  for (const key of filters?.keys ?? []) {
    const trimmed = key.trim()
    if (trimmed && !keys.includes(trimmed)) keys.push(trimmed)
  }
  const timeSignatures: string[] = []
  for (const signature of filters?.timeSignatures ?? []) {
    const normalized = normalizeTimeSignature(signature)
    if (normalized && !timeSignatures.includes(normalized)) timeSignatures.push(normalized)
  }
  return {
    types: normalizeTypes(filters?.types),
    themes: normalizeThemes(filters?.themes),
    tempos: SONG_TEMPOS.filter((tempo) => filters?.tempos?.includes(tempo)),
    keys,
    timeSignatures,
    activity: SONG_ACTIVITIES.filter((kind) => filters?.activity?.includes(kind)),
  }
}

export function libraryFiltersActive(filters: SongLibraryFilters): boolean {
  return (
    filters.types.length > 0 ||
    filters.themes.length > 0 ||
    filters.tempos.length > 0 ||
    filters.keys.length > 0 ||
    filters.timeSignatures.length > 0 ||
    filters.activity.length > 0
  )
}
