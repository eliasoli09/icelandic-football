/**
 * Fetch the NFL news feeds now (the cron does it daily).
 * Usage: cd web && npx tsx scripts/nfl-news-fetch.mts
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { fetchNews } = await import(join(webDir, 'src/lib/nfl/newsIngest.ts'))
const { nflTeams } = await import(join(webDir, 'src/lib/nfl/queries.ts'))
const teams = (await nflTeams()).filter((t: any) => t.franchise === t.abbr)
console.log(await fetchNews(teams))
