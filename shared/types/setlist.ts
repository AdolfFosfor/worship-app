import type { EntityId, Timestamps } from './common'
import type { Song, SongKey } from './song'

export interface Setlist extends Timestamps {
  id: EntityId
  workspaceId: EntityId
  title: string
  serviceDate: string
  createdBy: EntityId | null
}

export interface SetlistItem {
  id: EntityId
  setlistId: EntityId
  songId: EntityId
  position: number
  /** Override key for this setlist only; null = use song.key */
  key: SongKey | null
}

export interface SetlistItemWithSong extends SetlistItem {
  song: Song
}

export interface SetlistWithItems extends Setlist {
  items: SetlistItemWithSong[]
}

export interface SetlistInput {
  title: string
  serviceDate: string
}
