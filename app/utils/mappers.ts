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
    displayName: row.display_name,
    createdAt: row.created_at,
  }
}

export function mapSong(row: DbSong): Song {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    key: row.key,
    chords: row.chords,
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
