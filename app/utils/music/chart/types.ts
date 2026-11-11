export type {
  AnnotationPreset,
  BarItem,
  ChartAnnotation,
  ChartBar,
  ChartChord,
  ChartSection,
  ChordChart,
  ChordDuration,
  SectionType,
  TimeSignature,
} from '~~/shared/types'

export {
  ANNOTATION_PRESETS,
  SECTION_LABELS,
  SECTION_TYPES,
  TIME_SIGNATURES,
} from '~~/shared/types'

/** Soft section wash tokens (defined in main.css). */
export const SECTION_COLOR_VAR: Record<string, string> = {
  intro: 'var(--chart-section-intro)',
  verse: 'var(--chart-section-verse)',
  chorus: 'var(--chart-section-chorus)',
  bridge: 'var(--chart-section-bridge)',
  instrumental: 'var(--chart-section-instrumental)',
  tag: 'var(--chart-section-tag)',
  outro: 'var(--chart-section-outro)',
  custom: 'var(--chart-section-custom)',
}

/** Solid accent for section marks / pills. */
export const SECTION_ACCENT_VAR: Record<string, string> = {
  intro: 'var(--chart-accent-intro)',
  verse: 'var(--chart-accent-verse)',
  chorus: 'var(--chart-accent-chorus)',
  bridge: 'var(--chart-accent-bridge)',
  instrumental: 'var(--chart-accent-instrumental)',
  tag: 'var(--chart-accent-tag)',
  outro: 'var(--chart-accent-outro)',
  custom: 'var(--chart-accent-custom)',
}

export function sectionTypeLabel(
  type: string,
  labelForType?: (type: string) => string,
): string {
  if (labelForType) return labelForType(type)
  return SECTION_LABELS[type as keyof typeof SECTION_LABELS] ?? 'Секция'
}

/** Legacy helper — prefer sectionAutoTitle for numbered labels. */
export function sectionDisplayTitle(
  type: string,
  title?: string | null,
  labelForType?: (type: string) => string,
): string {
  if (title?.trim()) return title.trim()
  return sectionTypeLabel(type, labelForType)
}

/** Auto label with per-type index: Verse 1, Chorus 2, … */
export function sectionAutoTitle(
  sections: Array<{ id: string; type: string }>,
  sectionId: string,
  labelForType?: (type: string) => string,
): string {
  const section = sections.find((s) => s.id === sectionId)
  if (!section) return labelForType?.('custom') ?? 'Секция'
  const label = sectionTypeLabel(section.type, labelForType)
  const same = sections.filter((s) => s.type === section.type)
  const index = same.findIndex((s) => s.id === sectionId) + 1
  return same.length > 1 || section.type === 'verse' || section.type === 'chorus'
    ? `${label} ${index}`
    : label
}
