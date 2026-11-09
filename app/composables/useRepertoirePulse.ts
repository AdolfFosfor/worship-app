import { REPERTOIRE_THRESHOLDS } from '~~/shared/repertoire/thresholds'
import type {
  DbRepertoireDayPlay,
  DbRepertoirePulseSummary,
  DbRepertoireSongStat,
  RepertoireDayPlay,
  RepertoirePulseSummary,
  RepertoireSongStat,
} from '~~/shared/types'
import { lookbackFrom } from '~/utils/repertoire/calendar'
import { mapDayPlay, mapPulseSummary, mapSongStat } from '~/utils/repertoire/map'
import { localTodayKey } from '~/utils/dates'
import { getSupabaseBrowserClient } from '~/utils/supabase/client'
import { useWorkspaceStore } from '~/stores/workspace'

/** KeepAlive / мутации сетов — перезагрузка pulse. */
export function useRepertoirePulseRevision() {
  const revision = useState('repertoire-pulse-revision', () => 0)
  const summary = useState<RepertoirePulseSummary | null>('repertoire-pulse-summary', () => null)
  const songs = useState<RepertoireSongStat[] | null>('repertoire-pulse-songs', () => null)

  function bumpRepertoirePulseRevision() {
    revision.value += 1
    summary.value = null
    songs.value = null
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

function periodBounds(today = localTodayKey()) {
  const from = lookbackFrom(today, REPERTOIRE_THRESHOLDS.lookbackDays)
  return { from, today }
}

export function useRepertoirePulse() {
  const summary = useState<RepertoirePulseSummary | null>('repertoire-pulse-summary', () => null)
  const songs = useState<RepertoireSongStat[] | null>('repertoire-pulse-songs', () => null)
  const loadingSummary = ref(false)
  const loadingSongs = ref(false)
  const error = ref<string | null>(null)

  async function fetchSummary(opts?: { force?: boolean }) {
    const workspace = useWorkspaceStore()
    if (!workspace.workspace) {
      summary.value = null
      return null
    }

    if (summary.value && !opts?.force) return summary.value

    loadingSummary.value = true
    error.value = null
    try {
      const { from, today } = periodBounds()
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase.rpc('repertoire_pulse_summary', {
        p_workspace_id: workspace.workspace.id,
        p_from: from,
        p_today: today,
      })
      if (qError) throw qError
      summary.value = mapPulseSummary(data as DbRepertoirePulseSummary)
      return summary.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить пульс репертуара'
      throw e
    } finally {
      loadingSummary.value = false
    }
  }

  async function fetchSongs(opts?: { force?: boolean }) {
    const workspace = useWorkspaceStore()
    if (!workspace.workspace) {
      songs.value = null
      return []
    }

    if (songs.value && !opts?.force) return songs.value

    loadingSongs.value = true
    error.value = null
    try {
      const { from, today } = periodBounds()
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase.rpc('repertoire_pulse_songs', {
        p_workspace_id: workspace.workspace.id,
        p_from: from,
        p_today: today,
      })
      if (qError) throw qError
      const rows = (data ?? []) as DbRepertoireSongStat[]
      songs.value = rows.map(mapSongStat)
      return songs.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить статистику песен'
      throw e
    } finally {
      loadingSongs.value = false
    }
  }

  async function fetchDay(day: string): Promise<RepertoireDayPlay[]> {
    const workspace = useWorkspaceStore()
    if (!workspace.workspace) return []
    const { today } = periodBounds()
    if (day >= today) return []

    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase.rpc('repertoire_pulse_day', {
      p_workspace_id: workspace.workspace.id,
      p_day: day,
      p_today: today,
    })
    if (qError) throw qError
    return ((data ?? []) as DbRepertoireDayPlay[]).map(mapDayPlay)
  }

  async function refreshAll() {
    await Promise.all([fetchSummary({ force: true }), fetchSongs({ force: true })])
  }

  return {
    summary,
    songs,
    loadingSummary,
    loadingSongs,
    error,
    fetchSummary,
    fetchSongs,
    fetchDay,
    refreshAll,
    periodBounds,
  }
}
