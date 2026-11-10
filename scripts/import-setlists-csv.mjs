#!/usr/bin/env node
/**
 * Перезаполнение сет-листов из scripts/data/setlists-import.json
 * (сгенерирован из Worship_Team_Setlists.csv).
 *
 * Usage:
 *   node scripts/import-setlists-csv.mjs [--dry-run]
 *
 * Requires .env: NUXT_PUBLIC_SUPABASE_URL, NUXT_SUPABASE_SERVICE_ROLE_KEY
 * Optional: IMPORT_USER_EMAIL (default adolffosfor@gmail.com)
 *
 * Удаляет все сет-листы workspace и создаёт заново.
 * Песни матчит по названию (с алиасами); недостающие создаёт stub'ами.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const dataPath = join(root, 'scripts/data/setlists-import.json')

function loadEnv() {
  try {
    const raw = readFileSync(join(root, '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      let val = m[2]
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = val
    }
  } catch {
    // rely on process.env
  }
}

loadEnv()

const url = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY
const userEmail = process.env.IMPORT_USER_EMAIL || 'adolffosfor@gmail.com'

if (!url || !serviceKey) {
  console.error('Missing NUXT_PUBLIC_SUPABASE_URL or NUXT_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

/** Нормализация для матчинга названий песен. */
function normSong(title) {
  return String(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘ʻʼ]/g, "'")
    .replace(/[^a-z0-9а-яёăâîșț']+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * CSV-ключ → ключ существующей песни в библиотеке (после normSong).
 * Если значение = сам ключ — просто явный noop.
 */
const SONG_ALIASES = new Map(
  [
    ['miracles', 'miracles bethel'],
    ['light of the world sing hallelujah', 'light of the world'],
    ['psalm 46', 'psalm'],
  ].map(([from, to]) => [normSong(from), normSong(to)]),
)

/** @type {Array<{ serviceDate: string, title: string, type: string, songs: string[], expected: number }>} */
const setlists = JSON.parse(readFileSync(dataPath, 'utf8'))
const bad = setlists.filter((s) => s.songs.length !== s.expected || !s.serviceDate)
console.log(`Data: ${setlists.length} setlists from ${dataPath}`)
if (bad.length) {
  console.warn(
    'Count mismatches:',
    bad.slice(0, 5).map((b) => `${b.serviceDate} exp=${b.expected} got=${b.songs.length}`),
  )
}

const uniqueSongs = [...new Set(setlists.flatMap((s) => s.songs))]
console.log(`Unique song titles: ${uniqueSongs.length}`)
console.log(
  'Events:',
  setlists
    .filter((s) => s.type === 'Ивент')
    .map((s) => `${s.serviceDate} ${s.title} (${s.songs.length})`)
    .join(' | '),
)

if (dryRun) {
  console.log('Dry run — nothing written')
  process.exit(0)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 200,
})
if (listError) {
  console.error(listError)
  process.exit(1)
}

const user = listed.users.find((u) => u.email?.toLowerCase() === userEmail.toLowerCase())
if (!user) {
  console.error(`User not found: ${userEmail}`)
  process.exit(1)
}

const { data: membership, error: memError } = await supabase
  .from('workspace_members')
  .select('workspace_id, role')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (memError) {
  console.error(memError)
  process.exit(1)
}
if (!membership) {
  console.error('User has no workspace membership')
  process.exit(1)
}

const workspaceId = membership.workspace_id
console.log(`Workspace: ${workspaceId} (role ${membership.role})`)

const { data: existingSongs, error: songsError } = await supabase
  .from('songs')
  .select('id, title')
  .eq('workspace_id', workspaceId)

if (songsError) {
  console.error(songsError)
  process.exit(1)
}

/** @type {Map<string, { id: string, title: string }>} */
const songByNorm = new Map()
for (const s of existingSongs ?? []) {
  songByNorm.set(normSong(s.title), s)
}

function resolveSong(csvTitle) {
  const key = normSong(csvTitle)
  const alias = SONG_ALIASES.get(key)
  if (alias && songByNorm.has(alias)) return songByNorm.get(alias)
  return songByNorm.get(key) ?? null
}

let createdSongs = 0
for (const title of uniqueSongs) {
  if (resolveSong(title)) continue
  const { data, error } = await supabase
    .from('songs')
    .insert({
      workspace_id: workspaceId,
      title,
      key: 'C',
      capo: 0,
      chords: null,
      lyrics: null,
      youtube_url: null,
      created_by: user.id,
    })
    .select('id, title')
    .single()
  if (error) {
    console.error('Create song fail', title, error.message)
    process.exit(1)
  }
  songByNorm.set(normSong(data.title), data)
  createdSongs += 1
  console.log('Created song stub:', title)
}
console.log(`Song stubs created: ${createdSongs}`)

const { data: oldSetlists, error: oldError } = await supabase
  .from('setlists')
  .select('id')
  .eq('workspace_id', workspaceId)

if (oldError) {
  console.error(oldError)
  process.exit(1)
}

const oldIds = (oldSetlists ?? []).map((s) => s.id)
if (oldIds.length) {
  const { error: delItemsError } = await supabase
    .from('setlist_items')
    .delete()
    .in('setlist_id', oldIds)
  if (delItemsError) {
    console.error('Delete items fail', delItemsError)
    process.exit(1)
  }
  const { error: delSetsError } = await supabase
    .from('setlists')
    .delete()
    .eq('workspace_id', workspaceId)
  if (delSetsError) {
    console.error('Delete setlists fail', delSetsError)
    process.exit(1)
  }
  console.log(`Deleted ${oldIds.length} old setlists`)
}

let insertedSets = 0
let insertedItems = 0
let missingRefs = 0

for (const row of setlists) {
  const { data: setlist, error: setError } = await supabase
    .from('setlists')
    .insert({
      workspace_id: workspaceId,
      title: row.title,
      service_date: row.serviceDate,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (setError) {
    console.error('Insert setlist fail', row.serviceDate, row.title, setError.message)
    process.exit(1)
  }
  insertedSets += 1

  const items = []
  for (let i = 0; i < row.songs.length; i++) {
    const songTitle = row.songs[i]
    const song = resolveSong(songTitle)
    if (!song) {
      console.error('Unresolved song', songTitle, 'in', row.serviceDate)
      missingRefs += 1
      continue
    }
    items.push({
      setlist_id: setlist.id,
      song_id: song.id,
      position: i,
      key: null,
    })
  }

  if (items.length) {
    const { error: itemsError } = await supabase.from('setlist_items').insert(items)
    if (itemsError) {
      console.error('Insert items fail', row.serviceDate, itemsError.message)
      process.exit(1)
    }
    insertedItems += items.length
  }
}

console.log(
  `Done. setlists=${insertedSets} items=${insertedItems} missingRefs=${missingRefs} songStubs=${createdSongs}`,
)
