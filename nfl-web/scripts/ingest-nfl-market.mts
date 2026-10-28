/**
 * Fill Markaðurinn for a season - the same code the NFL cron runs.
 * Usage: cd nfl-web && npx tsx scripts/ingest-nfl-market.mts [season] [--all]
 *   --all  rewrite every completed round, not only the missing ones and the newest,
 *          with each round's injury list taken from nflverse's history (nfl_injury only
 *          keeps the weeks the cron has seen, and is left untouched)
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
const { injuriesUrl, parseInjuries, rostersUrl } = await import(join(webDir, 'src/lib/nfl/injuries.ts'))
const args = process.argv.slice(2)
const season = Number(args.find((a) => /^\d{4}$/.test(a)) ?? (new Date().getUTCMonth() >= 2 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1))
const all = args.includes('--all')

async function text(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`nflverse svaraði ${res.status}: ${url}`)
  return res.text()
}

const t0 = Date.now()
let injuries
if (all) {
  const [report, roster] = await Promise.all([text(injuriesUrl(season)), text(rostersUrl(season))])
  injuries = async (week: number) => {
    const w = parseInjuries(report, roster, season, week)
    return w ? { week: w.week, rows: w.rows } : { week: null, rows: [] }
  }
}
console.log(season, await ingestMarket(season, { all, injuries }))
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`)
