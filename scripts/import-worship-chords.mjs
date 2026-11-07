#!/usr/bin/env node
/**
 * Import scripts/data/worship-chords.md into the user's workspace library.
 *
 * Usage:
 *   node scripts/import-worship-chords.mjs [--dry-run]
 *
 * Requires .env: NUXT_PUBLIC_SUPABASE_URL, NUXT_SUPABASE_SERVICE_ROLE_KEY
 * Optional: IMPORT_USER_EMAIL (default adolffosfor@gmail.com)
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { parseWorshipChordsMarkdown } from './lib/parseWorshipChords.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')

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

const md = readFileSync(join(root, 'scripts/data/worship-chords.md'), 'utf8')
const songs = parseWorshipChordsMarkdown(md)

console.log(`Parsed ${songs.length} songs`)
const withCapo = songs.filter((s) => s.capo > 0)
console.log(`With capo: ${withCapo.length}`)
console.log(
  'Sample:',
  songs
    .filter((s) => s.capo > 0)
    .slice(0, 5)
    .map((s) => `${s.title} [${s.key} capo ${s.capo}]`)
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

const { data: existing, error: existingError } = await supabase
  .from('songs')
  .select('id, title')
  .eq('workspace_id', workspaceId)

if (existingError) {
  console.error(existingError)
  process.exit(1)
}

const byTitle = new Map((existing ?? []).map((s) => [s.title.toLowerCase(), s.id]))

let inserted = 0
let updated = 0
let failed = 0

for (const song of songs) {
  const payload = {
    workspace_id: workspaceId,
    title: song.title,
    key: song.key,
    capo: song.capo,
    chords: song.chords,
    lyrics: null,
    youtube_url: null,
    created_by: user.id,
  }

  const existingId = byTitle.get(song.title.toLowerCase())
  if (existingId) {
    const { error } = await supabase
      .from('songs')
      .update({
        key: payload.key,
        capo: payload.capo,
        chords: payload.chords,
      })
      .eq('id', existingId)
    if (error) {
      console.error('Update fail', song.title, error.message)
      failed += 1
    } else {
      updated += 1
    }
  } else {
    const { error } = await supabase.from('songs').insert(payload)
    if (error) {
      console.error('Insert fail', song.title, error.message)
      failed += 1
    } else {
      inserted += 1
    }
  }
}

console.log(`Done. inserted=${inserted} updated=${updated} failed=${failed}`)
