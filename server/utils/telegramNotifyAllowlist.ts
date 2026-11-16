/** Parse `NUXT_TELEGRAM_NOTIFY_ALLOWLIST` — comma/space-separated telegram ids. */
export function parseTelegramNotifyAllowlist(
  raw: string | number | Array<string | number> | undefined | null,
): number[] {
  // Nuxt may coerce a single numeric env value to number (e.g. 113785858).
  const text = Array.isArray(raw)
    ? raw.map(String).join(',')
    : String(raw ?? '').trim()
  if (!text || text === 'undefined' || text === 'null') return []
  const out: number[] = []
  for (const part of text.split(/[\s,;]+/)) {
    if (!part) continue
    const n = Number(part)
    if (Number.isFinite(n) && n > 0) out.push(Math.trunc(n))
  }
  return out
}

/**
 * If allowlist is non-empty — only those chat ids (dev / staging).
 * If empty — all candidates (production).
 */
export function filterTelegramNotifyRecipients(
  telegramIds: number[],
  allowlist: number[],
): number[] {
  if (!allowlist.length) return telegramIds
  const allowed = new Set(allowlist)
  return telegramIds.filter((id) => allowed.has(id))
}
