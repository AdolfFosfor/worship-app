export type SongViewMode = 'chart' | 'lyrics' | 'lyricsChords'

const KEY = 'worship-song-view-mode'

export function readSongViewMode(): SongViewMode {
  if (!import.meta.client) return 'chart'
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'chart' || v === 'lyrics' || v === 'lyricsChords') return v
  } catch {
    // ignore
  }
  return 'chart'
}

export function writeSongViewMode(mode: SongViewMode) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // ignore
  }
}

/** Pick a valid mode given what the song actually has. */
export function resolveSongViewMode(
  preferred: SongViewMode,
  hasChart: boolean,
  hasLyrics: boolean,
): SongViewMode {
  if (hasChart && hasLyrics) return preferred
  if (hasChart) return 'chart'
  if (hasLyrics) return preferred === 'lyricsChords' ? 'lyricsChords' : 'lyrics'
  return 'chart'
}
