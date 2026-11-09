import type {
  DbSetlist,
  DbSetlistItem,
  DbSong,
  DbWorkspace,
  DbWorkspaceMember,
  Setlist,
  SetlistItem,
  Song,
  Workspace,
  WorkspaceMember,
} from '~~/shared/types'
import { normalizeChordChart } from '~/utils/music/chart'

export function mapWorkspace(row: DbWorkspace): Workspace {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMember(row: DbWorkspaceMember): WorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    roleTitle: row.role_title ?? null,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? null,
    createdAt: row.created_at,
  }
}

function normalizeBpm(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const n = Math.round(value)
  if (n < 30 || n > 300) return null
  return n
}

export function mapSong(row: DbSong): Song {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    key: row.key,
    capo: Number.isFinite(row.capo) ? Math.max(0, Math.min(11, row.capo)) : 0,
    bpm: normalizeBpm(row.bpm),
    chords: row.chords,
    chordChart: normalizeChordChart(row.chord_chart),
    lyrics: row.lyrics,
    youtubeUrl: row.youtube_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapSetlist(row: DbSetlist): Setlist {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    serviceDate: row.service_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapSetlistItem(row: DbSetlistItem): SetlistItem {
  return {
    id: row.id,
    setlistId: row.setlist_id,
    songId: row.song_id,
    position: row.position,
    key: row.key,
  }
}
