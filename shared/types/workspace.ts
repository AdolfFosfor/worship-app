import type { EntityId, IsoDateTime, Timestamps } from './common'

export type MemberRole = 'administrator' | 'worship_leader' | 'musician'

export interface Workspace extends Timestamps {
  id: EntityId
  name: string
  inviteCode: string
  createdBy: EntityId | null
}

export interface WorkspaceMember {
  id: EntityId
  workspaceId: EntityId
  userId: EntityId
  role: MemberRole
  /** Кастомный титул поверх роли (обычно для worship_leader). */
  roleTitle: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: IsoDateTime
}

export interface WorkspaceWithMembership {
  workspace: Workspace
  membership: WorkspaceMember
}

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  administrator: 'Администратор',
  worship_leader: 'Лидер',
  musician: 'Музыкант',
}

export function memberRoleLabel(member: {
  role: MemberRole
  roleTitle?: string | null
}): string {
  const title = member.roleTitle?.trim()
  if (title) return title
  return MEMBER_ROLE_LABELS[member.role]
}

export function canManageSongs(role: MemberRole | null | undefined): boolean {
  return role === 'administrator' || role === 'worship_leader'
}

export function canManageSetlists(role: MemberRole | null | undefined): boolean {
  return role === 'administrator' || role === 'worship_leader'
}

export function canManageMembers(role: MemberRole | null | undefined): boolean {
  return role === 'administrator'
}
