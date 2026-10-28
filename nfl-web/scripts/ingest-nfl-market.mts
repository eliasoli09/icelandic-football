/**
 * Fill Markaðurinn for a season - the same code the NFL cron runs.
 * Usage: cd nfl-web && npx tsx scripts/ingest-nfl-market.mts [season] [--all]
 *   --all  rewrite every completed round, not only the missing ones
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { ingestMarket } = await import(join(webDir, 'src/lib/nfl/marketIngest.ts'))
const args = process.argv.slice(2)
const season = Number(args.find((a) => /^\d{4}$/.test(a)) ?? (new Date().getUTCMonth() >= 2 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1))
const t0 = Date.now()
console.log(season, await ingestMarket(season, { all: args.includes('--all') }))
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`)
