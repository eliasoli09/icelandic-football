/**
 * Draft the NFL articles that are due now (the cron does this daily), and
 * write their text if NEWS_LLM_* is set.
 * Usage: cd web && npx tsx scripts/nfl-articles.mts [--now 2026-10-20T08:00:00Z]
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { draftArticles } = await import(join(webDir, 'src/lib/nfl/articles/ingest.ts'))
const { nflCurrentSeason } = await import(join(webDir, 'src/lib/nfl/queries.ts'))
const i = process.argv.indexOf('--now')
const now = i > 0 ? new Date(process.argv[i + 1]) : new Date()
console.log(JSON.stringify(await draftArticles(await nflCurrentSeason(), now), null, 2))
