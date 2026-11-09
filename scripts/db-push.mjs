#!/usr/bin/env node
/**
 * Push local supabase/migrations to the linked remote project.
 *
 * Prefers SUPABASE_DB_URL (session pooler, IPv4).
 * Else builds URL from SUPABASE_DB_PASSWORD + project defaults.
 *
 * Usage: npm run db:push
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const PROJECT_REF = 'rgyzoamdexcvbpwdmpep'
const POOLER_HOST = 'aws-1-eu-west-3.pooler.supabase.com'
const POOLER_PORT = '5432'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i <= 0) continue
    const key = trimmed.slice(0, i).trim()
    let value = trimmed.slice(i + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

loadEnvFile(resolve(ROOT, '.env'))
loadEnvFile(resolve(ROOT, '.env.local'))

function buildDbUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL

  const password = process.env.SUPABASE_DB_PASSWORD
  if (!password) return null

  const user = `postgres.${PROJECT_REF}`
  const encoded = encodeURIComponent(password)
  return `postgresql://${user}:${encoded}@${POOLER_HOST}:${POOLER_PORT}/postgres`
}

const dbUrl = buildDbUrl()

if (!dbUrl) {
  console.error(`Missing DB credentials.

Add one of these to .env (gitignored):

  SUPABASE_DB_URL=postgresql://postgres.${PROJECT_REF}:[PASSWORD]@${POOLER_HOST}:${POOLER_PORT}/postgres

or

  SUPABASE_DB_PASSWORD=your-database-password

Get session pooler string: Supabase Dashboard → Connect → Session pooler.
`)
  process.exit(1)
}

const args = ['supabase', 'db', 'push', `--remote=${dbUrl}`, '--yes']
console.log('→ npx supabase db push --remote=<pooler> --yes')

const result = spawnSync('npx', args, {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
  shell: false,
})

process.exit(result.status ?? 1)
