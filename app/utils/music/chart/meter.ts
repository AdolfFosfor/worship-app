import type { TimeSignature } from '~~/shared/types'

export interface MeterInfo {
  /** Numerator as written (e.g. 6 in 6/8). */
  numerator: number
  /** Denominator as written (e.g. 8 in 6/8). */
  denominator: number
  /**
   * Primary pulse count for hybrid grid / duration UI.
   * Simple meters: same as numerator.
   * Compound (x/8): grouped in threes → 6/8→2, 9/8→3, 12/8→4.
   */
  pulses: number
  /** True for compound meters counted in dotted quarters. */
  compound: boolean
  /** Suggested max chord duration in pulses for one bar. */
  barPulses: number
}

const METER: Record<TimeSignature, MeterInfo> = {
  '2/4': { numerator: 2, denominator: 4, pulses: 2, compound: false, barPulses: 2 },
  '3/4': { numerator: 3, denominator: 4, pulses: 3, compound: false, barPulses: 3 },
  '4/4': { numerator: 4, denominator: 4, pulses: 4, compound: false, barPulses: 4 },
  '6/8': { numerator: 6, denominator: 8, pulses: 2, compound: true, barPulses: 2 },
  '9/8': { numerator: 9, denominator: 8, pulses: 3, compound: true, barPulses: 3 },
  '12/8': { numerator: 12, denominator: 8, pulses: 4, compound: true, barPulses: 4 },
}

export function getMeter(ts: TimeSignature | string): MeterInfo {
  return METER[ts as TimeSignature] ?? METER['4/4']
}

/** Duration picker options for a meter (pulse counts). */
export function durationOptions(ts: TimeSignature | string): number[] {
  const { barPulses } = getMeter(ts)
  return Array.from({ length: barPulses }, (_, i) => i + 1)
}

export function isValidTimeSignature(value: string): value is TimeSignature {
  return value in METER
}
