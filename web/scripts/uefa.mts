/**
 * European club football: ratings, every league-phase match, and a simulation
 * of where the three competitions finish.
 *
 * Writes what it works out to uefa_club, uefa_match and uefa_sim, which is
 * what the site reads. Pass --dry to print without writing.
 *
 * Usage: cd web && npx tsx scripts/uefa.mts [--dry] [> uefa.txt]
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const dryRun = process.argv.includes('--dry')
const SP = '/private/tmp/claude-501/-Users-elias-FH-leikmenn-/65c87b5e-6d92-47c6-b996-b5da95bfafe5/scratchpad'
const { buildEuropeanScale, HOME_ADVANTAGE } = await import(join(webDir, 'src/lib/uefaRating.ts'))
const { simulateSeason } = await import(join(webDir, 'src/lib/simulate.ts'))
const { predictMatch } = await import(join(webDir, 'src/lib/predict.ts'))
const { db } = await import(join(webDir, 'src/lib/db.ts'))

const CONTINENTAL = new Set([89, 90, 91, 100000531])
const isCup = (n: string) => /cup|pokal|coupe|copa|taca|taça|trophy|beker|supercup|super cup|playoff|play-off|shield/i.test(n)
const cells = (l: string) => {
  const o: string[] = []; let c = '', q = false
  for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = '' } else c += ch }
  o.push(c); return o
}

// ── the dataset ────────────────────────────────────────────────────────
const league = new Map<number, { name: string; country: string }>()
for (const l of readFileSync(`${SP}/sd/bt_leagues.csv`, 'utf-8').split('\n').slice(1)) {
  if (!l.trim()) continue
  const c = cells(l)
  if (c.length >= 3) league.set(Number(c[0]), { name: c[1], country: c[2].trim() })
}
const clubName = new Map<number, string>()
for (const l of readFileSync(`${SP}/sd/bt_teams.csv`, 'utf-8').split('\n').slice(1)) {
  if (!l.trim()) continue
  const c = cells(l)
  if (c.length >= 2) clubName.set(Number(c[0]), c[1].trim())
}
const matches = []
let euroGoals = { h: 0, a: 0, n: 0 }
for (const l of readFileSync(`${SP}/sd/bt_fixtures.csv`, 'utf-8').split('\n').slice(1)) {
  if (!l) continue
  const p = l.split(',')
  const lid = Number(p[2])
  const gh = Number(p[5]), ga = Number(p[6])
  if (!p[1] || !Number.isFinite(gh) || !Number.isFinite(ga)) continue
  const L = league.get(lid)
  if (!L) continue
  const home = Number(p[3]), away = Number(p[4])
  if (/ W$| Women$/.test(clubName.get(home) ?? '') || / W$| Women$/.test(clubName.get(away) ?? '')) continue
  matches.push({ date: p[1], league: lid, home, away, homeGoals: gh, awayGoals: ga })
  if (CONTINENTAL.has(lid)) { euroGoals.h += gh; euroGoals.a += ga; euroGoals.n++ }
}
matches.sort((a, b) => a.date.localeCompare(b.date))
const GOALS = { home: euroGoals.h / euroGoals.n, away: euroGoals.a / euroGoals.n }

const scale = buildEuropeanScale(
  matches,
  (id: number) => CONTINENTAL.has(id),
  (id: number) =>
    !CONTINENTAL.has(id) && !isCup(league.get(id)?.name ?? '') && league.get(id)?.country !== 'World',
)

// ── this season's competitions ─────────────────────────────────────────
interface Fx { comp: string; matchday: number; date: string | null; time: string | null; home: string; away: string; homeGoals: number | null; awayGoals: number | null; homeAssoc: string | null; awayAssoc: string | null }
const fixtures: Fx[] = JSON.parse(readFileSync(`${SP}/uefa-fixtures.json`, 'utf-8'))
const idOf: Record<string, number | null> = JSON.parse(readFileSync(`${SP}/uefa-map.json`, 'utf-8'))

/** a club with no club rating is worth what its league is worth, no more */
const fallback = new Map<string, number>()
const ratingOf = (club: string) => {
  const id = idOf[club]
  if (id != null) {
    const r = scale.club.get(id)
    if (r !== undefined) return r
    const l = scale.leagueOf.get(id)
    if (l !== undefined) return scale.league.get(l) ?? 1500
  }
  return fallback.get(club) ?? 1500
}

const COMPS = [
  { key: 'ucl', name: 'Meistaradeildin', direct: 8, playoff: 24 },
  { key: 'uel', name: 'Evrópudeildin', direct: 8, playoff: 24 },
  { key: 'uecl', name: 'Sambandsdeildin', direct: 8, playoff: 24 },
]

const clubRows: Record<string, unknown>[] = []
const matchRows: Record<string, unknown>[] = []
const simRows: Record<string, unknown>[] = []

console.log('# Evrópukeppnirnar 2026/27')
console.log(`# unnin ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`)
console.log('#')
console.log('# Einkunn: staða félags í eigin deild plús styrkur deildarinnar, þar sem')
console.log('# styrkur deilda er metinn eingöngu úr leikjum sem fóru yfir landamæri.')
console.log(`# Byggt á ${scale.bridged.toLocaleString('is')} slíkum leikjum.`)
console.log(`# Mörk í Evrópukeppnum: heima ${GOALS.home.toFixed(2)}, úti ${GOALS.away.toFixed(2)}`)

// ── league strength ────────────────────────────────────────────────────
/** how many clubs each league currently has, so one-off entrants are not ranked */
const active = new Map<number, number>()
for (const [, l] of scale.leagueOf) active.set(l, (active.get(l) ?? 0) + 1)
const strengths = [...scale.league.entries()]
  .filter(([l]) => (active.get(l) ?? 0) >= 8 && league.get(l))
  .sort((a, b) => b[1] - a[1]).slice(0, 15)
console.log('\n\n═══ STYRKUR DEILDA ═══')
for (const [i, [l, s]] of strengths.entries()) {
  const L = league.get(l)!
  console.log(`${String(i + 1).padStart(2)}. ${L.name.padEnd(24)} ${L.country.padEnd(16)} ${Math.round(s)}`)
}

for (const comp of COMPS) {
  const ms = fixtures.filter((f) => f.comp === comp.key)
  const clubs = [...new Set(ms.flatMap((f) => [f.home, f.away]))]
  const played = ms.filter((f) => f.homeGoals !== null)
  const left = ms.filter((f) => f.homeGoals === null)

  const state = new Map(clubs.map((c) => [c, { points: 0, gf: 0, ga: 0, n: 0 }]))
  for (const m of played) {
    const h = state.get(m.home)!, a = state.get(m.away)!
    h.gf += m.homeGoals!; h.ga += m.awayGoals!; a.gf += m.awayGoals!; a.ga += m.homeGoals!
    h.n++; a.n++
    if (m.homeGoals! > m.awayGoals!) h.points += 3
    else if (m.homeGoals! === m.awayGoals!) { h.points++; a.points++ }
    else a.points += 3
  }

  const teams = clubs.map((c) => ({
    team: c, elo: ratingOf(c), rates: null,
    points: state.get(c)!.points, goalsFor: state.get(c)!.gf,
    goalsAgainst: state.get(c)!.ga, played: state.get(c)!.n,
  }))
  type SimRow = { team: string; posProbs: number[]; projectedPoints: number }
  for (const c of clubs) {
    const id = idOf[c]
    const l = id != null ? scale.leagueOf.get(id) : undefined
    const assoc = ms.find((f) => f.home === c)?.homeAssoc ?? ms.find((f) => f.away === c)?.awayAssoc ?? ''
    clubRows.push({
      club: c, assoc, comp: comp.key, rating: Math.round(ratingOf(c) * 10) / 10,
      league_name: l !== undefined ? league.get(l)?.name ?? null : null,
      league_strength: l !== undefined ? Math.round(scale.league.get(l) ?? 1500) : null,
      rated: id != null && scale.club.has(id),
    })
  }
  const sim: SimRow[] = simulateSeason(
    teams as never, left.map((f) => ({ home: f.home, away: f.away })), 20000, 20260912, { goals: GOALS },
  )

  console.log(`\n\n═══ ${comp.name.toUpperCase()} ═══`)
  console.log(`${ms.length} leikir, ${played.length} spilaðir, ${left.length} eftir\n`)
  console.log('lið                      land  einkunn  stig   8 efstu  umspil   úr leik')
  const rows = sim.slice().sort((a: SimRow, b: SimRow) => b.projectedPoints - a.projectedPoints)
  for (const r of rows) {
    const sum = (xs: number[]) => xs.reduce((x, y) => x + y, 0)
    const top = sum(r.posProbs.slice(0, comp.direct))
    const po = sum(r.posProbs.slice(comp.direct, comp.playoff))
    const out = sum(r.posProbs.slice(comp.playoff))
    const assoc = ms.find((f) => f.home === r.team)?.homeAssoc ?? ms.find((f) => f.away === r.team)?.awayAssoc ?? ''
    simRows.push({
      comp: comp.key, club: r.team, proj_points: r.projectedPoints,
      p_top8: top, p_playoff: po, p_out: out, pos_probs: r.posProbs,
    })
    const pc = (x: number) => (x >= 0.995 ? '100%' : x < 0.005 ? ' <1%' : `${Math.round(x * 100)}%`.padStart(4))
    console.log(
      `${r.team.padEnd(24)} ${assoc.padEnd(4)} ${String(Math.round(ratingOf(r.team))).padStart(7)}  ${r.projectedPoints.toFixed(1).padStart(4)}    ${pc(top)}    ${pc(po)}     ${pc(out)}`,
    )
  }

  for (const m of ms) {
    const p = m.homeGoals === null
      ? predictMatch({ eloHome: ratingOf(m.home), eloAway: ratingOf(m.away), home: null, away: null, goals: GOALS })
      : null
    matchRows.push({
      id: `${m.comp}-${m.matchday}-${m.home}-${m.away}`.replace(/\s+/g, '_'),
      comp: m.comp, matchday: m.matchday,
      date: m.date ? `${m.date}T${m.time ?? '00:00'}:00Z` : null,
      home: m.home, away: m.away, home_goals: m.homeGoals, away_goals: m.awayGoals,
      p_home: p?.pHome ?? null, p_draw: p?.pDraw ?? null, p_away: p?.pAway ?? null,
      lambda_home: p?.lambdaHome ?? null, lambda_away: p?.lambdaAway ?? null,
    })
  }

  console.log(`\n── hver einasti leikur sem eftir er (${left.length}) ──`)
  let day = ''
  for (const f of left) {
    if (f.date !== day) { day = f.date ?? ''; console.log(`\n${day}`) }
    const p = predictMatch({ eloHome: ratingOf(f.home), eloAway: ratingOf(f.away), home: null, away: null, goals: GOALS })
    const pick = p.pHome >= p.pDraw && p.pHome >= p.pAway ? '1' : p.pAway >= p.pDraw ? '2' : 'X'
    const pc = (x: number) => `${Math.round(x * 100)}%`.padStart(4)
    console.log(
      `  ${(f.time ?? 'TBD').padEnd(5)} ${f.home.padEnd(22)} - ${f.away.padEnd(22)} ` +
      `1 ${pc(p.pHome)}  X ${pc(p.pDraw)}  2 ${pc(p.pAway)}  [${pick}]  vænt ${p.lambdaHome.toFixed(1)}-${p.lambdaAway.toFixed(1)}`,
    )
  }
}

// ── store it, since the site reads the database and not this output ────
if (!dryRun) {
  const { data, error } = await db().rpc('rpc_replace_uefa', {
    p_secret: process.env.CRON_SECRET!,
    p_clubs: clubRows, p_matches: matchRows, p_sim: simRows,
  })
  if (error) throw error
  console.error(`skrifað: ${clubRows.length} félög, ${matchRows.length} leikir, ${simRows.length} hermunarraðir (${data})`)
} else {
  console.error(`þurrkeyrsla: ${clubRows.length} félög, ${matchRows.length} leikir, ${simRows.length} hermunarraðir`)
}
