import type { ChordChart, SongLyricsDoc } from '~~/shared/types'
import { parseLegacyChords } from '~/utils/music/chart'
import { autoPlaceBlock, parsePlainLyrics, serializeLyricsDoc } from '~/utils/music/lyrics'
import { extractPdfPlainText } from './extractPdfText'
import {
  normalizeChordAlphabet,
  parseChordSheetText,
  type ChordSheetImportMode,
  type ParsedChordSheet,
} from './parseChordSheetText'

export type { ChordSheetImportMode }

export type PdfChordSheetImportResult = {
  chart: ChordChart
  lyricsDoc: SongLyricsDoc | null
  lyricsPlain: string | null
  parsed: ParsedChordSheet
}

function rematchChartSections(doc: SongLyricsDoc, chart: ChordChart): SongLyricsDoc {
  const used = new Set<string>()
  const blocks = doc.blocks.map((block) => {
    const byType = chart.sections.find((s) => s.type === block.type && !used.has(s.id))
    const fallback = chart.sections.find((s) => !used.has(s.id))
    const match = byType ?? fallback
    if (match) used.add(match.id)
    return { ...block, chartSectionId: match?.id ?? null }
  })
  return { ...doc, blocks }
}

function autoPlaceAll(doc: SongLyricsDoc, chart: ChordChart): SongLyricsDoc {
  let next = doc
  for (const block of next.blocks) {
    next = autoPlaceBlock(next, block.id, chart)
  }
  return next
}

/**
 * Import chords (± lyrics) from a chord-sheet PDF into chart + lyrics_doc.
 */
export async function importPdfChordSheet(
  file: File,
  mode: ChordSheetImportMode,
  previousLyrics?: SongLyricsDoc | null,
): Promise<PdfChordSheetImportResult> {
  const plain = await extractPdfPlainText(file)
  if (!plain.trim()) {
    throw new Error('PDF_EMPTY')
  }

  const parsed = parseChordSheetText(plain)
  if (!parsed.chordText.trim()) {
    throw new Error('PDF_NO_CHORDS')
  }

  const chart = parseLegacyChords(normalizeChordAlphabet(parsed.chordText))

  if (mode === 'chordsOnly') {
    let lyricsDoc = previousLyrics ?? null
    if (lyricsDoc?.blocks.length) {
      lyricsDoc = rematchChartSections(lyricsDoc, chart)
      lyricsDoc = autoPlaceAll(lyricsDoc, chart)
    }
    return {
      chart,
      lyricsDoc,
      lyricsPlain: lyricsDoc ? serializeLyricsDoc(lyricsDoc) : null,
      parsed,
    }
  }

  if (!parsed.lyricsPlain.trim()) {
    throw new Error('PDF_NO_LYRICS')
  }

  let lyricsDoc = parsePlainLyrics(parsed.lyricsPlain, chart, previousLyrics ?? null)
  if (!lyricsDoc?.blocks.length) {
    throw new Error('PDF_NO_LYRICS')
  }
  lyricsDoc = rematchChartSections(lyricsDoc, chart)
  lyricsDoc = autoPlaceAll(lyricsDoc, chart)

  return {
    chart,
    lyricsDoc,
    lyricsPlain: serializeLyricsDoc(lyricsDoc),
    parsed,
  }
}
