/**
 * Load NFL games from nflverse - same code path as /api/cron/nfl.
 * Usage: cd web && npx tsx scripts/ingest-nfl.mts [--all]
 *   --all  every season since 1999 (one-off backfill for the Elo in part 2)
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const t0 = Date.now()
const { ingestNfl } = await import(join(webDir, 'src/lib/nfl/ingest.ts'))
console.log(JSON.stringify(await ingestNfl({ all: process.argv.includes('--all') }), null, 2))
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`)
