import type { ChartSection, ChordChart, Json, SectionType } from '~~/shared/types'
import { SECTION_TYPES } from '~~/shared/types'
import { matchSectionHeader } from '~/utils/music/sectionHeaders'
import { isChordChart } from './factory'

function isSectionType(value: unknown): value is SectionType {
  return typeof value === 'string' && (SECTION_TYPES as string[]).includes(value)
}

/**
 * Legacy: Pre-Chorus was stored as type=custom with title "Pre-Chorus".
 * Promote known titles / aliases to the real section type.
 */
export function coerceSectionType(section: ChartSection): ChartSection {
  if (section.type !== 'custom') return section
  const fromTitle = section.title ? matchSectionHeader(section.title) : null
  if (!fromTitle || fromTitle.type === 'custom') return section
  return {
    id: section.id,
    type: fromTitle.type,
    bars: section.bars,
  }
}

/** Parse DB jsonb into a typed chart or null; remap legacy custom Pre-Chorus → prechorus. */
export function normalizeChordChart(value: Json | ChordChart | null | undefined): ChordChart | null {
  if (value == null) return null
  if (!isChordChart(value)) return null
  return {
    ...value,
    sections: value.sections.map((s) => {
      if (!isSectionType(s.type)) return s
      return coerceSectionType(s)
    }),
  }
}
