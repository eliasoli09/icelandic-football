/**
 * Everything the FIFA ratings are made from, for every player who has played
 * in the Besta deild this season:
 *
 * - the starting elevens from each KSÍ match report, and the substitutions,
 *   goals and cards from match_events, so minutes are counted for everyone
 *   (events alone miss a starter who is never subbed, booked or on the sheet)
 * - club strength from team_elo_current
 * - the SofaScore season snapshot, where a player has one
 * - position, age and nationality from each club's Transfermarkt squad page
 *
 * Writes scripts/fifa/players.json. Usage: cd web && npx tsx scripts/fifa/gather.mts [--cache DIR]
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
const { db } = await import(join(webDir, 'src/lib/db.ts'))
const { parseKsiReport } = await import(join(here, '../xi/parse.ts'))
const { normalise } = await import(join(webDir, 'src/lib/topp10/normalise.ts'))
const { inferPositions } = await import(join(webDir, 'src/lib/positions.ts'))

const SEASON = 2026
const arg = (name: string) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined
const cacheDir = arg('--cache') ?? join(tmpdir(), 'fifa-cache')
mkdirSync(cacheDir, { recursive: true })

/** Transfermarkt club ids for this season's twelve, by our team name. */
const TM_CLUB: Record<string, string> = {
  'Breiðablik': '3737', 'FH': '1185', 'Fram': '3832', 'ÍA': '1231', 'ÍBV': '8036', 'KA': '1839',
  'Keflavík': '8037', 'KR': '3237', 'Stjarnan': '21875', 'Valur': '1033', 'Víkingur R.': '5849', 'Þór': '21864',
}

const UA = 'BestaSpain-Leikir/1.0 (https://islensk-fotbolti.vercel.app; player ratings)'
const PAUSE: Record<string, number> = { 'www.transfermarkt.com': 5000, 'www.ksi.is': 1000 }
const last = new Map<string, number>()
async function get(url: string, key = url): Promise<string> {
  const file = join(cacheDir, key.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_').slice(0, 200))
  if (existsSync(file)) return readFileSync(file, 'utf-8')
  const host = new URL(url).host
  const wait = (last.get(host) ?? 0) + (PAUSE[host] ?? 1000) - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last.set(host, Date.now())
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`${url} svaraði ${res.status}`)
  const body = await res.text()
  writeFileSync(file, body)
  return body
}

// ── the season's matches ─────────────────────────────────────────────

const { data: teamRows } = await db().from('teams').select('id, name')
const teamName = new Map<number, string>((teamRows ?? []).map((t: { id: number; name: string }) => [t.id, t.name]))
const { data: matchRows, error } = await db().from('matches')
  .select('id, date, home_team, away_team, home_goals, away_goals')
  .eq('league', 'besta').eq('season', SEASON).eq('status', 'played').order('date')
if (error || !matchRows?.length) throw new Error(`leikir fundust ekki: ${error?.message}`)

type Ev = { match_id: number; minute: number | null; type: string; player_ksi_id: number | null; player_name: string; side: 'home' | 'away' }
const events: Ev[] = []
const ids = matchRows.map((m: { id: number }) => m.id)
for (let i = 0; i < ids.length; i += 50) {
  const { data } = await db().from('match_events').select('match_id, minute, type, player_ksi_id, player_name, side').in('match_id', ids.slice(i, i + 50))
  events.push(...(data ?? []))
}

interface Player {
  ksiId: number
  ksiName: string
  team: string
  /** matches his club played from his first appearance on */
  teamMatches: number
  apps: number
  starts: number
  minutes: number
  goals: number
  yellow: number
  red: number
  keeperStarts: number
  firstMatch: string
  /** match by match, so a rating can be fitted on the season as it stood on any date */
  log: { date: string; minutes: number; start: boolean; goals: number; cards: number }[]
}
const players = new Map<number, Player>()
const teamMatchDates = new Map<string, string[]>()
const slot = (id: number, name: string, team: string, date: string): Player => {
  let p = players.get(id)
  if (!p) { p = { ksiId: id, ksiName: name, team, teamMatches: 0, apps: 0, starts: 0, minutes: 0, goals: 0, yellow: 0, red: 0, keeperStarts: 0, firstMatch: date, log: [] }; players.set(id, p) }
  p.team = team // the club he played for last
  return p
}

let n = 0
for (const m of matchRows as { id: number; date: string; home_team: number; away_team: number }[]) {
  const html = await get(`https://www.ksi.is/leikir-og-urslit/felagslid/leikur?id=${m.id}&banner-tab=report`)
  const report = parseKsiReport(html)
  const sides = { home: teamName.get(m.home_team)!, away: teamName.get(m.away_team)! }
  for (const s of ['home', 'away'] as const) teamMatchDates.set(sides[s], [...(teamMatchDates.get(sides[s]) ?? []), m.date])
  const mine = events.filter((e) => e.match_id === m.id)
  // a match lasts 90 minutes for the count; a sub in stoppage time played the few minutes left
  const out = new Map<number, number>(), inn = new Map<number, number>()
  for (const e of mine) {
    if (!e.player_ksi_id) continue
    const minute = Math.min(90, e.minute ?? 90)
    if (e.type === 'sub_out') out.set(e.player_ksi_id, minute)
    if (e.type === 'sub_in') inn.set(e.player_ksi_id, minute)
    if (e.type === 'red') out.set(e.player_ksi_id, Math.min(out.get(e.player_ksi_id) ?? 90, minute))
  }
  for (const s of ['home', 'away'] as const) {
    for (const sp of report.lineups[s]) {
      const p = slot(sp.ksiId, sp.name, sides[s], m.date)
      p.apps++; p.starts++
      if (sp.goalkeeper) p.keeperStarts++
      p.minutes += out.get(sp.ksiId) ?? 90
      p.log.push({ date: m.date.slice(0, 10), minutes: out.get(sp.ksiId) ?? 90, start: true, goals: 0, cards: 0 })
    }
  }
  for (const e of mine) {
    if (!e.player_ksi_id) continue
    const team = sides[e.side]
    if (e.type === 'sub_in') {
      const p = slot(e.player_ksi_id, e.player_name, team, m.date)
      const minutes = Math.max(1, (out.get(e.player_ksi_id) ?? 90) - (inn.get(e.player_ksi_id) ?? 90))
      p.apps++
      p.minutes += minutes
      p.log.push({ date: m.date.slice(0, 10), minutes, start: false, goals: 0, cards: 0 })
    }
  }
  for (const e of mine) {
    if (!e.player_ksi_id) continue
    const p = players.get(e.player_ksi_id)
    const entry = p?.log.find((l) => l.date === m.date.slice(0, 10))
    if (!p || !entry) continue
    if (e.type === 'goal') { p.goals++; entry.goals++ }
    if (e.type === 'yellow') { p.yellow++; entry.cards++ }
    if (e.type === 'red') { p.red++; entry.cards += 2 }
  }
  if (++n % 20 === 0) console.log(`${n}/${matchRows.length} leikskýrslur`)
}
for (const p of players.values()) p.teamMatches = (teamMatchDates.get(p.team) ?? []).filter((d) => d >= p.firstMatch).length

// ── club strength ────────────────────────────────────────────────────

const { data: eloRows } = await db().from('team_elo_current').select('team_id, elo_after')
const teamElo: Record<string, number> = {}
for (const r of eloRows ?? []) { const name = teamName.get(r.team_id); if (name && TM_CLUB[name]) teamElo[name] = r.elo_after }

// ── SofaScore ────────────────────────────────────────────────────────

const { data: sofa } = await db().from('sofascore_players').select('name, team, rating, appearances, goals, assists, extra').eq('season', SEASON)
const sofaPositions = inferPositions(sofa ?? [])

// ── Transfermarkt squads ─────────────────────────────────────────────

interface TmRow { name: string; number: number | null; position: string; born: string | null; nations: string[] }
function squad(html: string): TmRow[] {
  const rows: TmRow[] = []
  for (const tr of html.split(/<tr class="(?:odd|even)">/).slice(1)) {
    // captain and injury icons sit inside the link, after the name
    const name = tr.match(/<td class="hauptlink">\s*<a href="\/[^"]+\/profil\/spieler\/\d+">\s*([^<]+?)\s*(?:<span|<\/a>)/)
    const pos = tr.match(/<tr>\s*<td>\s*([A-Za-z- ]+?)\s*<\/td>\s*<\/tr>/)
    if (!name || !pos) continue
    const num = tr.match(/rn_nummer>(\d+)</)
    const born = tr.match(/<td class="zentriert">(\d{2})\/(\d{2})\/(\d{4})/)
    const flags = tr.split('</td>').find((c) => c.includes('flaggenrahmen') && !c.includes('verein')) ?? ''
    rows.push({
      name: name[1].replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
      number: num ? Number(num[1]) : null,
      position: pos[1],
      born: born ? `${born[3]}-${born[2]}-${born[1]}` : null,
      nations: [...flags.matchAll(/title="([^"]+)" alt="[^"]*" class="flaggenrahmen"/g)].map((f) => f[1]),
    })
  }
  return rows
}
const squads: Record<string, TmRow[]> = {}
for (const [team, id] of Object.entries(TM_CLUB)) {
  squads[team] = squad(await get(`https://www.transfermarkt.com/x/kader/verein/${id}/saison_id/2025/plus/1`))
  if (squads[team].length < 15) throw new Error(`Transfermarkt: of fáir í hópi ${team} (${squads[team].length})`)
}

const words = (s: string) => normalise(s).split(' ').filter(Boolean)
/**
 * The squad row for a player: the same whole name, else the same first and
 * last name, else the same last name and shirt number - and only when exactly
 * one squad member fits, so two Magnússons never trade positions.
 */
function tmMatch(p: Player, shirt: Set<number>): TmRow | null {
  const k = words(p.ksiName)
  const first = k[0], lastName = k[k.length - 1]
  const tests: ((t: TmRow, w: string[]) => boolean)[] = [
    (_t, w) => w.join(' ') === k.join(' '),
    (t, w) => w[0] === first && w[w.length - 1] === lastName && (t.number === null || shirt.has(t.number)),
    (_t, w) => w[0] === first && w[w.length - 1] === lastName,
    (t, w) => (w[w.length - 1] === lastName || k.includes(w[w.length - 1])) && t.number !== null && shirt.has(t.number),
  ]
  for (const test of tests) {
    const hits = squads[p.team].filter((t) => test(t, words(t.name)))
    if (hits.length === 1) return hits[0]
    if (hits.length > 1) return null
  }
  return null
}

// shirt numbers each player wore, from the reports
const shirts = new Map<number, Set<number>>()
for (const m of matchRows as { id: number }[]) {
  const report = parseKsiReport(await get(`https://www.ksi.is/leikir-og-urslit/felagslid/leikur?id=${m.id}&banner-tab=report`))
  for (const s of ['home', 'away'] as const) for (const sp of report.lineups[s]) shirts.set(sp.ksiId, (shirts.get(sp.ksiId) ?? new Set()).add(sp.number))
}

const sofaByName = new Map((sofa ?? []).map((s: { name: string }) => [normalise(s.name), s]))
function sofaMatch(p: Player, tmName: string | null) {
  for (const n of [p.ksiName, tmName].filter(Boolean) as string[]) {
    const hit = sofaByName.get(normalise(n))
    if (hit) return hit
  }
  // first and last name, when only one SofaScore player has them
  const k = words(p.ksiName)
  const hits = (sofa ?? []).filter((s: { name: string }) => { const w = words(s.name); return w[0] === k[0] && w[w.length - 1] === k[k.length - 1] })
  return hits.length === 1 ? hits[0] : null
}

const out = [...players.values()].map((p) => {
  const tm = tmMatch(p, shirts.get(p.ksiId) ?? new Set())
  const s = sofaMatch(p, tm?.name ?? null) as { name: string; rating: number; appearances: number; goals: number; assists: number; extra: Record<string, number> } | null
  return {
    ...p,
    teamElo: teamElo[p.team],
    tm: tm && { name: tm.name, position: tm.position, born: tm.born, nations: tm.nations },
    sofa: s && { name: s.name, rating: s.rating, appearances: s.appearances, goals: s.goals, assists: s.assists, position: sofaPositions.get(s.name) ?? null },
  }
})
const { data: loaded } = await db().from('sofascore_players').select('loaded_at').eq('season', SEASON).order('loaded_at', { ascending: false }).limit(1)
const teamDates = Object.fromEntries([...teamMatchDates].map(([t, d]) => [t, d.map((x) => x.slice(0, 10))]))
writeFileSync(join(here, 'players.json'), JSON.stringify({ season: SEASON, gathered: new Date().toISOString().slice(0, 10), sofaLoaded: loaded?.[0]?.loaded_at?.slice(0, 10) ?? null, matches: matchRows.length, teamElo, teamDates, players: out }, null, 1) + '\n')
console.log(`${out.length} leikmenn, ${out.filter((p) => p.tm).length} með Transfermarkt-stöðu, ${out.filter((p) => p.sofa).length} með SofaScore`)
