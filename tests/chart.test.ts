import { describe, expect, it } from 'vitest'
import {
  parseLegacyChords,
  serializeChart,
  transposeChart,
  createEmptyChart,
  createChord,
  insertItem,
  addSection,
  removeSection,
} from '../app/utils/music/chart'

describe('chord chart', () => {
  it('parses section headers and bars', () => {
    const chart = parseLegacyChords(`Verse\nG D Em C\nChorus: Am | F | C | G`)
    expect(chart.sections.length).toBeGreaterThanOrEqual(2)
    expect(chart.sections[0]!.type).toBe('verse')
    expect(chart.sections[0]!.bars[0]!.items.some((i) => i.kind === 'chord' && i.symbol === 'G')).toBe(
      true,
    )
    const chorus = chart.sections.find((s) => s.type === 'chorus')
    expect(chorus?.bars.length).toBe(4)
  })

  it('treats slash as bar separator and russian headers', () => {
    const chart = parseLegacyChords(
      `Куплет: Am F C / Am F C / Am F C G\nПрипев: Am F C / Am F C`,
    )
    expect(chart.sections[0]!.type).toBe('verse')
    expect(chart.sections[0]!.bars.length).toBe(3)
    expect(chart.sections[0]!.bars.some((b) => b.items.some((i) => i.kind === 'annotation' && i.text === '/'))).toBe(
      false,
    )
    expect(chart.sections[1]!.type).toBe('chorus')
    expect(chart.sections[1]!.bars.length).toBe(2)
  })

  it('keeps bridge body when line has an em dash', () => {
    const chart = parseLegacyChords('Bridge: Bm G D A ×3 / Em G — A')
    const bridge = chart.sections.find((s) => s.type === 'bridge')
    expect(bridge).toBeTruthy()
    expect(bridge!.bars.length).toBe(2)
    const symbols = bridge!.bars.flatMap((b) =>
      b.items.filter((i) => i.kind === 'chord').map((i) => (i.kind === 'chord' ? i.symbol : '')),
    )
    expect(symbols).toEqual(['Bm', 'G', 'D', 'A', 'Em', 'G', 'A'])
  })

  it('maps Tag to tag section', () => {
    const chart = parseLegacyChords('Tag: Bm G D')
    expect(chart.sections[0]!.type).toBe('tag')
    expect(chart.sections[0]!.bars[0]!.items.map((i) => (i.kind === 'chord' ? i.symbol : i.text))).toEqual([
      'Bm',
      'G',
      'D',
    ])
  })

  it('round-trips serialize', () => {
    const chart = parseLegacyChords('Intro\nEm | D | C')
    const text = serializeChart(chart)
    expect(text).toContain('Intro')
    expect(text).toMatch(/Em/)
  })

  it('transposes symbols only', () => {
    let chart = createEmptyChart()
    chart = {
      ...chart,
      sections: [
        {
          id: 'sec_1',
          type: 'verse',
          bars: [{ id: 'bar_1', items: [] }],
        },
      ],
    }
    chart = insertItem(chart, 'sec_1', 'bar_1', createChord('G'))
    const next = transposeChart(chart, 2)
    const symbol = next.sections[0]!.bars[0]!.items[0]
    expect(symbol?.kind === 'chord' && symbol.symbol).toBe('A')
    expect(next.sections[0]!.id).toBe(chart.sections[0]!.id)
  })

  it('starts empty and allows removing the last section', () => {
    let chart = createEmptyChart()
    expect(chart.sections).toHaveLength(0)
    chart = addSection(chart, 'verse')
    expect(chart.sections).toHaveLength(1)
    chart = removeSection(chart, chart.sections[0]!.id)
    expect(chart.sections).toHaveLength(0)
  })
})
