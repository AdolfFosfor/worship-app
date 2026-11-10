import type { DbSong, Json, Song, SongInput } from '~~/shared/types'
import {
  normalizeArtist,
  normalizeLibraryFilters,
  normalizeThemes,
  normalizeTimeSignature,
  normalizeTypes,
  TEMPO_BPM,
  type SongLibraryFilters,
} from '~~/shared/songs/library'
import { mapSong } from '~/utils/mappers'
import { soundingKey } from '~/utils/music/capo'
import { serializeChart } from '~/utils/music/chart'
import { localTodayKey } from '~/utils/dates'
import { getSupabaseBrowserClient } from '~/utils/supabase/client'
import { useAuthStore } from '~/stores/auth'
import { useWorkspaceStore } from '~/stores/workspace'
import { useSetlistsRevision } from '~/composables/useSetlists'

export interface SongFetchOptions {
  search?: string
  filters?: Partial<SongLibraryFilters>
}

export interface SongLibraryFacets {
  themes: string[]
  timeSignatures: string[]
}

/** KeepAlive-страницы подтягивают данные, когда revision изменился. */
export function useSongsRevision() {
  const revision = useState('songs-data-revision', () => 0)

  function bumpSongsRevision() {
    revision.value += 1
  }

  function syncSongsOnActivate(reload: () => void | Promise<void>) {
    const seen = ref(revision.value)

    onActivated(() => {
      if (seen.value === revision.value) return
      seen.value = revision.value
      void reload()
    })

    return {
      markSongsSynced() {
        seen.value = revision.value
      },
    }
  }

  return { songsRevision: revision, bumpSongsRevision, syncSongsOnActivate }
}

function songWritePayload(input: SongInput) {
  const chart = input.chordChart ?? null
  const hasChart = Boolean(chart?.sections?.length)
  const plainChart = hasChart ? (JSON.parse(JSON.stringify(chart)) as Json) : null
  const chordsFromChart = hasChart ? serializeChart(chart) : null
  const bpmRaw = input.bpm
  const bpm =
    bpmRaw == null || !Number.isFinite(bpmRaw)
      ? null
      : Math.max(30, Math.min(300, Math.round(bpmRaw)))

  return {
    title: input.title.trim(),
    artist: normalizeArtist(input.artist),
    key: input.key,
    capo: Math.max(0, Math.min(11, Math.round(input.capo ?? 0))),
    bpm,
    types: normalizeTypes(input.types),
    themes: normalizeThemes(input.themes),
    time_signature: normalizeTimeSignature(input.timeSignature),
    chords: chordsFromChart ?? (input.chords?.trim() || null),
    chord_chart: plainChart,
    lyrics: input.lyrics?.trim() || null,
    youtube_url: input.youtubeUrl?.trim() || null,
  }
}

function resolveFetchOptions(query?: string | SongFetchOptions): {
  search: string
  filters: SongLibraryFilters
} {
  if (typeof query === 'string' || query == null) {
    return { search: query?.trim() ?? '', filters: normalizeLibraryFilters(null) }
  }
  return {
    search: query.search?.trim() ?? '',
    filters: normalizeLibraryFilters(query.filters),
  }
}

/** PostgREST `or` value: `*` is the wildcard, quotes keep commas and dots literal. */
function ilikeOr(column: string, raw: string): string {
  const escaped = raw
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '""')
    .replace(/\*/g, '\\*')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
  return `${column}.ilike."*${escaped}*"`
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function queryErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return 'Неизвестная ошибка'
  if (error.code === 'PGRST116') {
    return 'Не удалось сохранить — нет прав или сессия истекла. Войдите снова.'
  }
  if (error.code === 'PGRST301' || /jwt|session|auth/i.test(error.message ?? '')) {
    return 'Сессия истекла — войдите снова'
  }
  return error.message || 'Ошибка запроса'
}

async function requireAuthSession() {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(queryErrorMessage(error))
  if (!data.session) throw new Error('Сессия истекла — войдите снова')
  return data.session
}

export function useSongs() {
  const { bumpSongsRevision } = useSongsRevision()
  const { bumpSetlistsRevision } = useSetlistsRevision()
  const { peekSong, rememberSong, rememberSongs, forgetSong } = useSongCache()
  const songs = ref<Song[]>([])
  const facets = ref<SongLibraryFacets>({ themes: [], timeSignatures: [] })
  const loading = ref(false)
  const error = ref<string | null>(null)
  let fetchSeq = 0

  function bumpSongDependents() {
    bumpSongsRevision()
    // Сет-листы кэшируют вложенную песню — тоже инвалидируем
    bumpSetlistsRevision()
  }

  async function fetchSongs(query?: string | SongFetchOptions) {
    const workspace = useWorkspaceStore()
    const gen = ++fetchSeq
    if (!workspace.workspace) {
      songs.value = []
      loading.value = false
      return []
    }

    const { search, filters } = resolveFetchOptions(query)
    loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      let q = supabase
        .from('songs')
        .select('*')
        .eq('workspace_id', workspace.workspace.id)
        .order('title', { ascending: true })

      if (search) {
        q = q.or(`${ilikeOr('title', search)},${ilikeOr('artist', search)}`)
      }
      if (filters.types.length) q = q.overlaps('types', filters.types)
      if (filters.themes.length) q = q.overlaps('themes', filters.themes)
      if (filters.timeSignatures.length) q = q.in('time_signature', filters.timeSignatures)
      if (filters.keys.length) {
        const sounding = [...new Set(filters.keys.map((key) => soundingKey(key, 0)))]
        q = q.in('sounding_key', sounding)
      }
      if (filters.tempos.length) {
        const tempoOr = filters.tempos
          .map((tempo) => {
            const range = TEMPO_BPM[tempo]
            return `and(bpm.gte.${range.min},bpm.lte.${range.max})`
          })
          .join(',')
        q = q.or(tempoOr)
      }
      if (filters.activity.length) {
        const { data: activityIds, error: activityError } = await supabase.rpc(
          'song_activity_ids',
          {
            p_workspace_id: workspace.workspace.id,
            p_kinds: filters.activity,
            p_today: localTodayKey(),
          },
        )
        if (activityError) throw activityError
        const ids = stringList(activityIds)
        if (!ids.length) {
          if (gen !== fetchSeq) return songs.value
          songs.value = []
          return []
        }
        q = q.in('id', ids)
      }

      const { data, error: qError } = await q
      if (qError) throw qError
      if (gen !== fetchSeq) return songs.value
      songs.value = ((data ?? []) as DbSong[]).map(mapSong)
      rememberSongs(songs.value)
      return songs.value
    } catch (e) {
      if (gen !== fetchSeq) return songs.value
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить песни'
      throw e
    } finally {
      if (gen === fetchSeq) loading.value = false
    }
  }

  async function fetchLibraryFacets() {
    const workspace = useWorkspaceStore()
    if (!workspace.workspace) {
      facets.value = { themes: [], timeSignatures: [] }
      return facets.value
    }
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase.rpc('song_library_facets', {
        p_workspace_id: workspace.workspace.id,
      })
      if (qError) throw qError
      const raw = (data ?? {}) as { themes?: unknown; timeSignatures?: unknown }
      facets.value = {
        themes: stringList(raw.themes),
        timeSignatures: stringList(raw.timeSignatures),
      }
      return facets.value
    } catch {
      return facets.value
    }
  }

  async function getSong(id: string, opts?: { force?: boolean }) {
    if (!opts?.force) {
      const cached = peekSong(id)
      if (cached) return cached
    }
    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase.from('songs').select('*').eq('id', id).single()
    if (qError) throw qError
    const song = mapSong(data as DbSong)
    rememberSong(song)
    return song
  }

  async function createSong(input: SongInput) {
    const auth = useAuthStore()
    const workspace = useWorkspaceStore()
    await requireAuthSession()
    if (!workspace.workspace || !auth.user) throw new Error('Нет активного workspace')

    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase
      .from('songs')
      .insert({
        workspace_id: workspace.workspace.id,
        ...songWritePayload(input),
        created_by: auth.user.id,
      })
      .select('*')
      .single()
    if (qError) throw new Error(queryErrorMessage(qError))
    const song = mapSong(data as DbSong)
    songs.value = [...songs.value, song].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    rememberSong(song)
    bumpSongDependents()
    return song
  }

  async function updateSong(id: string, input: SongInput) {
    await requireAuthSession()
    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase
      .from('songs')
      .update(songWritePayload(input))
      .eq('id', id)
      .select('*')
      .single()
    if (qError) throw new Error(queryErrorMessage(qError))
    const song = mapSong(data as DbSong)
    songs.value = songs.value.map((s) => (s.id === id ? song : s))
    rememberSong(song)
    bumpSongDependents()
    return song
  }

  async function deleteSong(id: string) {
    const supabase = getSupabaseBrowserClient()
    const { error: qError } = await supabase.from('songs').delete().eq('id', id)
    if (qError) throw qError
    songs.value = songs.value.filter((s) => s.id !== id)
    forgetSong(id)
    bumpSongDependents()
  }

  return {
    songs,
    facets,
    loading,
    error,
    peekSong,
    fetchSongs,
    fetchLibraryFacets,
    getSong,
    createSong,
    updateSong,
    deleteSong,
  }
}
