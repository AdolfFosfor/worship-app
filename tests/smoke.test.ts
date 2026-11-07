import { describe, expect, it } from 'vitest'
import { transposeText } from '../app/utils/music/transpose'
import { keyDistance, transposeKeyLabel } from '../app/utils/music/keys'

describe('chord transpose', () => {
  it('shifts key labels', () => {
    expect(transposeKeyLabel('G', 2)).toBe('A')
    expect(transposeKeyLabel('Am', 2)).toBe('Bm')
  })

  it('computes distance between keys', () => {
    expect(keyDistance('G', 'A')).toBe(2)
    expect(keyDistance('C', 'C')).toBe(0)
  })

  it('transposes chord progressions', () => {
    expect(transposeText('G  D  Em  C', 2)).toBe('A  E  F#m  D')
    expect(transposeText('D/F#', 2)).toBe('E/G#')
  })
})
