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
import { readActiveWorkspaceId, writeActiveWorkspaceId } from '~/utils/activeWorkspace'
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

  function applyWorkspace(ws: Workspace, member: WorkspaceMember) {
    workspace.value = ws
    membership.value = member
    writeActiveWorkspaceId(ws.id)
  }

  function clear() {
    workspace.value = null
    membership.value = null
    error.value = null
    writeActiveWorkspaceId(null)
  }

  async function loadMembershipForWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const supabase = getSupabaseBrowserClient()
    const { data, error: qError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle()
    if (qError) throw qError
    return data ? mapMember(data as DbWorkspaceMember) : null
  }

  async function loadCurrent(options?: { quiet?: boolean }) {
    const auth = useAuthStore()
    if (!auth.user) {
      clear()
      return null
    }

    if (!options?.quiet) loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      // Newest first — invite join should win over an older empty team
      const { data, error: qError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false })

      if (qError) throw qError

      const rows = (data ?? []) as DbWorkspaceMember[]
      if (!rows.length) {
        clear()
        return null
      }

      const preferredId = readActiveWorkspaceId()
      const memberRow =
        (preferredId ? rows.find((row) => row.workspace_id === preferredId) : undefined) ??
        rows[0]!

      membership.value = mapMember(memberRow)

      const { data: ws, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', memberRow.workspace_id)
        .single()
      if (wsError) throw wsError

      workspace.value = mapWorkspace(ws as DbWorkspace)
      writeActiveWorkspaceId(workspace.value.id)
      return { workspace: workspace.value, membership: membership.value }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить команду'
      throw e
    } finally {
      if (!options?.quiet) loading.value = false
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
      writeActiveWorkspaceId(workspaceRow.id)

      const member = await loadMembershipForWorkspace(workspaceRow.id, auth.user.id)
      if (!member) throw new Error('Не удалось загрузить участника после создания')

      applyWorkspace(mapWorkspace(workspaceRow), member)
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

      const workspaceRow = ws as DbWorkspace
      writeActiveWorkspaceId(workspaceRow.id)

      const member = await loadMembershipForWorkspace(workspaceRow.id, auth.user.id)
      if (!member) {
        throw new Error('Вы добавлены, но команду не удалось открыть. Обновите приложение.')
      }

      applyWorkspace(mapWorkspace(workspaceRow), member)
      return workspace.value
    } catch (e) {
      // Avoid half-applied UI state (workspace without membership)
      if (!membership.value || !workspace.value) {
        workspace.value = null
        membership.value = null
      }
      error.value = e instanceof Error ? e.message : 'Не удалось присоединиться'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function leaveWorkspace() {
    const auth = useAuthStore()
    if (!auth.user || !workspace.value || !membership.value) {
      throw new Error('Нет активной команды')
    }

    loading.value = true
    error.value = null
    try {
      const supabase = getSupabaseBrowserClient()
      const workspaceId = workspace.value.id
      const membershipId = membership.value.id

      if (membership.value.role === 'administrator') {
        const [{ count: total }, { count: admins }] = await Promise.all([
          supabase
            .from('workspace_members')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId),
          supabase
            .from('workspace_members')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .eq('role', 'administrator'),
        ])

        if ((admins ?? 0) <= 1 && (total ?? 0) > 1) {
          throw new Error('Назначьте другого администратора перед выходом')
        }
      }

      const { error: delError } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', membershipId)
        .eq('user_id', auth.user.id)

      if (delError) throw delError

      writeActiveWorkspaceId(null)
      workspace.value = null
      membership.value = null

      // Switch to another team if the user still belongs somewhere
      await loadCurrent({ quiet: true })
      return { hasWorkspace: hasWorkspace.value }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось выйти из команды'
      throw e
    } finally {
      loading.value = false
    }
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
    leaveWorkspace,
    clear,
  }
})
