import type { LyricBlock, SectionType } from '~~/shared/types'
import { SECTION_LABELS } from '~~/shared/types'

/** English section label — same vocabulary as chart editor. */
export function englishSectionLabel(type: SectionType | string): string {
  return SECTION_LABELS[type as SectionType] ?? 'Section'
}

/**
 * Display title for a lyrics block: Verse 1, Chorus 2, Tag…
 * Matches chart stage auto-titles; ignores stored RO/RU synonyms.
 */
export function lyricsBlockDisplayTitle(
  blocks: Array<Pick<LyricBlock, 'id' | 'type' | 'title'>>,
  blockId: string,
): string {
  const block = blocks.find((b) => b.id === blockId)
  if (!block) return 'Section'
  if (block.type === 'custom' && block.title?.trim()) return block.title.trim()

  const label = englishSectionLabel(block.type)
  const same = blocks.filter((b) => b.type === block.type)
  const index = same.findIndex((b) => b.id === blockId) + 1
  const numbered =
    same.length > 1 || block.type === 'verse' || block.type === 'chorus'
  return numbered ? `${label} ${index}` : label
}

/** Canonical English title when parsing/storing a header with optional number. */
export function englishSectionTitle(type: SectionType, n?: string | number | null): string {
  const label = englishSectionLabel(type)
  const num = n == null || n === '' ? '' : String(n).trim()
  if (num) return `${label} ${num}`
  if (type === 'verse' || type === 'chorus') return label
  return label
}
