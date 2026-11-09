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

  it('does not transpose section headers', () => {
    expect(transposeText('Bridge: Bm G D A', 2)).toBe('Bridge: C#m A E B')
    expect(transposeText('Куплет:\nBm G D', 2)).toBe('Куплет:\nC#m A E')
    expect(transposeText('Припев: Bm G D', 2)).toBe('Припев: C#m A E')
    expect(transposeText('Tag: Bm G D', 2)).toBe('Tag: C#m A E')
  })
})
