import type { ChordChart, Json } from '~~/shared/types'
import { isChordChart } from './factory'

/** Parse DB jsonb into a typed chart or null. */
export function normalizeChordChart(value: Json | ChordChart | null | undefined): ChordChart | null {
  if (value == null) return null
  if (isChordChart(value)) return value
  return null
}
