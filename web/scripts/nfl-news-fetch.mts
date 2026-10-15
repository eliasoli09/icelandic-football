/**
 * Fetch the NFL news feeds now (the cron does it daily).
 * Usage: cd web && npx tsx scripts/nfl-news-fetch.mts
 */
import { join } from 'path'
import { webDir } from './_env.mts'

const { fetchNews } = await import(join(webDir, 'src/lib/nfl/newsIngest.ts'))
const { nflTeams } = await import(join(webDir, 'src/lib/nfl/queries.ts'))
const teams = (await nflTeams()).filter((t: any) => t.franchise === t.abbr)
console.log(await fetchNews(teams))
