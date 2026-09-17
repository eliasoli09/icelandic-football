/**
 * The players of every verified side, for the draft, and the side's strength.
 *
 * - Who played: the starting eleven in the KSÍ report of each league match,
 *   and the goals from the match page's events.
 * - Where he played: the club's Transfermarkt squad for that season. Transfermarkt
 *   numbers Icelandic seasons inconsistently, so the squad page is read for the
 *   year and the year before, and the one naming more of KSÍ's starters is used.
 *   A player is in the draft only with a position from Transfermarkt, or as a
 *   goalkeeper in KSÍ's reports.
 * - How good: the side's place in the ranking sets its level, and a player
 *   rises above or falls below it by how often he started and, going forward,
 *   how often he scored.
 *
 * Writes src/lib/bikar/sides.json. Usage: cd web && npx tsx scripts/bikar/squads.mts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { parseKsiReport } = await import(join(webDir, 'scripts/xi/parse.ts'))
const { parseEvents } = await import(join(webDir, 'src/lib/ksiEvents.ts'))
const { normalise } = await import(join(webDir, 'src/lib/topp10/normalise.ts'))
const { respell } = await import(join(webDir, 'scripts/hver/parse.ts'))
const { rank } = await import(join(here, 'rank.ts'))
const { db } = await import(join(webDir, 'src/lib/db.ts'))

const verified = JSON.parse(readFileSync(join(here, 'teams.json'), 'utf-8'))
const cacheDir = join(tmpdir(), 'bikar-cache')
mkdirSync(cacheDir, { recursive: true })

const UA = 'BestaSpain-Leikir/1.0 (https://islensk-fotbolti.vercel.app; cup game)'
const PAUSE: Record<string, number> = { 'www.ksi.is': 1000, 'www.transfermarkt.com': 5000 }
const last = new Map<string, number>()
async function get(url: string): Promise<string> {
  const file = join(cacheDir, url.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_').slice(0, 200))
  if (existsSync(file)) return readFileSync(file, 'utf-8')
  const host = new URL(url).host
  for (let attempt = 0; ; attempt++) {
    const wait = (last.get(host) ?? 0) + (PAUSE[host] ?? 1000) - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    last.set(host, Date.now())
    let res: Response
    try { res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(60_000) }) }
    catch (err) {
      // a dropped connection: try again a little later
      if (attempt >= 3) throw err
      console.log(`${host}: ${(err as Error).message}, reyni aftur eftir 30 sek.`)
      await new Promise((r) => setTimeout(r, 30_000))
      continue
    }
    // a refusal means slow down: wait it out, never work around it
    if ((res.status === 403 || res.status === 429) && attempt < 3) {
      console.log(`${host} svaraði ${res.status}, bíð ${10 * 2 ** attempt} mínútur`)
      await new Promise((r) => setTimeout(r, 10 * 2 ** attempt * 60_000))
      continue
    }
    if (!res.ok) throw new Error(`${url} svaraði ${res.status}`)
    const body = await res.text()
    writeFileSync(file, body)
    return body
  }
}

/** Transfermarkt club ids, by our club id. */
const TM_CLUB: Record<string, string> = {
  kr: '3237', valur: '1033', fram: '3832', ia: '1231', fh: '1185', vikingur: '5849', keflavik: '8037',
  ibv: '8036', breidablik: '3737', ka: '1839', stjarnan: '21875', fylkir: '2576',
}

const FIFA_LINE: Record<string, 'GK' | 'DEF' | 'MID' | 'FWD'> = {
  'Goalkeeper': 'GK', 'Centre-Back': 'DEF', 'Left-Back': 'DEF', 'Right-Back': 'DEF', 'Defender': 'DEF', 'Sweeper': 'DEF',
  'Defensive Midfield': 'MID', 'Central Midfield': 'MID', 'Attacking Midfield': 'MID', 'Left Midfield': 'MID', 'Right Midfield': 'MID', 'midfield': 'MID', 'Midfield': 'MID',
  'Left Winger': 'FWD', 'Right Winger': 'FWD', 'Second Striker': 'FWD', 'Centre-Forward': 'FWD', 'Striker': 'FWD', 'attack': 'FWD', 'Attack': 'FWD',
}
const SHORT: Record<string, string> = {
  'Goalkeeper': 'GK', 'Centre-Back': 'CB', 'Left-Back': 'LB', 'Right-Back': 'RB', 'Defender': 'DEF', 'Sweeper': 'SW',
  'Defensive Midfield': 'CDM', 'Central Midfield': 'CM', 'Attacking Midfield': 'CAM', 'Left Midfield': 'LM', 'Right Midfield': 'RM', 'midfield': 'MID', 'Midfield': 'MID',
  'Left Winger': 'LW', 'Right Winger': 'RW', 'Second Striker': 'CF', 'Centre-Forward': 'ST', 'Striker': 'ST', 'attack': 'FWD', 'Attack': 'FWD',
}

interface TmRow { name: string; position: string }
function squad(html: string): TmRow[] {
  const rows: TmRow[] = []
  for (const tr of html.split(/<tr class="(?:odd|even)">/).slice(1)) {
    const name = tr.match(/<td class="hauptlink">\s*<a href="\/[^"]+\/profil\/spieler\/\d+">\s*([^<]+?)\s*(?:<span|<\/a>)/)
    const pos = tr.match(/<tr>\s*<td>\s*([A-Za-z- ]+?)\s*<\/td>\s*<\/tr>/)
    if (name && pos) rows.push({ name: name[1].replace(/&#039;/g, "'").replace(/&amp;/g, '&'), position: pos[1] })
  }
  return rows
}
const words = (s: string) => normalise(s).split(' ').filter(Boolean)
/** The same whole name, else the same first and last name, when exactly one squad member has it. */
function findIn(rows: TmRow[], name: string): TmRow | null {
  const k = words(name)
  for (const test of [(w: string[]) => w.join(' ') === k.join(' '), (w: string[]) => w[0] === k[0] && w[w.length - 1] === k[k.length - 1]]) {
    const hits = rows.filter((r) => test(words(r.name)))
    if (hits.length === 1) return hits[0]
    if (hits.length > 1) return null
  }
  return null
}

const { data: teamRows } = await db().from('teams').select('id, name')
const teamName = new Map<number, string>((teamRows ?? []).map((t: { id: number; name: string }) => [t.id, t.name]))

const ranked = rank(verified.teams)
const top = ranked[0].score, bottom = ranked[ranked.length - 1].score
/** The best side's regulars sit at 86, the lowest-ranked side's at 72. */
const levelOf = (score: number) => 72 + (86 - 72) * (score - bottom) / (top - bottom)

const sides = []
for (const [i, side] of ranked.entries()) {
  const ids: number[] = side.reportIds
  const { data: rows } = await db().from('matches').select('id, home_team, away_team').in('id', ids)
  const players = new Map<number, { name: string; starts: number; keeper: number; goals: number }>()
  for (const m of rows ?? []) {
    const base = `https://www.ksi.is/leikir-og-urslit/felagslid/leikur?id=${m.id}`
    let report
    try { report = parseKsiReport(await get(`${base}&banner-tab=report`)) } catch { continue }
    // which side of the report is ours: our database's team names are the club labels
    const key = normalise(teamName.get(m.home_team)!) === normalise(side.label) ? 'home'
      : normalise(teamName.get(m.away_team)!) === normalise(side.label) ? 'away' : null
    if (!key) throw new Error(`${side.label} ${side.year}: hvorugt lið leiks ${m.id}`)
    for (const p of report.lineups[key]) {
      const x = players.get(p.ksiId) ?? { name: p.name, starts: 0, keeper: 0, goals: 0 }
      x.starts++; if (p.goalkeeper) x.keeper++
      players.set(p.ksiId, x)
    }
    for (const e of parseEvents(await get(base))) {
      if ((e.type === 'goal' || e.type === 'penalty') && e.side === key && e.playerKsiId && players.has(e.playerKsiId)) players.get(e.playerKsiId)!.goals++
    }
  }

  // the Transfermarkt season that names more of the starters
  const tmId = TM_CLUB[side.club]
  let best: TmRow[] = [], bestHits = -1, bestSeason = 0
  for (const s of [side.year - 1, side.year]) {
    const rowsTm = squad(await get(`https://www.transfermarkt.com/x/kader/verein/${tmId}/saison_id/${s}/plus/1`))
    const hits = [...players.values()].filter((p) => p.starts >= 3 && findIn(rowsTm, p.name)).length
    if (hits > bestHits) { best = rowsTm; bestHits = hits; bestSeason = s }
  }

  const level = levelOf(side.score)
  const games = side.record.games
  const pool = []
  for (const [ksiId, p] of players) {
    if (p.starts < 3) continue
    const tm = findIn(best, p.name)
    const line = tm ? FIFA_LINE[tm.position] : p.keeper > p.starts / 2 ? 'GK' : undefined
    if (!line) continue
    const share = p.starts / games
    const scoring = line === 'FWD' || line === 'MID' ? Math.min(10, 12 * p.goals / p.starts) : 0
    const rating = Math.max(55, Math.min(94, Math.round(level + 8 * (share - 0.7) + scoring)))
    pool.push({
      id: ksiId,
      name: tm ? respell(tm.name, p.name, p.name) : p.name,
      line,
      position: tm ? SHORT[tm.position] : 'GK',
      rating, starts: p.starts, goals: p.goals,
    })
  }
  pool.sort((a, b) => b.rating - a.rating)
  const xi = [...pool.filter((p) => p.line === 'GK').slice(0, 1), ...pool.filter((p) => p.line !== 'GK').slice(0, 10)]
  // the best eleven's average; where Transfermarkt placed too few of them, the side's level itself
  const strength = xi.length === 11 ? Math.round(xi.reduce((a, p) => a + p.rating, 0) / 11) : Math.round(level)
  sides.push({
    id: `${side.club}-${side.year}`, club: side.club, label: side.label, year: side.year, rank: i + 1, score: side.score,
    champion: side.champion, position: side.position, cupDouble: side.cupDouble, record: side.record, basis: side.basis,
    europe: side.europeSummary, europeTies: side.europe, strength, tmSeason: bestSeason, tmMatched: bestHits, players: pool,
  })
  console.log(`${i + 1}. ${side.label} ${side.year}: ${players.size} byrjuðu, ${pool.length} í draftinu (Transfermarkt ${bestSeason}, ${bestHits} fundust), styrkur ${strength}`)
}

mkdirSync(join(webDir, 'src/lib/bikar'), { recursive: true })
writeFileSync(join(webDir, 'src/lib/bikar/sides.json'), JSON.stringify({ sources: verified.sources, built: new Date().toISOString().slice(0, 10), sides }) + '\n')
