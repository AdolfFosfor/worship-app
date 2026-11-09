const RECENTS_PREFIX = 'worship-chord-recents:'
const FAVORITES_PREFIX = 'worship-chord-favorites:'
const MAX_RECENTS = 16

function storageKey(prefix: string, userId: string) {
  return `${prefix}${userId || 'anon'}`
}

function readList(key: string): string[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string' && x.length > 0)
      : []
  } catch {
    return []
  }
}

function writeList(key: string, list: string[]) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // private mode / quota
  }
}

export function readRecentChords(userId: string): string[] {
  return readList(storageKey(RECENTS_PREFIX, userId))
}

export function pushRecentChord(userId: string, symbol: string) {
  const trimmed = symbol.trim()
  if (!trimmed) return
  const key = storageKey(RECENTS_PREFIX, userId)
  const next = [trimmed, ...readList(key).filter((c) => c !== trimmed)].slice(0, MAX_RECENTS)
  writeList(key, next)
}

export function readFavoriteChords(userId: string): string[] {
  return readList(storageKey(FAVORITES_PREFIX, userId))
}

export function toggleFavoriteChord(userId: string, symbol: string): string[] {
  const trimmed = symbol.trim()
  if (!trimmed) return readFavoriteChords(userId)
  const key = storageKey(FAVORITES_PREFIX, userId)
  const current = readList(key)
  const next = current.includes(trimmed)
    ? current.filter((c) => c !== trimmed)
    : [...current, trimmed]
  writeList(key, next)
  return next
}

export function isFavoriteChord(userId: string, symbol: string): boolean {
  return readFavoriteChords(userId).includes(symbol.trim())
}
