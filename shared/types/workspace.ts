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
  displayName: string | null
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

export function canManageSongs(role: MemberRole | null | undefined): boolean {
  return role === 'administrator' || role === 'worship_leader'
}

export function canManageSetlists(role: MemberRole | null | undefined): boolean {
  return role === 'administrator' || role === 'worship_leader'
}

export function canManageMembers(role: MemberRole | null | undefined): boolean {
  return role === 'administrator'
}
