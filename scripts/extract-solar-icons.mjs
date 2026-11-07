/**
 * Собирает app/assets/icons/solar.json только из имён в app/utils/icons.ts.
 * Запуск: node scripts/extract-solar-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import solar from '@iconify-json/solar/icons.json' with { type: 'json' }

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconsSource = readFileSync(join(root, 'app/utils/icons.ts'), 'utf8')
const names = [...iconsSource.matchAll(/:\s*'([a-z0-9-]+)'/g)].map((m) => m[1])
const unique = [...new Set(names)].sort()

const missing = unique.filter((name) => !solar.icons[name])
if (missing.length) {
  console.error('Missing Solar icons:', missing.join(', '))
  process.exit(1)
}

const subset = {
  prefix: solar.prefix,
  width: solar.width,
  height: solar.height,
  icons: Object.fromEntries(unique.map((name) => [name, solar.icons[name]])),
}

const outPath = join(root, 'app/assets/icons/solar.json')
writeFileSync(outPath, `${JSON.stringify(subset)}\n`)
console.log(`Wrote ${unique.length} icons → ${outPath}`)
