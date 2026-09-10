/**
 * Run the nightly ingest + recompute from this machine — same code path as
 * /api/cron/ingest. Use to backfill immediately after a scraper fix, or when
 * the Vercel cron is unavailable.
 * Usage: cd web && npx tsx scripts/refresh-local.mts
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
const { ingestSeason, recomputeAll } = await import(join(webDir, 'src/lib/recompute.ts'))
console.log('ingest:', JSON.stringify(await ingestSeason()))
// --full rebuilds Elo from scratch; needed after backfilling history into a
// pool that already had later matches rated
const full = process.argv.includes('--full')
console.log('recompute:', JSON.stringify(await recomputeAll({ fullElo: full })))
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`)
