/**
 * Build web/src/lib/nfl/data/nfl-awards.json from Wikipedia's AP award tables.
 * Checks each season 1999 on against the season page's own awards table where
 * there is one, and against our stats (played that season, offence/defence,
 * rookie year). Prints every mismatch; decides nothing by itself.
 * Usage: cd web && npx tsx scripts/nfl-awards.mts
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { parseAwardPage, parseRookiePage, parseSeasonPage, linkWinner, normName, OFFENCE } = await import(join(webDir, 'src/lib/nfl/awardsParse.ts'))
const { db } = await import(join(webDir, 'src/lib/db.ts'))

const UA = { 'User-Agent': 'besta-spain-nfl/1.0' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** One request a second, and on 429 wait as long as Wikipedia asks (or longer each time). */
async function page(title: string): Promise<string> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2&redirects=1`
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(1000)
    const res = await fetch(url, { headers: UA })
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after')) || 10 * (attempt + 1)
      console.log(`  ${title}: 429, bíð ${wait} s`)
      await sleep(wait * 1000)
      continue
    }
    if (!res.ok) throw new Error(`${title}: ${res.status}`)
    const j = await res.json()
    if (!j.parse) throw new Error(`${title}: ${JSON.stringify(j.error ?? j).slice(0, 120)}`)
    return j.parse.text
  }
  throw new Error(`${title}: gafst upp eftir endurteknar 429`)
}

const winners = [
  ...parseAwardPage(await page('AP_NFL_Most_Valuable_Player'), 'MVP'),
  ...parseAwardPage(await page('AP_NFL_Offensive_Player_of_the_Year'), 'OPOY'),
  ...parseAwardPage(await page('AP_NFL_Defensive_Player_of_the_Year'), 'DPOY'),
  ...parseAwardPage(await page('AP_NFL_Comeback_Player_of_the_Year'), 'CPOY'),
  ...parseRookiePage(await page('List_of_NFL_Rookie_of_the_Year_awards')),
]
const LAST = Math.max(...winners.map((w: any) => w.season))
console.log(`${winners.length} sigurvegarar, ${Math.min(...winners.map((w: any) => w.season))}-${LAST}`)

const issues: string[] = []
let compared = 0
let linked = 0
const out: any[] = []
for (const w of winners) out.push({ ...w, player_id: null })

for (let season = 1999; season <= LAST; season++) {
  // second source: the season page, when it carries the table
  const other = parseSeasonPage(await page(`${season}_NFL_season`), season)
  if (other.length) compared++
  for (const award of ['MVP', 'OPOY', 'DPOY', 'OROY', 'DROY', 'CPOY']) {
    const a = out.filter((w) => w.season === season && w.award === award).map((w) => normName(w.name)).sort()
    const b = other.filter((w: any) => w.award === award).map((w: any) => normName(w.name)).sort()
    if (other.length && JSON.stringify(a) !== JSON.stringify(b)) issues.push(`${season} ${award}: verðlaunasíða ${JSON.stringify(a)} / tímabilssíða ${JSON.stringify(b)}`)
  }
  // our stats: everyone who played that season
  const pool: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('nfl_player_season').select('player_id, name, position, rookie_season, games').eq('season', season).eq('season_type', 'REG').range(from, from + 999)
    if (error) throw error
    pool.push(...data!)
    if (data!.length < 1000) break
  }
  for (const w of out.filter((x) => x.season === season)) {
    const side = w.award === 'DPOY' || w.award === 'DROY' ? 'defence' : w.award === 'CPOY' ? undefined : 'offence'
    w.player_id = linkWinner(w.name, pool, side, w.award === 'OROY' || w.award === 'DROY' ? season : undefined)
    if (!w.player_id) { issues.push(`${season} ${w.award}: ${w.name} - engin örugg pörun`); continue }
    linked++
    const p = pool.find((x) => x.player_id === w.player_id)
    const off = OFFENCE.has(p.position)
    if ((w.award === 'OPOY' || w.award === 'OROY') && !off) issues.push(`${season} ${w.award}: ${w.name} er ${p.position}`)
    if ((w.award === 'DPOY' || w.award === 'DROY') && off) issues.push(`${season} ${w.award}: ${w.name} er ${p.position}`)
    if ((w.award === 'OROY' || w.award === 'DROY') && p.rookie_season !== season) issues.push(`${season} ${w.award}: ${w.name} nýliðaár ${p.rookie_season}`)
  }
}

const since = out.filter((w) => w.season >= 1999)
console.log(`frá 1999: ${since.length} sigurvegarar, ${linked} tengdir við leikmann`)
console.log(`tímabilssíður með verðlaunatöflu: ${compared} af ${LAST - 1999 + 1}`)
console.log(issues.length ? `\n${issues.length} frávik:\n  ${issues.join('\n  ')}` : '\nengin frávik')
out.sort((a, b) => b.season - a.season || a.award.localeCompare(b.award) || a.name.localeCompare(b.name))
writeFileSync(join(webDir, 'src/lib/nfl/data/nfl-awards.json'), JSON.stringify(out, null, 1) + '\n')
console.log(`skrifað: src/lib/nfl/data/nfl-awards.json (${out.length})`)
