/** Allow only same-app absolute paths (no protocol / open redirect). */
export function safeInternalPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    return fallback
  }
  return path
}
