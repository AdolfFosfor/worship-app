/**
 * Official Telegram Bot API HTML (`parse_mode: "HTML"`).
 * Tags: b/strong, i/em, u/ins, s/strike/del, code, pre, a, tg-spoiler, blockquote.
 * @see https://core.telegram.org/bots/api#html-style
 */

/** Escape user/dynamic text before wrapping in HTML tags. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function bold(text: string): string {
  return `<b>${escapeHtml(text)}</b>`
}

export function italic(text: string): string {
  return `<i>${escapeHtml(text)}</i>`
}

export function code(text: string): string {
  return `<code>${escapeHtml(text)}</code>`
}

export function link(text: string, url: string): string {
  if (!/^https?:\/\//i.test(url)) return escapeHtml(text)
  return `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`
}

/** Join non-empty lines with `\n`. Skips null/undefined/false/''. */
export function lines(
  ...parts: Array<string | null | undefined | false>
): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join('\n')
}

/** Blank line between blocks (visual separator without decorative characters). */
export function sep(): string {
  return ''
}

/** Middle-dot join for meta chips: `a · b · c`. */
export function joinMeta(...parts: Array<string | null | undefined | false>): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim())
    .join(' · ')
}
