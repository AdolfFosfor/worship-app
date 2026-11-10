import type {
  DbSetlist,
  DbSetlistItem,
  DbSong,
  Setlist,
  SetlistInput,
  SetlistItemWithSong,
  SetlistWithItems,
} from '~~/shared/types'
import { mapSetlist, mapSetlistItem, mapSong } from '~/utils/mappers'
import { localTodayKey } from '~/utils/dates'
import { getSupabaseBrowserClient } from '~/utils/supabase/client'
import { useAuthStore } from '~/stores/auth'
import { useWorkspaceStore } from '~/stores/workspace'

type SetlistItemJoinRow = DbSetlistItem & { songs: DbSong | null }
type SetlistJoinRow = DbSetlist & { setlist_items?: SetlistItemJoinRow[] | null }

function mapJoinedItems(rows: SetlistItemJoinRow[] | null | undefined): SetlistItemWithSong[] {
  return (rows ?? [])
    .map((row) => {
      if (!row.songs) throw new Error('Песня в сет-листе не найдена')
      return {
        ...mapSetlistItem(row),
        song: mapSong(row.songs),
      }
    })
    .sort((a, b) => a.position - b.position)
}

/** KeepAlive-страницы подтягивают данные, когда revision изменился. */
export function useSetlistsRevision() {
  const revision = useState('setlists-data-revision', () => 0)
  const { bumpRepertoirePulseRevision } = useRepertoirePulseRevision()

  function bumpSetlistsRevision() {
    revision.value += 1
    bumpRepertoirePulseRevision()
  }

  function syncSetlistsOnActivate(reload: () => void | Promise<void>) {
    const seen = ref(revision.value)

    onActivated(() => {
      if (seen.value === revision.value) return
      seen.value = revision.value
      void reload()
    })

    return {
      markSetlistsSynced() {
        seen.value = revision.value
      },
    }
  }

  return { setlistsRevision: revision, bumpSetlistsRevision, syncSetlistsOnActivate }
}

export function useSetlists() {
  const { bumpSetlistsRevision } = useSetlistsRevision()
  const { peekSetlist, forgetSetlist } = useSetlistCache()
  const setlists = ref<Setlist[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Общий кэш ближайшего сета с песнями — без второй «вспышки» пиллов на главной/списке. */
  const upcoming = useState<SetlistWithItems | null>('setlists-upcoming-cache', () => null)

  async function fetchSetlists() {
    const workspace = useWorkspaceStore()
    if (!workspace.workspace) {
      setlists.value = []
      return []
    }

    loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase
        .from('setlists')
        .select('*, setlist_items(count)')
        .eq('workspace_id', workspace.workspace.id)
        .order('service_date', { ascending: false })
      if (qError) throw qError
      setlists.value = ((data ?? []) as DbSetlist[]).map(mapSetlist)
      return setlists.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить сет-листы'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getUpcoming(): Promise<SetlistWithItems | null> {
    const workspace = useWorkspaceStore()
    if (!workspace.workspace) {
      upcoming.value = null
      return null
    }
    const today = localTodayKey()
    // Кэш мог пережить смену календарного дня (UTC ≠ локальная дата).
    if (upcoming.value && upcoming.value.serviceDate < today) {
      upcoming.value = null
    }
    const supabase = getSupabaseBrowserClient()
    // Один запрос: сет + песни — UI не мигает пустым hero.
    const { data, error: qError } = await supabase
      .from('setlists')
      .select('*, setlist_items(*, songs(*))')
      .eq('workspace_id', workspace.workspace.id)
      .gte('service_date', today)
      .order('service_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (qError) throw qError
    if (!data) {
      upcoming.value = null
      return null
    }

    const row = data as SetlistJoinRow
    const result: SetlistWithItems = {
      ...mapSetlist(row),
      items: mapJoinedItems(row.setlist_items),
    }
    upcoming.value = result
    warmSetlistSession(result)
    return result
  }

  async function getSetlist(
    id: string,
    opts?: { force?: boolean },
  ): Promise<SetlistWithItems> {
    if (!opts?.force) {
      if (upcoming.value?.id === id) {
        warmSetlistSession(upcoming.value)
        return upcoming.value
      }
      const cached = peekSetlist(id)
      if (cached) return cached
    }

    const supabase = getSupabaseBrowserClient()
    const { data, error: setlistError } = await supabase
      .from('setlists')
      .select('*, setlist_items(*, songs(*))')
      .eq('id', id)
      .single()
    if (setlistError) throw setlistError

    const row = data as SetlistJoinRow
    const result: SetlistWithItems = {
      ...mapSetlist(row),
      items: mapJoinedItems(row.setlist_items),
    }
    if (upcoming.value?.id === result.id) {
      upcoming.value = result
    }
    warmSetlistSession(result)
    return result
  }

  async function createSetlist(input: SetlistInput) {
    const auth = useAuthStore()
    const workspace = useWorkspaceStore()
    if (!workspace.workspace || !auth.user) throw new Error('Нет активного workspace')

    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase
      .from('setlists')
      .insert({
        workspace_id: workspace.workspace.id,
        title: input.title.trim(),
        service_date: input.serviceDate,
        created_by: auth.user.id,
      })
      .select('*')
      .single()
    if (qError) throw qError
    const setlist = mapSetlist(data as DbSetlist)
    setlists.value = [setlist, ...setlists.value]
    bumpSetlistsRevision()
    return setlist
  }

  async function updateSetlist(id: string, input: SetlistInput) {
    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase
      .from('setlists')
      .update({
        title: input.title.trim(),
        service_date: input.serviceDate,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (qError) throw qError
    const setlist = mapSetlist(data as DbSetlist)
    setlists.value = setlists.value.map((s) => (s.id === id ? setlist : s))
    bumpSetlistsRevision()
    return setlist
  }

  async function deleteSetlist(id: string) {
    const supabase = getSupabaseBrowserClient()
    const { error: qError } = await supabase.from('setlists').delete().eq('id', id)
    if (qError) throw qError
    setlists.value = setlists.value.filter((s) => s.id !== id)
    forgetSetlist(id)
    if (upcoming.value?.id === id) upcoming.value = null
    const stageSetlist = useState<SetlistWithItems | null>('chord-stage-setlist', () => null)
    if (stageSetlist.value?.id === id) stageSetlist.value = null
    bumpSetlistsRevision()
  }

  async function songInSetlist(setlistId: string, songId: string) {
    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase
      .from('setlist_items')
      .select('id')
      .eq('setlist_id', setlistId)
      .eq('song_id', songId)
      .limit(1)
      .maybeSingle()
    if (qError) throw qError
    return Boolean(data)
  }

  async function addSongToSetlist(
    setlistId: string,
    songId: string,
    key: string | null = null,
  ) {
    const supabase = getSupabaseBrowserClient()
    const { data: existing, error: existingError } = await supabase
      .from('setlist_items')
      .select('position')
      .eq('setlist_id', setlistId)
      .order('position', { ascending: false })
      .limit(1)
    if (existingError) throw existingError
    const nextPos = ((existing?.[0] as { position?: number } | undefined)?.position ?? -1) + 1

    const { data, error: qError } = await supabase
      .from('setlist_items')
      .insert({
        setlist_id: setlistId,
        song_id: songId,
        position: nextPos,
        key,
      })
      .select('*, songs(*)')
      .single()
    if (qError) throw qError

    const row = data as SetlistItemJoinRow
    if (!row.songs) throw new Error('Песня не найдена')

    bumpSetlistsRevision()
    return {
      ...mapSetlistItem(row),
      song: mapSong(row.songs),
    } satisfies SetlistItemWithSong
  }

  async function updateItemKey(itemId: string, key: string | null) {
    const supabase = getSupabaseBrowserClient()
    const { error: qError } = await supabase
      .from('setlist_items')
      .update({ key })
      .eq('id', itemId)
    if (qError) throw qError
    bumpSetlistsRevision()
  }

  async function removeItem(itemId: string) {
    const supabase = getSupabaseBrowserClient()
    const { error: qError } = await supabase.from('setlist_items').delete().eq('id', itemId)
    if (qError) throw qError
    bumpSetlistsRevision()
  }

  async function reorderItems(setlistId: string, orderedIds: string[]) {
    const supabase = getSupabaseBrowserClient()
    for (let i = 0; i < orderedIds.length; i++) {
      const { error: e1 } = await supabase
        .from('setlist_items')
        .update({ position: 1000 + i })
        .eq('id', orderedIds[i]!)
        .eq('setlist_id', setlistId)
      if (e1) throw e1
    }
    for (let i = 0; i < orderedIds.length; i++) {
      const { error: e2 } = await supabase
        .from('setlist_items')
        .update({ position: i })
        .eq('id', orderedIds[i]!)
        .eq('setlist_id', setlistId)
      if (e2) throw e2
    }
    bumpSetlistsRevision()
  }

  return {
    setlists,
    loading,
    error,
    upcoming,
    peekSetlist,
    fetchSetlists,
    getUpcoming,
    getSetlist,
    createSetlist,
    updateSetlist,
    deleteSetlist,
    songInSetlist,
    addSongToSetlist,
    updateItemKey,
    removeItem,
    reorderItems,
  }
}
