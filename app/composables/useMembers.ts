import type { DbWorkspaceMember, MemberRole, WorkspaceMember } from '~~/shared/types'
import { mapMember } from '~/utils/mappers'
import { getSupabaseBrowserClient } from '~/utils/supabase/client'
import { useWorkspaceStore } from '~/stores/workspace'

export function useMembers() {
  const members = ref<WorkspaceMember[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMembers() {
    const workspace = useWorkspaceStore()
    if (!workspace.workspace) {
      members.value = []
      return []
    }

    loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspace.workspace.id)
        .order('created_at', { ascending: true })
      if (qError) throw qError
      members.value = ((data ?? []) as DbWorkspaceMember[]).map(mapMember)
      return members.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить участников'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateRole(
    memberId: string,
    role: MemberRole,
    roleTitle: string | null = null,
  ) {
    const supabase = getSupabaseBrowserClient()
    const title = roleTitle?.trim() || null
    const { data, error: qError } = await supabase
      .from('workspace_members')
      .update({ role, role_title: title })
      .eq('id', memberId)
      .select('*')
      .single()
    if (qError) throw qError
    const member = mapMember(data as DbWorkspaceMember)
    members.value = members.value.map((m) => (m.id === memberId ? member : m))
    return member
  }

  async function removeMember(memberId: string) {
    const supabase = getSupabaseBrowserClient()
    const { error: qError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)
    if (qError) throw qError
    members.value = members.value.filter((m) => m.id !== memberId)
  }

  return {
    members,
    loading,
    error,
    fetchMembers,
    updateRole,
    removeMember,
  }
}
