import type { DbSetlistRsvp, SetlistRsvp, SetlistRsvpStatus } from '~~/shared/types'
import { mapSetlistRsvp } from '~/utils/mappers'
import { getSupabaseBrowserClient } from '~/utils/supabase/client'
import { useWorkspaceStore } from '~/stores/workspace'

export function useSetlistRsvps(setlistId: MaybeRefOrGetter<string>) {
  const rsvps = ref<SetlistRsvp[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const saving = ref(false)

  async function fetchRsvps() {
    const id = toValue(setlistId)
    if (!id) {
      rsvps.value = []
      return []
    }

    loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase
        .from('setlist_rsvps')
        .select('*')
        .eq('setlist_id', id)
      if (qError) throw qError
      rsvps.value = ((data ?? []) as DbSetlistRsvp[]).map(mapSetlistRsvp)
      return rsvps.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить ответы'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function upsertOwnStatus(status: SetlistRsvpStatus) {
    const workspace = useWorkspaceStore()
    const memberId = workspace.membership?.id
    const id = toValue(setlistId)
    if (!memberId || !id) {
      throw new Error('Нет членства в команде')
    }

    saving.value = true
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase
        .from('setlist_rsvps')
        .upsert(
          {
            setlist_id: id,
            member_id: memberId,
            status,
          },
          { onConflict: 'setlist_id,member_id' },
        )
        .select('*')
        .single()
      if (qError) throw qError

      const mapped = mapSetlistRsvp(data as DbSetlistRsvp)
      const idx = rsvps.value.findIndex((r) => r.memberId === memberId)
      if (idx >= 0) {
        rsvps.value = rsvps.value.map((r, i) => (i === idx ? mapped : r))
      } else {
        rsvps.value = [...rsvps.value, mapped]
      }
      return mapped
    } finally {
      saving.value = false
    }
  }

  function statusForMember(memberId: string): SetlistRsvpStatus | null {
    return rsvps.value.find((r) => r.memberId === memberId)?.status ?? null
  }

  return {
    rsvps,
    loading,
    error,
    saving,
    fetchRsvps,
    upsertOwnStatus,
    statusForMember,
  }
}
