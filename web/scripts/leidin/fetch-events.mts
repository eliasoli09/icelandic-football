/**
 * Goals and red cards of every Besta deild match of a season, read off the
 * KSÍ match pages. The game's scorer questions are built from this.
 *
 * Every match is checked against its own score: goals counted from the
 * timeline (own goals for the other side) must equal the result KSÍ shows on
 * the match card. A match that disagrees is written down with its warning, and
 * build.mts refuses to build a scorer question from a season that has one.
 *
 * Pages are cached, so a second run is offline and an interrupted run carries
 * on where it stopped.
 *
 * Usage: cd web && npx tsx scripts/leidin/fetch-events.mts [--league=lengjudeild] 2025 [2024 ...]
 * (Besta deild unless a league is named; other leagues write events-<league>-<season>.json)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { db } = await import(join(webDir, 'src/lib/db.ts'))
const { fetchPage } = await import(join(webDir, 'src/lib/ksi.ts'))
const { parseEvents, validateEvents } = await import(join(webDir, 'src/lib/ksiEvents.ts'))

const cacheDir = join(here, 'cache', 'pages')
mkdirSync(cacheDir, { recursive: true })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const league = process.argv.find((a) => a.startsWith('--league='))?.slice(9) ?? 'besta'
for (const season of process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number)) {
  const { data: teams } = await db().from('teams').select('id, name')
  const name = new Map<number, string>((teams ?? []).map((t: { id: number; name: string }) => [t.id, t.name]))
  const { data, error } = await db()
    .from('matches')
    .select('id, phase, home_team, away_team, home_goals, away_goals, status')
    .eq('league', league)
    .eq('season', season)
    .order('id')
  if (error) throw error
  const matches = (data ?? []).filter((m: { status: string; id: number }) => m.status === 'played' && m.id > 0)
  console.log(`${season}: ${matches.length} played matches`)

  const out = []
  for (const [i, m] of matches.entries()) {
    const file = join(cacheDir, `${m.id}.html`)
    let html: string
    if (existsSync(file)) html = readFileSync(file, 'utf-8')
    else {
      html = await fetchPage(`https://www.ksi.is/leikir-og-urslit/felagslid/leikur?id=${m.id}`)
      writeFileSync(file, html)
      await sleep(1200)
    }
    // substitutions and cards are kept too: they show which side a player was
    // on, which is how build.mts tells an own goal from a goal (KSÍ draws both
    // with the same ball, on the side the goal counted for)
    const events = parseEvents(html)
    const warnings = validateEvents(events, { homeGoals: m.home_goals, awayGoals: m.away_goals })
    out.push({
      id: m.id,
      phase: m.phase,
      home: name.get(m.home_team),
      away: name.get(m.away_team),
      score: [m.home_goals, m.away_goals],
      events,
      warnings,
    })
    if (warnings.length) console.log(`  ! ${m.id} ${name.get(m.home_team)}-${name.get(m.away_team)}: ${warnings.join('; ')}`)
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${matches.length}`)
  }
  writeFileSync(join(here, 'cache', league === 'besta' ? `events-${season}.json` : `events-${league}-${season}.json`), JSON.stringify(out, null, 1))
  console.log(`${season}: wrote ${out.length} matches, ${out.filter((m) => m.warnings.length).length} with warnings`)
}
