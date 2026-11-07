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
import { getSupabaseBrowserClient } from '~/utils/supabase/client'
import { useAuthStore } from '~/stores/auth'
import { useWorkspaceStore } from '~/stores/workspace'

type SetlistItemJoinRow = DbSetlistItem & { songs: DbSong | null }

/** KeepAlive-страницы подтягивают данные, когда revision изменился. */
export function useSetlistsRevision() {
  const revision = useState('setlists-data-revision', () => 0)

  function bumpSetlistsRevision() {
    revision.value += 1
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
  const setlists = ref<Setlist[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

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
        .select('*')
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

  async function getUpcoming() {
    const workspace = useWorkspaceStore()
    if (!workspace.workspace) return null
    const today = new Date().toISOString().slice(0, 10)
    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase
      .from('setlists')
      .select('*')
      .eq('workspace_id', workspace.workspace.id)
      .gte('service_date', today)
      .order('service_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (qError) throw qError
    return data ? mapSetlist(data as DbSetlist) : null
  }

  async function getSetlist(id: string): Promise<SetlistWithItems> {
    const supabase = getSupabaseBrowserClient()
    const { data: setlistRow, error: setlistError } = await supabase
      .from('setlists')
      .select('*')
      .eq('id', id)
      .single()
    if (setlistError) throw setlistError

    const { data: items, error: itemsError } = await supabase
      .from('setlist_items')
      .select('*, songs(*)')
      .eq('setlist_id', id)
      .order('position', { ascending: true })
    if (itemsError) throw itemsError

    const rows = (items ?? []) as SetlistItemJoinRow[]
    const mappedItems: SetlistItemWithSong[] = rows.map((row) => {
      if (!row.songs) throw new Error('Песня в сет-листе не найдена')
      return {
        ...mapSetlistItem(row),
        song: mapSong(row.songs),
      }
    })

    return {
      ...mapSetlist(setlistRow as DbSetlist),
      items: mappedItems,
    }
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
