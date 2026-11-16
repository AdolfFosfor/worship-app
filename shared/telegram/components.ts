/**
 * Reusable Telegram message building blocks (HTML parse_mode).
 * Compose with `lines()` / `sep()` from `./html`.
 */
import { bold, code, escapeHtml, italic, joinMeta, lines, sep } from './html'

/** Primary heading — first thing the eye catches. */
export function title(text: string): string {
  return bold(text)
}

/** Secondary label above/beside title (eyebrow). */
export function eyebrow(text: string): string {
  return italic(text)
}

/**
 * Info row of muted facts (date, counts, roles).
 * Plain text + optional code chips for scannable values.
 */
export function infoBlock(parts: {
  lead?: string
  chips?: string[]
}): string {
  const lead = parts.lead?.trim()
  const chips = (parts.chips ?? [])
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => code(c))
  if (lead && chips.length) return `${escapeHtml(lead)}  ${chips.join('  ')}`
  if (lead) return escapeHtml(lead)
  if (chips.length) return chips.join('  ')
  return ''
}

/** Short status / badge line (draft, published, etc.). */
export function status(text: string): string {
  return italic(text)
}

/** Quiet footer caption (author, hints). */
export function caption(text: string): string {
  return italic(text)
}

export type NumberedListItem = {
  title: string
  /** Right-side meta in the app (key · bpm · meter) — shown after an em dash. */
  meta?: string | null
}

/**
 * Numbered list ≈ setlist rows.
 * `1. Title — Em · 72 · 4/4`
 */
export function numberedList(items: NumberedListItem[]): string {
  if (!items.length) return ''
  return items
    .map((item, index) => {
      const n = index + 1
      const name = bold(item.title)
      const meta = item.meta?.trim()
      return meta ? `${n}. ${name} — ${code(meta)}` : `${n}. ${name}`
    })
    .join('\n')
}

/** Empty / placeholder line inside a list section. */
export function emptyList(text: string): string {
  return italic(text)
}

/**
 * Confirmation / action summary block:
 * title + optional details + optional caption.
 */
export function confirmAction(params: {
  title: string
  details?: string[]
  caption?: string
}): string {
  return lines(
    title(params.title),
    params.details?.length ? sep() : false,
    ...(params.details ?? []).map((d) => escapeHtml(d)),
    params.caption ? sep() : false,
    params.caption ? caption(params.caption) : false,
  )
}

/** Meta string helper re-export for composers. */
export { joinMeta, lines, sep, bold, italic, code, escapeHtml }
