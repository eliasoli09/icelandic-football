/**
 * Load NFL player stats from nflverse - the same code the NFL cron runs.
 * Usage: cd web && npx tsx scripts/ingest-nfl-players.mts [season ...] [--all]
 *   --all  every season from 1999 to the current one (one-off, several minutes)
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { ingestPlayers } = await import(join(webDir, 'src/lib/nfl/playerIngest.ts'))
const current = new Date().getUTCMonth() >= 2 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1
const args = process.argv.slice(2)
const seasons = args.includes('--all')
  ? Array.from({ length: current - 1999 + 1 }, (_, i) => 1999 + i)
  : args.length ? args.map(Number) : [current]
const t0 = Date.now()
console.log(await ingestPlayers(seasons, console.log))
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`)
