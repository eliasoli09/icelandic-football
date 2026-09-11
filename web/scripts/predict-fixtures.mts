/**
 * Predict every fixture we have a date for, using the squad as well as the
 * result history.
 *
 * Three inputs, in order of how much they move a number:
 *   Elo           — our own match history, every league
 *   xG form       — how well a club has been creating and conceding lately
 *   availability  — who is injured, suspended or a doubt this weekend
 *
 * Player-level data only exists for the Premier League, through the open FPL
 * dataset and its API, so only it gets all three. The other leagues run on Elo
 * and pick up xG form by themselves once 2026/27 has given each club six
 * matches of it.
 *
 * Usage: cd web && npx tsx scripts/predict-fixtures.mts [> spa.txt]
 */
import { readFileSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { db } = await import(join(webDir, 'src/lib/db.ts'))
const { predictMatch } = await import(join(webDir, 'src/lib/predict.ts'))
const { LEAGUES } = await import(join(webDir, 'src/lib/leagues.ts'))
const { XgForm, PlayerWeights, missingShare, adjustLambda, leagueScale } =
  await import(join(webDir, 'src/lib/playerForm.ts'))
const { divisionQuantile, seededRating } = await import(join(webDir, 'src/lib/newcomers.ts'))
const { fit: dcFit, predict: dcPredict, DC_BLEND } = await import(join(webDir, 'src/lib/dixonColes.ts'))

const FPL_REPO = '/Users/elias/FH leikmenn/Fantasy-Premier-League/data'
const DIVS: Record<string, string> = {
  E0: 'premier', E1: 'championship', SP1: 'laliga', I1: 'seriea',
  D1: 'bundesliga', F1: 'ligue1', N1: 'eredivisie', P1: 'primeira',
}
/** the feeds write short names; our database uses football-data.co.uk's */
const ALIAS: Record<string, string> = {
  'Man Utd': 'Man United', Spurs: 'Tottenham', Palace: 'Crystal Palace',
  'Sheffield Utd': 'Sheffield United',
  // the FPL API writes the full club name where our history has the short one
  'Hull City': 'Hull', 'Ipswich Town': 'Ipswich', 'Coventry City': 'Coventry',
}
const fix = (n: string) => ALIAS[n.trim()] ?? n.trim()
const UA = { 'User-Agent': 'Mozilla/5.0 (besta-spain; islensk-fotbolti.vercel.app)' }

// ── teams and current Elo ──────────────────────────────────────────────
const teamName = new Map<number, string>()
{
  const { data, error } = await db().from('teams').select('id, name')
  if (error) throw error
  for (const t of (data ?? []) as { id: number; name: string }[]) teamName.set(t.id, t.name)
}
const elo = new Map<string, number>()
{
  const { data, error } = await db().from('team_elo_current').select('team_id, elo_after')
  if (error) throw error
  for (const r of (data ?? []) as { team_id: number; elo_after: number }[]) {
    const n = teamName.get(r.team_id)
    if (n) elo.set(n, r.elo_after)
  }
}
const knownTeam = new Set(teamName.values())
const ratedMatches = new Map<string, number>()
{
  // team_elo_history, not team_elo — one row per club instead of 140k, which
  // also keeps an unpaged read from reporting every club as a newcomer
  const { data, error } = await db().from('team_elo_history').select('team_id, rated_matches')
  if (error) throw error
  for (const r of (data ?? []) as { team_id: number; rated_matches: number }[]) {
    const n = teamName.get(r.team_id)
    if (n) ratedMatches.set(n, r.rated_matches)
  }
}
/** filled once the current squads are known, one prior per division */
const prior = new Map<string, number | null>()
const rating = (t: string, league: string) =>
  seededRating(elo.get(t) ?? 1500, ratedMatches.get(t) ?? 0, prior.get(league) ?? null)

// ── matches, for pairings and for non-Premier xG ───────────────────────
interface Played {
  season: number; league: string; date: string
  home: string; away: string; hg: number; ag: number
  hxg: number | null; axg: number | null
}
const played: Played[] = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db().from('matches')
    .select('season, league, date, home_team, away_team, home_goals, away_goals, home_xg, away_xg')
    .eq('status', 'played').gte('season', 2015)
    .order('season').order('date', { nullsFirst: true }).order('id')
    .range(from, from + 999)
  if (error) throw error
  if (!data?.length) break
  for (const m of data as any[]) {
    played.push({
      season: m.season, league: m.league, date: (m.date ?? '').slice(0, 10),
      home: teamName.get(m.home_team) ?? '?', away: teamName.get(m.away_team) ?? '?',
      hg: m.home_goals, ag: m.away_goals, hxg: m.home_xg, axg: m.away_xg,
    })
  }
  if (data.length < 1000) break
}

// ── Premier League: team xG and player weight, from the FPL dataset ────
const plGoals = LEAGUES.premier.goals
const plAvg = (plGoals.home + plGoals.away) / 2
const plForm = new XgForm(plAvg)
const weights = new PlayerWeights()
{
  const teamXg = new Map<string, number>()      // `${date}|${team}`
  const squadDay = new Map<string, { player: string; xgi: number }[]>()
  for (const season of readdirSync(FPL_REPO).filter((d) => /^\d{4}-\d{2}$/.test(d)).sort()) {
    let text: string
    try { text = readFileSync(join(FPL_REPO, season, 'gws/merged_gw.csv'), 'utf-8') } catch { continue }
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    const head = lines.shift()!.split(',')
    const idx = ['name', 'team', 'expected_goal_involvements', 'expected_goals', 'kickoff_time']
      .map((n) => head.indexOf(n))
    if (idx.some((i) => i < 0)) continue
    const [iName, iTeam, iGi, iXg, iKick] = idx
    for (const line of lines) {
      const r = line.split(',')
      if (r.length < head.length) continue
      const date = (r[iKick] ?? '').slice(0, 10)
      if (!date) continue
      const team = fix(r[iTeam] ?? '')
      const k = `${date}|${team}`
      teamXg.set(k, (teamXg.get(k) ?? 0) + (Number(r[iXg]) || 0))
      const list = squadDay.get(k) ?? []
      list.push({ player: (r[iName] ?? '').trim(), xgi: Number(r[iGi]) || 0 })
      squadDay.set(k, list)
    }
  }
  // replay our own Premier League fixtures, so each side gets the other's xG
  let season = 0
  for (const m of played) {
    if (m.league !== 'premier') continue
    if (season && m.season !== season) plForm.newSeason()
    season = m.season
    const h = teamXg.get(`${m.date}|${m.home}`)
    const a = teamXg.get(`${m.date}|${m.away}`)
    if (h === undefined || a === undefined) continue
    plForm.record(m.home, h, a)
    plForm.record(m.away, a, h)
    for (const [team, side] of [[m.home, m.home], [m.away, m.away]] as [string, string][]) {
      for (const p of squadDay.get(`${m.date}|${side}`) ?? []) weights.record(team, p.player, p.xgi)
    }
  }
}

// ── other leagues: xG form from the stored match xG ────────────────────
const form = new Map<string, InstanceType<typeof XgForm>>([['premier', plForm]])
type Cfg = { source: string; goals: { home: number; away: number }; name: string; short: string }
for (const [key, cfg] of Object.entries(LEAGUES) as [string, Cfg][]) {
  if (key === 'premier' || cfg.source === 'ksi') continue
  const avg = (cfg.goals.home + cfg.goals.away) / 2
  const f = new XgForm(avg)
  for (const m of played) {
    if (m.league !== key || m.hxg === null || m.axg === null) continue
    f.record(m.home, m.hxg, m.axg)
    f.record(m.away, m.axg, m.hxg)
  }
  form.set(key, f)
}

// ── Dixon-Coles, one fit per league ───────────────────────────────────
// Elo carries a club's whole history in one number and follows it between
// divisions; this reads the entire scoreline but sees one league at a time.
// They are wrong in different ways, which is why the blend beats either.
const dc = new Map<string, ReturnType<typeof dcFit>>()
{
  const today = Date.now()
  const byLeague = new Map<string, { home: string; away: string; homeGoals: number; awayGoals: number; ageDays: number }[]>()
  for (const m of played) {
    if (!m.date) continue
    const cfg = (LEAGUES as Record<string, Cfg | undefined>)[m.league]
    if (!cfg) continue
    const ageDays = (today - Date.parse(m.date + 'T00:00:00Z')) / 86400000
    if (!(ageDays >= 0) || ageDays > 7 * 365) continue
    const list = byLeague.get(m.league) ?? []
    list.push({ home: m.home, away: m.away, homeGoals: m.hg, awayGoals: m.ag, ageDays })
    byLeague.set(m.league, list)
  }
  for (const [league, list] of byLeague) {
    if (list.length < 150) continue
    dc.set(league, dcFit(list))
  }
}

// ── who is missing, live ───────────────────────────────────────────────
const missing = new Map<string, number>()
const absentees = new Map<string, { name: string; weight: number; note: string }[]>()
try {
  const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', { headers: UA })
  const boot = (await res.json()) as any
  const clubs = new Map<number, string>(boot.teams.map((t: any) => [t.id, fix(t.name)]))
  const squads = new Map<string, { weight: number; absent: number }[]>()
  for (const e of boot.elements) {
    const club = clubs.get(e.team)
    if (!club) continue
    const w = weights.get(club, `${e.first_name} ${e.second_name}`.trim())
    // 'u' is almost always a completed transfer out, and the club has already
    // replaced him — the form numbers show that. Only count who is in the
    // squad but will not play.
    const absent =
      e.status === 'i' || e.status === 's' ? 1
      : e.status === 'd' ? 1 - (e.chance_of_playing_next_round ?? 50) / 100
      : 0
    const list = squads.get(club) ?? []
    list.push({ weight: w, absent })
    squads.set(club, list)
    if (absent > 0 && w > 0) {
      const a = absentees.get(club) ?? []
      a.push({ name: e.web_name, weight: w, note: String(e.news ?? '').slice(0, 52) })
      absentees.set(club, a)
    }
  }
  for (const [club, list] of squads) missing.set(club, missingShare(list))
} catch (err) {
  console.error(`# leikmannastaða ekki sótt: ${err instanceof Error ? err.message : err}`)
}

// ── fixtures ───────────────────────────────────────────────────────────
interface Fixture { league: string; date: string; time: string; home: string; away: string; odds?: [number, number, number] }
const fixtures: Fixture[] = []

// the Premier League publishes its whole season
try {
  const [fxRes, bootRes] = await Promise.all([
    fetch('https://fantasy.premierleague.com/api/fixtures/', { headers: UA }),
    fetch('https://fantasy.premierleague.com/api/bootstrap-static/', { headers: UA }),
  ])
  const fx = (await fxRes.json()) as any[]
  const boot = (await bootRes.json()) as any
  const clubs = new Map<number, string>(boot.teams.map((t: any) => [t.id, fix(t.name)]))
  for (const f of fx) {
    if (f.finished || !f.kickoff_time) continue
    fixtures.push({
      league: 'premier', date: f.kickoff_time.slice(0, 10), time: f.kickoff_time.slice(11, 16),
      home: clubs.get(f.team_h)!, away: clubs.get(f.team_a)!,
    })
  }
} catch (err) {
  console.error(`# enska leikjaplanið ekki sótt: ${err instanceof Error ? err.message : err}`)
}

// everyone else: the next few days, with the market's price alongside
try {
  const res = await fetch('https://www.football-data.co.uk/fixtures.csv', { headers: UA, redirect: 'follow' })
  const text = (await res.text()).replace(/^﻿/, '')
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const head = lines.shift()!.split(',')
  const at = (r: string[], n: string) => (r[head.indexOf(n)] ?? '').trim()
  for (const line of lines) {
    const r = line.split(',')
    const league = DIVS[at(r, 'Div')]
    if (!league || league === 'premier') continue // the FPL feed already has these
    const d = at(r, 'Date').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!d) continue
    const o = [at(r, 'B365H'), at(r, 'B365D'), at(r, 'B365A')].map(Number)
    fixtures.push({
      league, date: `${d[3]}-${d[2]}-${d[1]}`, time: at(r, 'Time'),
      home: fix(at(r, 'HomeTeam')), away: fix(at(r, 'AwayTeam')),
      odds: o.every((x) => x > 1) ? (o as [number, number, number]) : undefined,
    })
  }
} catch (err) {
  console.error(`# leikjaplan hinna deildanna ekki sótt: ${err instanceof Error ? err.message : err}`)
}
// Every league outside England publishes only the next few days, so the rest of
// the season is derived instead: a double round robin plays every ordered pair
// exactly once, and we know the clubs and what they have already played. The
// Premier League, where the real list is published, checks the arithmetic —
// 380 pairs less 30 played is the 350 the official feed returns.
{
  const dated = new Map<string, Fixture>()
  for (const f of fixtures) dated.set(`${f.league}|${f.home}|${f.away}`, f)

  const clubs = new Map<string, Set<string>>()
  const done = new Set<string>()
  for (const m of played) {
    if (m.season !== 2026 || m.league === 'premier') continue
    if (!(LEAGUES as Record<string, Cfg | undefined>)[m.league]) continue
    const set = clubs.get(m.league) ?? new Set<string>()
    set.add(m.home); set.add(m.away); clubs.set(m.league, set)
    done.add(`${m.league}|${m.home}|${m.away}`)
  }
  for (const [league, set] of clubs) {
    if ((LEAGUES as Record<string, Cfg>)[league].source === 'ksi') continue
    for (const home of set) {
      for (const away of set) {
        if (home === away) continue
        const key = `${league}|${home}|${away}`
        if (done.has(key) || dated.has(key)) continue
        fixtures.push({ league, date: '', time: '', home, away })
      }
    }
  }
}

// Iceland runs a calendar-year season with a split, so its remaining fixtures
// are published rather than derived — they are already in the database.
{
  const { data, error } = await db().from('matches')
    .select('league, date, home_team, away_team')
    .eq('season', 2026).eq('status', 'upcoming').in('league', ['besta', 'lengjudeild'])
    .order('date')
  if (error) throw error
  for (const m of (data ?? []) as any[]) {
    const home = teamName.get(m.home_team), away = teamName.get(m.away_team)
    if (!home || !away) continue
    fixtures.push({
      league: m.league, date: (m.date ?? '').slice(0, 10),
      time: (m.date ?? '').slice(11, 16), home, away,
    })
  }
}

fixtures.sort((a, b) =>
  (a.date ? 0 : 1) - (b.date ? 0 : 1) ||
  a.date.localeCompare(b.date) || a.time.localeCompare(b.time) ||
  a.home.localeCompare(b.home))

// A name we cannot match would quietly collect a default rating and be read as
// a promoted club, which is how Hull, Ipswich and Coventry briefly arrived in
// the Premier League rated 1701. Stop instead.
{
  const unknown = [...new Set(fixtures.flatMap((f) => [f.home, f.away]))].filter((n) => !knownTeam.has(n))
  if (unknown.length) throw new Error(`lið sem finnast ekki í gagnagrunni: ${unknown.join(', ')}`)
}

// Each division's lower end, from the clubs actually playing in it this season.
// A promoted club sits there until its own record says otherwise.
{
  const byLeague = new Map<string, Set<string>>()
  for (const f of fixtures) {
    const s = byLeague.get(f.league) ?? new Set<string>()
    s.add(f.home); s.add(f.away); byLeague.set(f.league, s)
  }
  for (const [league, clubs] of byLeague) {
    const settled = [...clubs].filter((c) => (ratedMatches.get(c) ?? 0) >= 20)
    prior.set(league, divisionQuantile(settled.map((c) => elo.get(c) ?? 1500)))
    const green = [...clubs].filter((c) => (ratedMatches.get(c) ?? 0) < 20)
    if (green.length) {
      console.error(
        `${league}: nýliðar ${green.join(', ')} settir við ${Math.round(prior.get(league) ?? 0)}` +
        ` (${settled.length} lið með fulla sögu)`,
      )
    }
  }
}

// ── predict ────────────────────────────────────────────────────────────
const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4)
const line = (s: string, n: number) => s.length > n ? s.slice(0, n) : s.padEnd(n)
let withPlayers = 0

const groups = new Map<string, Fixture[]>()
for (const f of fixtures) {
  const g = groups.get(f.league) ?? []; g.push(f); groups.set(f.league, g)
}

/** how many fixtures the squad data actually reaches */
function countWithPlayers(list: Fixture[]) {
  let n = 0
  for (const f of list) {
    const lf = form.get(f.league)
    const hasForm = !!(lf?.get(f.home) && lf?.get(f.away))
    if (hasForm || (missing.get(f.home) ?? 0) > 0 || (missing.get(f.away) ?? 0) > 0) n++
  }
  return n
}

/** the two goal expectations, before the league is put back on its own scale */
function expectations(f: Fixture) {
  const cfg = (LEAGUES as Record<string, Cfg | undefined>)[f.league]
  const goals = cfg?.goals
  const base = predictMatch({
    eloHome: rating(f.home, f.league), eloAway: rating(f.away, f.league),
    home: null, away: null, goals,
  })
  const lf = form.get(f.league)
  const fh = lf?.get(f.home) ?? null
  const fa = lf?.get(f.away) ?? null
  const xh = fh && fa && goals ? goals.home * fh.attack * fa.defence : null
  const xa = fh && fa && goals ? goals.away * fa.attack * fh.defence : null
  const mh = missing.get(f.home) ?? 0
  const ma = missing.get(f.away) ?? 0
  return {
    lh: adjustLambda(base.lambdaHome, xh, mh),
    la: adjustLambda(base.lambdaAway, xa, ma),
    usedForm: xh !== null, mh, ma,
  }
}

/** one factor per league, so its matches average the rate it really scores at */
const scale = new Map<string, number>()
for (const [league, list] of groups) {
  const cfg = (LEAGUES as Record<string, Cfg | undefined>)[league]
  if (!cfg) { scale.set(league, 1); continue }
  const totals = list.map((f) => { const e = expectations(f); return e.lh + e.la })
  scale.set(league, leagueScale(totals, cfg.goals.home + cfg.goals.away))
}

function predict(f: Fixture) {
  const e = expectations(f)
  const k = scale.get(f.league) ?? 1
  const lh = e.lh * k
  const la = e.la * k
  const { usedForm, mh, ma } = e
  // the Poisson, on the adjusted expectations
  const pois = (l: number, k: number) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p }
  let h = 0, d = 0, a = 0, bestP = -1, bh = 0, ba = 0
  for (let i = 0; i <= 9; i++) for (let j = 0; j <= 9; j++) {
    const p = pois(lh, i) * pois(la, j)
    if (i > j) h += p; else if (i === j) d += p; else a += p
    if (p > bestP) { bestP = p; bh = i; ba = j }
  }
  const s = h + d + a
  let ph = h / s, pd = d / s, pa = a / s
  // Elo keeps the casting vote; Dixon-Coles is worth about a third of one
  const model = dc.get(f.league)
  let usedDc = false
  if (model && model.attack.has(f.home) && model.attack.has(f.away)) {
    const q = dcPredict(model, f.home, f.away)
    ph = ph * (1 - DC_BLEND) + q.pHome * DC_BLEND
    pd = pd * (1 - DC_BLEND) + q.pDraw * DC_BLEND
    pa = pa * (1 - DC_BLEND) + q.pAway * DC_BLEND
    usedDc = true
  }
  if (usedForm || mh > 0 || ma > 0) withPlayers++
  return { h: ph, d: pd, a: pa, lh, la, bh, ba, usedForm, usedDc, mh, ma }
}

const header: string[] = []
header.push('# Spá fyrir hvern leik')
header.push(`# unnin ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`)
header.push('#')
header.push('# Elo + xG-form + fjarvera lykilmanna. Enska úrvalsdeildin fær allt þrennt.')
header.push('# Hinar deildirnar keyra á Elo og taka xG-formið inn sjálfkrafa þegar')
header.push('# tímabilið hefur gefið hverju liði sex leiki af því.')
header.push('#')
header.push('# Dálkar:  DC = Dixon-Coles blandað inn   xG = xG-form notað')
header.push('#          H-nn% / Ú-nn% = hlutfall sóknarframlags sem vantar')
header.push(`# Leikir: ${fixtures.length}`)

header.push(`# Þar af með leikmannagögnum: ${countWithPlayers(fixtures)}`)
console.log(header.join('\n'))

const order = [...groups.keys()].sort((a, b) => (groups.get(b)!.length - groups.get(a)!.length))
for (const key of order) {
  const list = groups.get(key) ?? []
  if (!list.length) continue
  const cfg = (LEAGUES as Record<string, Cfg | undefined>)[key]
  const dated = list.filter((f) => f.date).length
  console.log(`\n\n═══ ${(cfg?.name ?? key).toUpperCase()} — ${list.length} leikir eftir ═══`)
  if (dated < list.length) {
    console.log(`   ${dated} með dagsetningu úr leikjaplani, ${list.length - dated} leiddir út úr umferðakeppninni`)
  }
  let day = '\u0000'
  for (const f of list) {
    if (f.date !== day) {
      day = f.date
      console.log(day ? `\n── ${day} ──` : '\n── síðar á tímabilinu (dagsetning óbirt) ──')
    }
    const p = predict(f)
    const pick = p.h >= p.d && p.h >= p.a ? '1' : p.a >= p.d ? '2' : 'X'
    const flags = [
      p.usedDc ? 'DC' : '  ',
      p.usedForm ? 'xG' : '  ',
      p.mh > 0.08 ? `H-${Math.round(p.mh * 100)}%` : '     ',
      p.ma > 0.08 ? `Ú-${Math.round(p.ma * 100)}%` : '     ',
    ].join(' ')
    let mkt = ''
    if (f.odds) {
      const inv = f.odds.map((o) => 1 / o)
      const t = inv[0] + inv[1] + inv[2]
      const edge = p.h - inv[0] / t
      mkt = `  markaður 1:${pct(inv[0] / t)}  munur ${edge >= 0 ? '+' : ''}${(edge * 100).toFixed(0)}`
    }
    console.log(
      `${line(f.home, 16)} - ${line(f.away, 16)} ` +
      `1 ${pct(p.h)}  X ${pct(p.d)}  2 ${pct(p.a)}  [${pick}] ` +
      ` ${p.bh}-${p.ba}  vænt ${p.lh.toFixed(1)}-${p.la.toFixed(1)}  ${flags}${mkt}`,
    )
  }
}

// ── who is missing, and how much it is worth ──────────────────────────
if (absentees.size) {
  console.log('\n\n═══ FJARVERANDI LYKILMENN (enska úrvalsdeildin) ═══')
  const ranked = [...absentees].sort((a, b) => (missing.get(b[0]) ?? 0) - (missing.get(a[0]) ?? 0))
  for (const [club, list] of ranked) {
    const share = missing.get(club) ?? 0
    if (share < 0.02) continue
    console.log(`\n${club}  —  vantar ${(share * 100).toFixed(0)}% af sóknarframlagi (vænt mörk ×${(1 - 0.2 * share).toFixed(3)})`)
    for (const p of list.sort((a, b) => b.weight - a.weight).slice(0, 5)) {
      console.log(`   ${line(p.name, 18)} vægi ${p.weight.toFixed(2)}   ${p.note}`)
    }
  }
}
console.error(`leikir spáðir: ${fixtures.length}   með leikmannaáhrifum: ${withPlayers}`)
