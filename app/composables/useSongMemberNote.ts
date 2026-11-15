import type { DbSongMemberNote, SongMemberNote, SongSectionNotes } from '~~/shared/types'
import { mapSongMemberNote } from '~/utils/mappers'
import { getSupabaseBrowserClient } from '~/utils/supabase/client'
import { useWorkspaceStore } from '~/stores/workspace'

function pruneSectionNotes(notes: SongSectionNotes): SongSectionNotes {
  const out: SongSectionNotes = {}
  for (const [key, value] of Object.entries(notes)) {
    const trimmed = value.trim()
    if (trimmed) out[key] = trimmed
  }
  return out
}

/** Личные заметки текущего участника к песне (трек + секции). */
export function useSongMemberNote(songId: MaybeRefOrGetter<string>) {
  const note = ref<SongMemberNote | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const trackBody = computed(() => note.value?.body?.trim() || '')
  const sectionNotes = computed<SongSectionNotes>(() => note.value?.sectionNotes ?? {})

  async function fetchNote() {
    const id = toValue(songId)
    const workspace = useWorkspaceStore()
    const memberId = workspace.membership?.id
    if (!id || !memberId) {
      note.value = null
      return null
    }

    loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase
        .from('song_member_notes')
        .select('*')
        .eq('song_id', id)
        .eq('member_id', memberId)
        .maybeSingle()
      if (qError) throw qError
      note.value = data ? mapSongMemberNote(data as DbSongMemberNote) : null
      return note.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить заметку'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function persist(body: string, sections: SongSectionNotes) {
    const workspace = useWorkspaceStore()
    const memberId = workspace.membership?.id
    const workspaceId = workspace.workspace?.id
    const id = toValue(songId)
    if (!memberId || !workspaceId || !id) {
      throw new Error('Нет членства в команде')
    }

    const nextBody = body.trim()
    const nextSections = pruneSectionNotes(sections)
    const empty = !nextBody && Object.keys(nextSections).length === 0

    saving.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()

      if (empty) {
        if (note.value) {
          const { error: delError } = await supabase
            .from('song_member_notes')
            .delete()
            .eq('id', note.value.id)
          if (delError) throw delError
          note.value = null
        }
        return null
      }

      const { data, error: qError } = await supabase
        .from('song_member_notes')
        .upsert(
          {
            workspace_id: workspaceId,
            song_id: id,
            member_id: memberId,
            body: nextBody,
            section_notes: nextSections,
          },
          { onConflict: 'song_id,member_id' },
        )
        .select('*')
        .single()
      if (qError) throw qError
      note.value = mapSongMemberNote(data as DbSongMemberNote)
      return note.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось сохранить заметку'
      throw e
    } finally {
      saving.value = false
    }
  }

  async function saveTrackNote(body: string) {
    return persist(body, note.value?.sectionNotes ?? {})
  }

  async function saveSectionNote(sectionId: string, text: string) {
    const next: SongSectionNotes = {}
    for (const [key, value] of Object.entries(note.value?.sectionNotes ?? {})) {
      if (key !== sectionId) next[key] = value
    }
    const trimmed = text.trim()
    if (trimmed) next[sectionId] = trimmed
    return persist(note.value?.body ?? '', next)
  }

  function sectionNote(sectionId: string | null | undefined): string {
    if (!sectionId) return ''
    return sectionNotes.value[sectionId]?.trim() || ''
  }

  return {
    note,
    trackBody,
    sectionNotes,
    loading,
    saving,
    error,
    fetchNote,
    saveTrackNote,
    saveSectionNote,
    sectionNote,
  }
}
