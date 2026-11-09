/** Musical time signature for the whole song. */
export type TimeSignature = '2/4' | '3/4' | '4/4' | '6/8' | '9/8' | '12/8'

export type SectionType =
  | 'intro'
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'tag'
  | 'outro'
  | 'custom'

export type AnnotationPreset = 'x2' | 'x3' | 'stop' | 'inst' | 'vox' | 'cresc' | 'dim'

/** Optional rhythmic placement inside a bar (hybrid mode — often omitted). */
export interface ChordDuration {
  beats: number
  subdivision?: 1 | 2 | 3 | 4
}

export interface ChartChord {
  id: string
  kind: 'chord'
  symbol: string
  duration?: ChordDuration
}

export interface ChartAnnotation {
  id: string
  kind: 'annotation'
  text: string
  preset?: AnnotationPreset
}

export type BarItem = ChartChord | ChartAnnotation

export interface ChartBar {
  id: string
  items: BarItem[]
}

export interface ChartSection {
  id: string
  type: SectionType
  /** Custom label or refinement e.g. "Verse 2". */
  title?: string
  bars: ChartBar[]
}

export interface ChordChart {
  v: 1
  timeSignature: TimeSignature
  sections: ChartSection[]
}

export const TIME_SIGNATURES: TimeSignature[] = ['2/4', '3/4', '4/4', '6/8', '9/8', '12/8']

export const SECTION_TYPES: SectionType[] = [
  'intro',
  'verse',
  'chorus',
  'bridge',
  'tag',
  'outro',
  'custom',
]

export const SECTION_LABELS: Record<SectionType, string> = {
  intro: 'Intro',
  verse: 'Verse',
  chorus: 'Chorus',
  bridge: 'Bridge',
  tag: 'Tag',
  outro: 'Outro',
  custom: 'Секция',
}

export const ANNOTATION_PRESETS: { preset: AnnotationPreset; text: string }[] = [
  { preset: 'x2', text: '×2' },
  { preset: 'x3', text: '×3' },
  { preset: 'stop', text: 'STOP' },
  { preset: 'inst', text: 'Inst' },
  { preset: 'vox', text: 'Vocal' },
  { preset: 'cresc', text: '↗' },
  { preset: 'dim', text: '↘' },
]
