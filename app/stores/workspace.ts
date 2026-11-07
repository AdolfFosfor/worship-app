import { defineStore } from 'pinia'
import type {
  DbWorkspace,
  DbWorkspaceMember,
  MemberRole,
  Workspace,
  WorkspaceMember,
} from '~~/shared/types'
import {
  canManageMembers,
  canManageSetlists,
  canManageSongs,
} from '~~/shared/types'
import { mapMember, mapWorkspace } from '~/utils/mappers'
import { getSupabaseBrowserClient } from '~/utils/supabase/client'
import { useAuthStore } from '~/stores/auth'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspace = ref<Workspace | null>(null)
  const membership = ref<WorkspaceMember | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const role = computed<MemberRole | null>(() => membership.value?.role ?? null)
  const canEditSongs = computed(() => canManageSongs(role.value))
  const canEditSetlists = computed(() => canManageSetlists(role.value))
  const canEditMembers = computed(() => canManageMembers(role.value))
  const hasWorkspace = computed(() => Boolean(workspace.value && membership.value))

  async function loadCurrent() {
    const auth = useAuthStore()
    if (!auth.user) {
      workspace.value = null
      membership.value = null
      return null
    }

    loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: qError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (qError) throw qError

      if (!data) {
        workspace.value = null
        membership.value = null
        return null
      }

      const memberRow = data as DbWorkspaceMember
      membership.value = mapMember(memberRow)

      const { data: ws, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', memberRow.workspace_id)
        .single()
      if (wsError) throw wsError

      workspace.value = mapWorkspace(ws as DbWorkspace)
      return { workspace: workspace.value, membership: membership.value }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить команду'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createWorkspace(name: string) {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Not authenticated')

    loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      const displayName =
        [auth.user.firstName, auth.user.lastName].filter(Boolean).join(' ') ||
        auth.user.username ||
        auth.user.email ||
        'Участник'

      const { data: ws, error: rpcError } = await supabase.rpc('create_workspace', {
        p_name: name.trim(),
        p_display_name: displayName,
      })

      if (rpcError) throw rpcError
      if (!ws) throw new Error('Не удалось создать команду')

      const workspaceRow = ws as DbWorkspace
      workspace.value = mapWorkspace(workspaceRow)

      const { data: member, error: memberError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceRow.id)
        .eq('user_id', auth.user.id)
        .single()

      if (memberError) throw memberError

      membership.value = mapMember(member as DbWorkspaceMember)
      return workspace.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось создать команду'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function joinByInviteCode(code: string) {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Not authenticated')

    loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      const displayName =
        [auth.user.firstName, auth.user.lastName].filter(Boolean).join(' ') ||
        auth.user.username ||
        auth.user.email ||
        'Участник'

      const { data: ws, error: rpcError } = await supabase.rpc('join_workspace_by_invite', {
        p_code: code.trim().toUpperCase(),
        p_display_name: displayName,
      })

      if (rpcError) throw rpcError
      if (!ws) throw new Error('Код приглашения не найден')

      workspace.value = mapWorkspace(ws as DbWorkspace)

      const { data: member, error: memberError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspace.value.id)
        .eq('user_id', auth.user.id)
        .single()
      if (memberError) throw memberError

      membership.value = mapMember(member as DbWorkspaceMember)
      return workspace.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось присоединиться'
      throw e
    } finally {
      loading.value = false
    }
  }

  function clear() {
    workspace.value = null
    membership.value = null
    error.value = null
  }

  return {
    workspace,
    membership,
    role,
    loading,
    error,
    hasWorkspace,
    canEditSongs,
    canEditSetlists,
    canEditMembers,
    loadCurrent,
    createWorkspace,
    joinByInviteCode,
    clear,
  }
})
