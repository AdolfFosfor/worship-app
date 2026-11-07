import { transposeKeyLabel } from './keys'

export function clampCapo(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(11, Math.round(n)))
}

/** Concert/sounding key when shapes in `shapeKey` are played with capo. */
export function soundingKey(shapeKey: string, capo: number): string {
  return transposeKeyLabel(shapeKey, clampCapo(capo))
}

export function formatCapoLabel(shapeKey: string, capo: number): string {
  const fret = clampCapo(capo)
  if (!fret) return shapeKey
  return `${shapeKey} · капо ${fret} → ${soundingKey(shapeKey, fret)}`
}
