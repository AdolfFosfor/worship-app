import { getDocument, GlobalWorkerOptions, type TextItem } from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let workerReady = false

function ensurePdfWorker() {
  if (workerReady || import.meta.server) return
  GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  workerReady = true
}

export type PdfTextLine = {
  text: string
  y: number
  page: number
  column: number
}

type RawItem = { str: string; x: number; y: number; w: number; h: number }

function itemsToLines(raw: RawItem[]): { text: string; y: number }[] {
  if (!raw.length) return []
  const medianH =
    raw.map((r) => r.h).sort((a, b) => a - b)[Math.floor(raw.length / 2)] ?? 10
  const Y_TOL = Math.max(2.2, medianH * 0.28)

  const sorted = [...raw].sort((a, b) => b.y - a.y || a.x - b.x)
  const groups: { y: number; parts: RawItem[] }[] = []
  for (const item of sorted) {
    const group = groups.find((g) => Math.abs(g.y - item.y) <= Y_TOL)
    if (group) {
      group.parts.push(item)
      group.y = (group.y * (group.parts.length - 1) + item.y) / group.parts.length
    } else {
      groups.push({ y: item.y, parts: [item] })
    }
  }

  const lines: { text: string; y: number }[] = []
  for (const group of groups) {
    group.parts.sort((a, b) => a.x - b.x)
    let text = ''
    let prevRight = -Infinity
    for (const part of group.parts) {
      const gap = part.x - prevRight
      if (text) {
        if (gap > Math.max(part.h * 0.35, 2)) {
          text += gap > part.h * 1.2 ? '  ' : ' '
        }
      }
      text += part.str
      prevRight = part.x + part.w
    }
    const cleaned = text.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, '').trim()
    if (cleaned) lines.push({ text: cleaned, y: group.y })
  }
  return lines
}

/**
 * Holychords PDF = landscape 2 columns. Find the widest horizontal gap in X
 * and treat it as the column gutter (if large enough).
 */
function splitColumns(raw: RawItem[], pageWidth: number): RawItem[][] {
  if (raw.length < 8) return [raw]

  const xs = [...new Set(raw.map((r) => Math.round(r.x)))].sort((a, b) => a - b)
  let bestGap = 0
  let splitAt = pageWidth / 2
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i]! - xs[i - 1]!
    if (gap > bestGap) {
      bestGap = gap
      splitAt = (xs[i]! + xs[i - 1]!) / 2
    }
  }

  // Need a real gutter: ~12%+ of page width (Holychords ~154 on ~842)
  const minGap = Math.max(60, pageWidth * 0.1)
  if (bestGap < minGap) return [raw]

  const left = raw.filter((r) => r.x < splitAt)
  const right = raw.filter((r) => r.x >= splitAt)
  // Both sides should have meaningful content
  if (left.length < 4 || right.length < 4) return [raw]
  return [left, right]
}

function isPrintChrome(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t)) return true
  if (/^https?:\/\//i.test(t)) return true
  if (/holychords\.pro/i.test(t) && t.length > 40) return true
  if (/^\d+\/\d+$/.test(t)) return true
  if (/^HOLY\s*CHORDS/i.test(t)) return true
  return false
}

/**
 * Extract text lines from a PDF (text layer), reading multi-column pages
 * left→right column, top→bottom within each.
 */
export async function extractPdfTextLines(file: File | ArrayBuffer): Promise<PdfTextLine[]> {
  ensurePdfWorker()
  const data = file instanceof File ? await file.arrayBuffer() : file
  const pdf = await getDocument({ data, useSystemFonts: true }).promise
  const lines: PdfTextLine[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const items = content.items.filter((item): item is TextItem => 'str' in item && Boolean(item.str))

    const raw: RawItem[] = items
      .map((item) => {
        const [, , , d, e, f] = item.transform
        const h = Math.abs(typeof d === 'number' && d !== 0 ? d : (item.height ?? 10))
        const w =
          typeof item.width === 'number' && item.width > 0
            ? item.width
            : Math.max(item.str.length * h * 0.5, h * 0.35)
        return {
          str: item.str,
          x: typeof e === 'number' ? e : 0,
          y: typeof f === 'number' ? f : 0,
          w,
          h,
        }
      })
      .filter((item) => item.str.trim().length > 0)

    const columns = splitColumns(raw, viewport.width)
    columns.forEach((colItems, columnIndex) => {
      for (const line of itemsToLines(colItems)) {
        if (isPrintChrome(line.text)) continue
        lines.push({
          text: line.text,
          y: line.y,
          page: pageNum,
          column: columnIndex,
        })
      }
    })
  }

  return lines
}

export async function extractPdfPlainText(file: File | ArrayBuffer): Promise<string> {
  const lines = await extractPdfTextLines(file)
  return lines.map((l) => l.text).join('\n')
}
