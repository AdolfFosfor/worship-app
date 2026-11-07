import type { DbSong, Song, SongInput } from '~~/shared/types'
import { mapSong } from '~/utils/mappers'
import { getSupabaseBrowserClient } from '~/utils/supabase/client'
import { useAuthStore } from '~/stores/auth'
import { useWorkspaceStore } from '~/stores/workspace'

export function useSongs() {
  const songs = ref<Song[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

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
    if (!workspace.workspace || !auth.user) throw new Error('Нет активного workspace')

    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase
      .from('songs')
      .insert({
        workspace_id: workspace.workspace.id,
        title: input.title.trim(),
        key: input.key,
        chords: input.chords?.trim() || null,
        lyrics: input.lyrics?.trim() || null,
        youtube_url: input.youtubeUrl?.trim() || null,
        created_by: auth.user.id,
      })
      .select('*')
      .single()
    if (qError) throw qError
    const song = mapSong(data as DbSong)
    songs.value = [...songs.value, song].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    return song
  }

  async function updateSong(id: string, input: SongInput) {
    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase
      .from('songs')
      .update({
        title: input.title.trim(),
        key: input.key,
        chords: input.chords?.trim() || null,
        lyrics: input.lyrics?.trim() || null,
        youtube_url: input.youtubeUrl?.trim() || null,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (qError) throw qError
    const song = mapSong(data as DbSong)
    songs.value = songs.value.map((s) => (s.id === id ? song : s))
    return song
  }

  async function deleteSong(id: string) {
    const supabase = getSupabaseBrowserClient()
    const { error: qError } = await supabase.from('songs').delete().eq('id', id)
    if (qError) throw qError
    songs.value = songs.value.filter((s) => s.id !== id)
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
