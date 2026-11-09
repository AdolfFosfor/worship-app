import {
  REPERTOIRE_THRESHOLDS,
  type RepertoirePeriodKey,
} from '~~/shared/repertoire/thresholds'
import type {
  DbRepertoirePulseSummary,
  DbRepertoireSongDetail,
  DbRepertoireSongStat,
  RepertoirePulseSummary,
  RepertoireSongDetail,
  RepertoireSongStat,
} from '~~/shared/types'
import { periodFromKey } from '~/utils/repertoire/period'
import { mapPulseSummary, mapSongDetail, mapSongStat } from '~/utils/repertoire/map'
import { localTodayKey } from '~/utils/dates'
import { getSupabaseBrowserClient } from '~/utils/supabase/client'
import { useWorkspaceStore } from '~/stores/workspace'

/** KeepAlive / мутации сетов — перезагрузка pulse. */
export function useRepertoirePulseRevision() {
  const revision = useState('repertoire-pulse-revision', () => 0)
  const summary = useState<RepertoirePulseSummary | null>('repertoire-pulse-summary', () => null)
  const songs = useState<RepertoireSongStat[] | null>('repertoire-pulse-songs', () => null)
  const cachedPeriod = useState<RepertoirePeriodKey | null>('repertoire-pulse-period', () => null)

  function bumpRepertoirePulseRevision() {
    revision.value += 1
    summary.value = null
    songs.value = null
    cachedPeriod.value = null
  }

  function syncRepertoireOnActivate(reload: () => void | Promise<void>) {
    const seen = ref(revision.value)

    onActivated(() => {
      if (seen.value === revision.value) return
      seen.value = revision.value
      void reload()
    })

    return {
      markRepertoireSynced() {
        seen.value = revision.value
      },
    }
  }

  return {
    repertoirePulseRevision: revision,
    bumpRepertoirePulseRevision,
    syncRepertoireOnActivate,
  }
}

export function useRepertoirePulse() {
  const summary = useState<RepertoirePulseSummary | null>('repertoire-pulse-summary', () => null)
  const songs = useState<RepertoireSongStat[] | null>('repertoire-pulse-songs', () => null)
  const cachedPeriod = useState<RepertoirePeriodKey | null>('repertoire-pulse-period', () => null)
  const period = useState<RepertoirePeriodKey>(
    'repertoire-pulse-period-ui',
    () => REPERTOIRE_THRESHOLDS.defaultPeriod,
  )
  const loadingSummary = ref(false)
  const loadingSongs = ref(false)
  const loadingDetail = ref(false)
  const error = ref<string | null>(null)

  function boundsFor(p: RepertoirePeriodKey = period.value) {
    return periodFromKey(p, localTodayKey())
  }

  function cacheMatches(p: RepertoirePeriodKey) {
    return cachedPeriod.value === p
  }

  async function fetchSummary(opts?: { force?: boolean; period?: RepertoirePeriodKey }) {
    const workspace = useWorkspaceStore()
    const nextPeriod = opts?.period ?? period.value
    if (!workspace.workspace) {
      summary.value = null
      return null
    }

    if (summary.value && cacheMatches(nextPeriod) && !opts?.force) return summary.value

    loadingSummary.value = true
    error.value = null
    try {
      const { from, today } = boundsFor(nextPeriod)
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase.rpc('repertoire_pulse_summary', {
        p_workspace_id: workspace.workspace.id,
        p_from: from,
        p_today: today,
      })
      if (qError) throw qError
      summary.value = mapPulseSummary(data as DbRepertoirePulseSummary)
      period.value = nextPeriod
      cachedPeriod.value = nextPeriod
      return summary.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить пульс репертуара'
      throw e
    } finally {
      loadingSummary.value = false
    }
  }

  async function fetchSongs(opts?: { force?: boolean; period?: RepertoirePeriodKey }) {
    const workspace = useWorkspaceStore()
    const nextPeriod = opts?.period ?? period.value
    if (!workspace.workspace) {
      songs.value = null
      return []
    }

    if (songs.value && cacheMatches(nextPeriod) && !opts?.force) return songs.value

    loadingSongs.value = true
    error.value = null
    try {
      const { from, today } = boundsFor(nextPeriod)
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase.rpc('repertoire_pulse_songs', {
        p_workspace_id: workspace.workspace.id,
        p_from: from,
        p_today: today,
      })
      if (qError) throw qError
      const rows = (data ?? []) as DbRepertoireSongStat[]
      songs.value = rows.map(mapSongStat)
      period.value = nextPeriod
      cachedPeriod.value = nextPeriod
      return songs.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить статистику песен'
      throw e
    } finally {
      loadingSongs.value = false
    }
  }

  async function setPeriod(next: RepertoirePeriodKey) {
    if (period.value === next && cacheMatches(next) && summary.value && songs.value) {
      return
    }
    period.value = next
    await Promise.all([
      fetchSummary({ force: true, period: next }),
      fetchSongs({ force: true, period: next }),
    ])
  }

  async function fetchSongDetail(songId: string): Promise<RepertoireSongDetail | null> {
    const workspace = useWorkspaceStore()
    if (!workspace.workspace) return null

    loadingDetail.value = true
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase.rpc('repertoire_song_detail', {
        p_workspace_id: workspace.workspace.id,
        p_song_id: songId,
        p_today: localTodayKey(),
      })
      if (qError) throw qError
      if (!data) return null
      return mapSongDetail(data as DbRepertoireSongDetail)
    } finally {
      loadingDetail.value = false
    }
  }

  async function refreshAll() {
    await Promise.all([
      fetchSummary({ force: true, period: period.value }),
      fetchSongs({ force: true, period: period.value }),
    ])
  }

  return {
    summary,
    songs,
    period,
    loadingSummary,
    loadingSongs,
    loadingDetail,
    error,
    fetchSummary,
    fetchSongs,
    setPeriod,
    fetchSongDetail,
    refreshAll,
    periodBounds: boundsFor,
  }
}
