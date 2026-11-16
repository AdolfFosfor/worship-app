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

  async function fetchSetlists(opts?: { quiet?: boolean }) {
    const workspace = useWorkspaceStore()
    if (!workspace.workspace) {
      setlists.value = []
      return []
    }

    const showLoading = !opts?.quiet
    if (showLoading) loading.value = true
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
      if (showLoading) loading.value = false
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
      .eq('status', 'published')
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
        status: 'draft',
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

  async function resolveAccessToken(): Promise<string> {
    const auth = useAuthStore()
    const supabase = getSupabaseBrowserClient()
    // Never refreshSession here — a stale refresh_token deletes the Auth session.
    const { data: current } = await supabase.auth.getSession()
    if (current.session) auth.session = current.session
    return current.session?.access_token || auth.session?.access_token || ''
  }

  async function reissueAccessToken(): Promise<string> {
    const auth = useAuthStore()
    const telegram = useTelegramApp()
    // Browser mock uses telegram id 10001 (no workspace) — never swap identity there.
    if (!telegram.isTelegramEnvironment.value) return ''
    const initDataRaw = telegram.getInitDataRaw()
    if (!initDataRaw) return ''
    await auth.signInWithTelegram(initDataRaw)
    return auth.session?.access_token || ''
  }

  /** Publish draft → team Telegram DMs (server). */
  async function publishSetlist(id: string) {
    let accessToken = await resolveAccessToken()
    if (!accessToken) {
      accessToken = await reissueAccessToken()
    }
    if (!accessToken) throw new Error('Нет активной сессии')

    type PublishResult = {
      published: boolean
      status: 'published'
      publishedAt: string
      publishedBy: string
      notified: number
      failed: number
    }

    async function postPublish(token: string) {
      return $fetch<PublishResult>(`/api/setlists/${id}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    }

    let result: PublishResult
    try {
      result = await postPublish(accessToken)
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err && 'statusCode' in err
          ? Number((err as { statusCode?: number }).statusCode)
          : typeof err === 'object' && err && 'status' in err
            ? Number((err as { status?: number }).status)
            : 0
      if (status === 409) {
        // Already published (e.g. previous attempt updated DB but failed on notify).
        const nowIso = new Date().toISOString()
        result = {
          published: true,
          status: 'published',
          publishedAt: nowIso,
          publishedBy: '',
          notified: 0,
          failed: 0,
        }
      } else if (status === 401) {
        const fresh = await reissueAccessToken()
        if (!fresh) throw err
        result = await postPublish(fresh)
      } else {
        throw err
      }
    }

    const patch = {
      status: 'published' as const,
      publishedAt: result.publishedAt,
      publishedBy: result.publishedBy || undefined,
    }
    setlists.value = setlists.value.map((s) =>
      s.id === id ? { ...s, ...patch } : s,
    )
    if (upcoming.value?.id === id) {
      upcoming.value = { ...upcoming.value, ...patch }
    }
    const cached = peekSetlist(id)
    if (cached) warmSetlistSession({ ...cached, ...patch })
    bumpSetlistsRevision()
    return result
  }

  /** Dev-only: re-send publish Telegram DMs (no status change). */
  async function resendSetlistNotify(id: string) {
    let accessToken = await resolveAccessToken()
    if (!accessToken) {
      accessToken = await reissueAccessToken()
    }
    if (!accessToken) throw new Error('Нет активной сессии')

    type ResendResult = {
      resent: boolean
      notified: number
      failed: number
    }

    async function postResend(token: string) {
      return $fetch<ResendResult>(`/api/setlists/${id}/notify-resend`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    }

    try {
      return await postResend(accessToken)
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err && 'statusCode' in err
          ? Number((err as { statusCode?: number }).statusCode)
          : typeof err === 'object' && err && 'status' in err
            ? Number((err as { status?: number }).status)
            : 0
      if (status !== 401) throw err
      const fresh = await reissueAccessToken()
      if (!fresh) throw err
      return postResend(fresh)
    }
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

  /** Serialize concurrent DnD so two mid-flight updates cannot collide. */
  let reorderQueue: Promise<void> = Promise.resolve()

  async function reorderItems(setlistId: string, orderedIds: string[]) {
    const run = async () => {
      const supabase = getSupabaseBrowserClient()
      const { error: rpcError } = await supabase.rpc('reorder_setlist_items', {
        p_setlist_id: setlistId,
        p_ordered_ids: orderedIds,
      })
      if (rpcError) throw rpcError
      bumpSetlistsRevision()
    }
    const next = reorderQueue.then(run, run)
    reorderQueue = next.then(
      () => undefined,
      () => undefined,
    )
    await next
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
    publishSetlist,
    resendSetlistNotify,
    songInSetlist,
    addSongToSetlist,
    updateItemKey,
    removeItem,
    reorderItems,
  }
}
