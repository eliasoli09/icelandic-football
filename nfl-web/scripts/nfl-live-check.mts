/**
 * Check API-American-Football with the key in .env.local before the live box
 * relies on it: quota left, whether the plan covers this season, and one day's
 * games through our parser and team matching.
 * Usage: cd nfl-web && npx tsx scripts/nfl-live-check.mts [YYYY-MM-DD]   (Eastern date; costs 3 requests)
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { API_SPORTS_BASE, parseGames, teamAbbr } = await import(join(webDir, 'src/lib/nfl/live.ts'))
const { nflCurrentSeason, nflTeams } = await import(join(webDir, 'src/lib/nfl/queries.ts'))
const key = process.env.API_SPORTS_NFL_KEY
if (!key) { console.error('API_SPORTS_NFL_KEY vantar í .env.local'); process.exit(1) }
const get = async (path: string) => (await fetch(`${API_SPORTS_BASE}${path}`, { headers: { 'x-apisports-key': key } })).json()

const status = await get('/status')
console.log('Áskrift:', JSON.stringify(status.response?.subscription ?? status.errors), '| fyrirspurnir í dag:', JSON.stringify(status.response?.requests ?? null))
const season = await nflCurrentSeason()
const league = await get('/leagues?id=1')
const seasons = (league.response?.[0]?.seasons ?? []).map((s: { year: number | string }) => String(s.year)).sort()
console.log(`Tímabil í boði fyrir NFL: ${seasons.slice(-5).join(', ')}${seasons.includes(String(season)) ? '' : `  << ${season} VANTAR: ókeypis áskriftin nær líklega ekki yfir það`}`)

const date = process.argv[2] ?? new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10)
const raw = await get(`/games?league=1&season=${season}&date=${date}&timezone=America/New_York`)
if (raw.errors && Object.keys(raw.errors).length) console.log('Villa:', JSON.stringify(raw.errors))
if (raw.response?.[0]) console.log('Fyrsti leikur, hrár:', JSON.stringify(raw.response[0]).slice(0, 900))
const clubs = (await nflTeams()).filter((t: { franchise: string; abbr: string }) => t.franchise === t.abbr)
for (const g of parseGames(raw)) {
  console.log(`${g.away} @ ${g.home} -> ${teamAbbr(g.away, clubs) ?? '??'} @ ${teamAbbr(g.home, clubs) ?? '??'} | ${g.awayScore}-${g.homeScore} | ${g.status} q${g.quarter ?? '-'} ${g.clock ?? ''}`)
}
