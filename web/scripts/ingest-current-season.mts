/**
 * Load the season being played right now for the eight football-data.co.uk
 * leagues. The nightly cron does this on its own — this is the manual handle,
 * for backfilling a past season or checking the feed without writing.
 *
 * Usage: cd web && npx tsx scripts/ingest-current-season.mts [season] [--dry]
 *   season is the starting year: 2026 means 2026/27, and defaults to the
 *   season today falls in.
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { ingestCurrentSeason, seasonForDate } = await import(join(webDir, 'src/lib/currentSeason.ts'))

const args = process.argv.slice(2)
const season = Number(args.find((a) => /^\d{4}$/.test(a)) ?? seasonForDate())
const res = await ingestCurrentSeason(season, { dryRun: args.includes('--dry') })
console.log(JSON.stringify(res, null, 1))
