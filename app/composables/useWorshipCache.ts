import type { SetlistWithItems, Song } from '~~/shared/types'

/** Кэш полных песен по id — листание сет-листа без повторных запросов. */
export function useSongCache() {
  const songById = useState<Record<string, Song>>('songs-by-id-cache', () => ({}))

  function peekSong(id: string): Song | null {
    return songById.value[id] ?? null
  }

  function rememberSong(song: Song) {
    if (songById.value[song.id] === song) return
    songById.value = { ...songById.value, [song.id]: song }
  }

  function rememberSongs(songs: Song[]) {
    if (!songs.length) return
    const next = { ...songById.value }
    let changed = false
    for (const song of songs) {
      if (next[song.id] === song) continue
      next[song.id] = song
      changed = true
    }
    if (changed) songById.value = next
  }

  function forgetSong(id: string) {
    if (!(id in songById.value)) return
    songById.value = Object.fromEntries(
      Object.entries(songById.value).filter(([key]) => key !== id),
    )
  }

  function clearSongs() {
    if (!Object.keys(songById.value).length) return
    songById.value = {}
  }

  return { songById, peekSong, rememberSong, rememberSongs, forgetSong, clearSongs }
}

/** Кэш сет-листов с песнями — home → setlist → songs без вспышек loading. */
export function useSetlistCache() {
  const setlistById = useState<Record<string, SetlistWithItems>>(
    'setlists-by-id-cache',
    () => ({}),
  )

  function peekSetlist(id: string): SetlistWithItems | null {
    return setlistById.value[id] ?? null
  }

  function rememberSetlist(setlist: SetlistWithItems) {
    setlistById.value = { ...setlistById.value, [setlist.id]: setlist }
  }

  function forgetSetlist(id: string) {
    if (!(id in setlistById.value)) return
    setlistById.value = Object.fromEntries(
      Object.entries(setlistById.value).filter(([key]) => key !== id),
    )
  }

  function clearSetlists() {
    if (!Object.keys(setlistById.value).length) return
    setlistById.value = {}
  }

  return { setlistById, peekSetlist, rememberSetlist, forgetSetlist, clearSetlists }
}

/**
 * Прогрев ближайшего сета: кэш сет-листа + все треки + контекст фуллскрина + чанки роутов.
 */
export function warmSetlistSession(setlist: SetlistWithItems) {
  const { rememberSetlist } = useSetlistCache()
  const { rememberSongs } = useSongCache()
  rememberSetlist(setlist)
  rememberSongs(setlist.items.map((item) => item.song))

  const stageSetlist = useState<SetlistWithItems | null>('chord-stage-setlist', () => null)
  if (!stageSetlist.value || stageSetlist.value.id === setlist.id) {
    stageSetlist.value = setlist
  }

  if (!import.meta.client) return
  void preloadRouteComponents(`/setlists/${setlist.id}`)
  for (const item of setlist.items) {
    void preloadRouteComponents(`/songs/${item.songId}`)
  }
}
