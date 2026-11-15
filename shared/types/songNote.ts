import type { EntityId } from './common'

/** chartSectionId → текст; пустые ключи не храним. */
export type SongSectionNotes = Record<string, string>

/** Личные заметки участника к песне (трек + секции). Только свои. */
export interface SongMemberNote {
  id: EntityId
  workspaceId: EntityId
  songId: EntityId
  memberId: EntityId
  /** Заметка ко всему треку */
  body: string
  /** Заметки к секциям схемы (ключ = ChartSection.id) */
  sectionNotes: SongSectionNotes
  createdAt: string
  updatedAt: string
}
