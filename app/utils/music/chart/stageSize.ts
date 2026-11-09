export type StageChordSize = 'compact' | 'standard' | 'large'

const KEY = 'worship-stage-chord-size'

export function readStageChordSize(): StageChordSize {
  if (!import.meta.client) return 'standard'
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'compact' || v === 'standard' || v === 'large') return v
  } catch {
    // ignore
  }
  return 'standard'
}

export function writeStageChordSize(size: StageChordSize) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(KEY, size)
  } catch {
    // ignore
  }
}
