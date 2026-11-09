import type { DbSong, Json, Song, SongInput } from '~~/shared/types'
import { mapSong } from '~/utils/mappers'
import { serializeChart } from '~/utils/music/chart'
import { getSupabaseBrowserClient } from '~/utils/supabase/client'
import { useAuthStore } from '~/stores/auth'
import { useWorkspaceStore } from '~/stores/workspace'
import { useSetlistsRevision } from '~/composables/useSetlists'

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
    key: input.key,
    capo: Math.max(0, Math.min(11, Math.round(input.capo ?? 0))),
    bpm,
    chords: chordsFromChart ?? (input.chords?.trim() || null),
    chord_chart: plainChart,
    lyrics: input.lyrics?.trim() || null,
    youtube_url: input.youtubeUrl?.trim() || null,
  }
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
  const songs = ref<Song[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function bumpSongDependents() {
    bumpSongsRevision()
    // Сет-листы кэшируют вложенную песню — тоже инвалидируем
    bumpSetlistsRevision()
  }

  async function fetchSongs(query?: string) {
    const workspace = useWorkspaceStore()
    if (!workspace.workspace) {
      songs.value = []
      return []
    }

    loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      let q = supabase
        .from('songs')
        .select('*')
        .eq('workspace_id', workspace.workspace.id)
        .order('title', { ascending: true })

      const trimmed = query?.trim()
      if (trimmed) {
        q = q.ilike('title', `%${trimmed}%`)
      }

      const { data, error: qError } = await q
      if (qError) throw qError
      songs.value = ((data ?? []) as DbSong[]).map(mapSong)
      return songs.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить песни'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getSong(id: string) {
    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase.from('songs').select('*').eq('id', id).single()
    if (qError) throw qError
    return mapSong(data as DbSong)
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
    bumpSongDependents()
    return song
  }

  async function deleteSong(id: string) {
    const supabase = getSupabaseBrowserClient()
    const { error: qError } = await supabase.from('songs').delete().eq('id', id)
    if (qError) throw qError
    songs.value = songs.value.filter((s) => s.id !== id)
    bumpSongDependents()
  }

  return {
    songs,
    loading,
    error,
    fetchSongs,
    getSong,
    createSong,
    updateSong,
    deleteSong,
  }
}
