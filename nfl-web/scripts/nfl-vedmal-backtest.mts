/**
 * Veðmálin against history. For every regular-season week from week 4:
 *  - the three slips, built from closing moneylines and the Elo chance before
 *    kickoff, and whether they came in (2015-2025);
 *  - touchdown chances, rushing yards and game totals as the page makes them,
 *    the knobs chosen on 2016-2021 and scored on 2022-2025 against a plain
 *    season average (and, for totals, against the Vegas line).
 * Writes src/lib/nfl/data/vedmal-backtest.json, which the page quotes.
 * Usage: cd nfl-web && npx tsx scripts/nfl-vedmal-backtest.mts
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { parseGames } = await import(join(webDir, 'src/lib/nfl/csv.ts'))
const { GAMES_URL } = await import(join(webDir, 'src/lib/nfl/ingest.ts'))
const { parsePlayerWeeks } = await import(join(webDir, 'src/lib/nfl/players.ts'))
const { weeksUrl } = await import(join(webDir, 'src/lib/nfl/playerIngest.ts'))
const { runElo, franchiseOf } = await import(join(webDir, 'src/lib/nfl/elo.ts'))
const V = await import(join(webDir, 'src/lib/nfl/vedmal.ts'))
const { devig } = await import(join(webDir, 'src/lib/nfl/odds.ts'))

const cache = join(tmpdir(), 'nflverse-cache')
mkdirSync(cache, { recursive: true })
async function cached(url: string, name: string): Promise<string> {
  const f = join(cache, name)
  if (existsSync(f) && statSync(f).size > 0) return readFileSync(f, 'utf-8')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const t = await res.text()
  writeFileSync(`${f}.part`, t)
  renameSync(`${f}.part`, f)
  return t
}

const FIRST = 2015, TRAIN_TO = 2021, LAST = 2025
const games: any[] = parseGames(await cached(GAMES_URL, 'games.csv'))
const reg = games.filter((g) => g.game_type === 'REG' && g.home_score !== null && g.season >= FIRST - 1 && g.season <= LAST)
const pHome = new Map<string, number>(runElo(games).records.map((r: any) => [r.game_id, r.pHome]))
const weeksBy = new Map<number, any[]>()
for (let s = FIRST; s <= LAST; s++) weeksBy.set(s, parsePlayerWeeks(await cached(weeksUrl(s), `week_${s}.csv`)).weeks.filter((w: any) => w.season_type === 'REG'))
const fr = (t: string) => franchiseOf(t)
const lastWeek = (s: number) => Math.max(...reg.filter((g) => g.season === s).map((g) => g.week))

// ---------- 1. the slips ----------
// The weight on the model against the market is chosen on 2015-2021 (most hits), then everything is reported for 2015-2025 and 2022-2025.
function runSlips(weight: number, from: number, to: number) {
const slipOut: Record<string, any> = {}
for (const sl of V.SLIPS) slipOut[sl.key] = { weeks: 0, hits: 0, p: 0, market: 0, odds: 0, staked: 0, returned: 0, legs: 0 }
for (let s = from; s <= to; s++) {
  for (let w = 1; w <= lastWeek(s); w++) {
    const wk = reg.filter((g) => g.season === s && g.week === w)
    const choices = wk.map((g) => V.gameLegs(g, pHome.get(g.game_id), weight)).filter((l: any[]) => l.length)
    const won = new Map(wk.map((g) => [g.game_id, g.home_score > g.away_score ? 'home' : g.home_score < g.away_score ? 'away' : 'tie']))
    for (const sl of V.SLIPS) {
      const slip = V.bestSlip(choices, sl.target)
      if (!slip) continue
      const o = slipOut[sl.key]
      const hit = slip.legs.every((l: any) => won.get(l.game_id) === (l.home ? 'home' : 'away'))
      o.weeks++; o.hits += hit ? 1 : 0; o.p += slip.p; o.market += slip.market; o.odds += slip.odds; o.legs += slip.legs.length
      o.staked += 1000; o.returned += hit ? 1000 * slip.odds : 0
    }
  }
}
return Object.fromEntries(Object.entries(slipOut).map(([k, o]) => [k, {
  weeks: o.weeks, hits: o.hits, hitRate: o.hits / o.weeks, modelP: o.p / o.weeks, marketP: o.market / o.weeks,
  avgOdds: o.odds / o.weeks, avgLegs: o.legs / o.weeks, roi: o.returned / o.staked - 1,
}]))
}
const show = (label: string, r: any) => { console.log(label); for (const [k, o] of Object.entries(r) as [string, any][]) console.log(`  ${k.padEnd(10)} ${o.hits}/${o.weeks} = ${(100 * o.hitRate).toFixed(1)}%  sagt ${(100 * o.modelP).toFixed(1)}%  markaður ${(100 * o.marketP).toFixed(1)}%  stuðull ${o.avgOdds.toFixed(2)}  leggir ${o.avgLegs.toFixed(1)}  ávöxtun ${(100 * o.roi).toFixed(1)}%`) }
let slipWeight = 0, slipBest = -1
for (const wgt of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1]) {
  const r = runSlips(wgt, FIRST, TRAIN_TO)
  const hits = Object.values(r).reduce((t: number, o: any) => t + o.hits, 0) as number
  console.log(`vægi líkans ${wgt}: ${hits} seðlar gengu upp 2015-${TRAIN_TO}`)
  if (hits > slipBest) { slipBest = hits; slipWeight = wgt }
}
const slips = runSlips(slipWeight, FIRST, LAST)
const slipsTest = runSlips(slipWeight, TRAIN_TO + 1, LAST)
show(`seðlar 2015-${LAST}, vægi líkans ${slipWeight}:`, slips)
show(`seðlar ${TRAIN_TO + 1}-${LAST}:`, slipsTest)
const slipsModelOnly = runSlips(1, TRAIN_TO + 1, LAST)
show(`samanburður, líkanið eitt ${TRAIN_TO + 1}-${LAST}:`, slipsModelOnly)

// ---------- 2-4. rows for the projections ----------
type U = { games: number; carries: number; targets: number; tds: number; rushYards: number }
const zero = (): U => ({ games: 0, carries: 0, targets: 0, tds: 0, rushYards: 0 })
const add = (u: U, r: any) => { u.games++; u.carries += r.carries; u.targets += r.targets; u.tds += r.rushing_tds + r.receiving_tds; u.rushYards += r.rushing_yards }
function usage(rows: any[]): Map<string, U> {
  const m = new Map<string, U>()
  for (const r of rows) { const u = m.get(r.player_id) ?? zero(); add(u, r); m.set(r.player_id, u) }
  return m
}
const tdRows: any[] = [], rushRows: any[] = [], totalRows: any[] = []
for (let s = FIRST + 1; s <= LAST; s++) {
  const prevU = usage(weeksBy.get(s - 1)!)
  const prevGames = reg.filter((g) => g.season === s - 1)
  const leaguePts = prevGames.reduce((t, g) => t + g.home_score + g.away_score, 0) / (2 * prevGames.length)
  const prevRows = weeksBy.get(s - 1)!
  const leagueRush = prevRows.reduce((t, r) => t + r.rushing_yards, 0) / (2 * prevGames.length)
  const rows = weeksBy.get(s)!
  for (let w = 4; w <= lastWeek(s); w++) {
    const before = rows.filter((r) => r.week < w)
    const curU = usage(before)
    const done = reg.filter((g) => g.season === s && g.week < w)
    const pts = new Map<string, { for: number; against: number; games: number }>()
    for (const g of done) for (const [t, f, a] of [[g.home, g.home_score, g.away_score], [g.away, g.away_score, g.home_score]]) {
      const x = pts.get(fr(t)) ?? { for: 0, against: 0, games: 0 }; x.for += f; x.against += a; x.games++; pts.set(fr(t), x)
    }
    const allowed = new Map<string, { yards: number; games: Set<string> }>()
    for (const r of before) { const x = allowed.get(fr(r.opponent)) ?? { yards: 0, games: new Set() }; x.yards += r.rushing_yards; x.games.add(r.game_id); allowed.set(fr(r.opponent), x) }
    const lastGame = new Map<string, string>()
    for (const g of [...done].sort((a, b) => a.week - b.week)) { lastGame.set(fr(g.home), g.game_id); lastGame.set(fr(g.away), g.game_id) }
    const inLast = new Map<string, any[]>()
    for (const r of before) if (lastGame.get(fr(r.team)) === r.game_id) inLast.set(fr(r.team), [...(inLast.get(fr(r.team)) ?? []), r])
    const thisWeek = reg.filter((g) => g.season === s && g.week === w)
    const actual = new Map(rows.filter((r) => r.week === w).map((r) => [r.player_id, r]))
    for (const g of thisWeek) {
      for (const home of [true, false]) {
        const team = fr(home ? g.home : g.away), opp = fr(home ? g.away : g.home)
        const tp = pts.get(team) ?? { for: 0, against: 0, games: 0 }
        const op = allowed.get(opp) ?? { yards: 0, games: new Set() }
        for (const r of inLast.get(team) ?? []) {
          const y = actual.get(r.player_id)
          if (!y || fr(y.team) !== team) continue
          const cur = curU.get(r.player_id) ?? zero(), prev = prevU.get(r.player_id) ?? zero()
          if (r.carries + r.targets > 0) tdRows.push({ s, cur, prev, implied: V.impliedPoints(g, home), teamPts: tp.for, teamGames: tp.games, leaguePts, y: y.rushing_tds + y.receiving_tds > 0 ? 1 : 0 })
          if (cur.games && cur.carries / cur.games >= 5 && r.carries > 0) rushRows.push({ s, cur, prev, allowed: op.yards, oppGames: op.games.size, leagueRush, y: y.rushing_yards })
        }
      }
      const h = pts.get(fr(g.home)) ?? { for: 0, against: 0, games: 0 }, a = pts.get(fr(g.away)) ?? { for: 0, against: 0, games: 0 }
      if (g.total_line !== null) totalRows.push({ s, h, a, leaguePts, vegas: g.total_line, y: g.home_score + g.away_score })
    }
  }
}
console.log(`raðir: snertimörk ${tdRows.length}, hlaup ${rushRows.length}, leikir ${totalRows.length}`)
const train = (r: any) => r.s <= TRAIN_TO
const test = (r: any) => r.s > TRAIN_TO

// ---------- 2. touchdowns ----------
const clip = (p: number) => Math.min(1 - 1e-4, Math.max(1e-4, p))
const ll = (rows: any[], f: (r: any) => number) => rows.reduce((t, r) => { const p = clip(f(r)); return t - (r.y ? Math.log(p) : Math.log(1 - p)) }, 0) / rows.length
const brier = (rows: any[], f: (r: any) => number) => rows.reduce((t, r) => t + (f(r) - r.y) ** 2, 0) / rows.length
const tdP = (P: any) => (r: any) => V.tdChance(V.tdRate(r.cur, r.prev, P) * V.teamFactor(r.implied, r.teamPts, r.teamGames, r.leaguePts, P.kTeam) ** P.a)
const naive = (r: any) => V.tdChance(r.cur.games ? Math.max(r.cur.tds / r.cur.games, 0.02) : 0.02)
let bestTd: any = null
for (const rCarry of [0.02, 0.025, 0.03, 0.035, 0.04])
  for (const rTarget of [0.03, 0.04, 0.05, 0.06, 0.07])
    for (const k of [1, 2, 4, 6, 8, 12])
      for (const prev of [0, 0.25, 0.5, 1])
        for (const a of [0, 0.5, 1, 1.5]) {
          const P = { rCarry, rTarget, k, prev, kTeam: 4, a }
          const score = ll(tdRows.filter(train), tdP(P))
          if (!bestTd || score < bestTd.score) bestTd = { P, score }
        }
const tdTest = tdRows.filter(test)
const f = tdP(bestTd.P)
const buckets = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 1].slice(0, -1).map((lo, i, arr) => {
  const hi = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 1][i]
  const rs = tdTest.filter((r) => f(r) >= lo && f(r) < hi)
  return { from: lo, to: hi, n: rs.length, said: rs.reduce((t, r) => t + f(r), 0) / (rs.length || 1), scored: rs.reduce((t, r) => t + r.y, 0) / (rs.length || 1) }
})
const noTeam = tdP({ ...bestTd.P, a: 0 })
const td = { params: bestTd.P, test: { rows: tdTest.length, logloss: ll(tdTest, f), loglossNoTeam: ll(tdTest, noTeam), loglossNaive: ll(tdTest, naive), brier: brier(tdTest, f), brierNaive: brier(tdTest, naive), buckets } }
console.log('snertimörk:', JSON.stringify(td.params), `log loss ${td.test.logloss.toFixed(4)} (án liðsþáttar ${td.test.loglossNoTeam.toFixed(4)}, einföld tíðni ${td.test.loglossNaive.toFixed(4)})`)
for (const b of buckets) console.log(`  ${(100 * b.from).toFixed(0)}-${(100 * b.to).toFixed(0)}%: n=${b.n} sagt ${(100 * b.said).toFixed(1)}% skoruðu ${(100 * b.scored).toFixed(1)}%`)

// ---------- 3. rushing ----------
const mae = (rows: any[], g: (r: any) => number) => rows.reduce((t, r) => t + Math.abs(g(r) - r.y), 0) / rows.length
const rushF = (P: any) => (r: any) => V.rushProjection(r.cur, r.prev, r.allowed, r.oppGames, r.leagueRush, P)
let bestRush: any = null
for (const prev of [0, 0.1, 0.25, 0.5, 1]) for (const kDef of [1, 2, 4, 8, 16, 1e9]) {
  const score = mae(rushRows.filter(train), rushF({ prev, kDef }))
  if (!bestRush || score < bestRush.score) bestRush = { P: { prev, kDef }, score }
}
const rushTest = rushRows.filter(test)
const rush = { params: bestRush.P, test: { rows: rushTest.length, mae: mae(rushTest, rushF(bestRush.P)), maeNaive: mae(rushTest, rushF({ prev: 0, kDef: 1e9 })) } }
console.log('hlaup:', JSON.stringify(rush.params), `MAE ${rush.test.mae.toFixed(2)} jardar (meðaltal tímabils ${rush.test.maeNaive.toFixed(2)})`)

// ---------- 4. totals ----------
const totF = (k: number) => (r: any) => V.sidePoints(r.h.for, r.h.games, r.a.against, r.a.games, r.leaguePts, k) + V.sidePoints(r.a.for, r.a.games, r.h.against, r.h.games, r.leaguePts, k)
let bestK = 4, bestScore = Infinity
for (const k of [1, 2, 4, 6, 8, 12, 16, 24]) { const sc = mae(totalRows.filter(train), totF(k)); if (sc < bestScore) { bestScore = sc; bestK = k } }
// and how much of our number to mix into the Vegas line
const mix = (wgt: number) => (r: any) => wgt * totF(bestK)(r) + (1 - wgt) * r.vegas
let bestMix = 0; bestScore = Infinity
for (const wgt of [0, 0.1, 0.2, 0.3, 0.5, 1]) { const sc = mae(totalRows.filter(train), mix(wgt)); if (sc < bestScore) { bestScore = sc; bestMix = wgt } }
const totTest = totalRows.filter(test)
const totals = { k: bestK, mix: bestMix, test: { rows: totTest.length, mae: mae(totTest, totF(bestK)), maeMix: mae(totTest, mix(bestMix)), maeVegas: mae(totTest, (r) => r.vegas) } }
console.log('heildarstig:', `k=${bestK} MAE ${totals.test.mae.toFixed(2)}, blanda ${bestMix} ${totals.test.maeMix.toFixed(2)} (Vegas ${totals.test.maeVegas.toFixed(2)})`)


// ---------- 5. more player markets ----------
// Same shape as rushing: the player's average times what the opponent concedes, times the team factor to a power.
const STAT_KEYS = ['attempts', 'passing_yards', 'interceptions', 'sacks_taken', 'carries', 'rushing_yards', 'targets', 'receptions', 'receiving_yards', 'def_sacks', 'qb_hits', 'tackles_solo', 'tackle_assists'] as const
const zeroLine = () => Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as any
const marketRows: Record<string, any[]> = Object.fromEntries(V.MARKETS.map((m: any) => [m.key, []]))
for (let s = FIRST + 1; s <= LAST; s++) {
  const prevRows = weeksBy.get(s - 1)!
  const prevGames = reg.filter((g) => g.season === s - 1)
  const leaguePts = prevGames.reduce((t, g) => t + g.home_score + g.away_score, 0) / (2 * prevGames.length)
  const league = Object.fromEntries(V.MARKETS.map((m: any) => [m.key, prevRows.reduce((t, r) => t + m.oppStat(r), 0) / (2 * prevGames.length)]))
  const prevTot = new Map<string, any>()
  for (const r of prevRows) { const t = prevTot.get(r.player_id) ?? { games: 0, ...zeroLine() }; t.games++; for (const k of STAT_KEYS) t[k] += r[k]; prevTot.set(r.player_id, t) }
  const rows = weeksBy.get(s)!
  for (let w = 4; w <= lastWeek(s); w++) {
    const before = rows.filter((r) => r.week < w)
    const cur = new Map<string, any>()
    for (const r of before) { const t = cur.get(r.player_id) ?? { games: 0, ...zeroLine() }; t.games++; for (const k of STAT_KEYS) t[k] += r[k]; cur.set(r.player_id, t) }
    const faced: Record<string, Map<string, { total: number; games: Set<string> }>> = {}
    for (const m of V.MARKETS as any[]) {
      const f = new Map<string, { total: number; games: Set<string> }>()
      for (const r of before) { const key = fr(m.faced === 'against' ? r.opponent : r.team); const x = f.get(key) ?? { total: 0, games: new Set() }; x.total += m.oppStat(r); x.games.add(r.game_id); f.set(key, x) }
      faced[m.key] = f
    }
    const done = reg.filter((g) => g.season === s && g.week < w)
    const pts = new Map<string, { for: number; games: number }>()
    for (const g of done) for (const [t, f] of [[g.home, g.home_score], [g.away, g.away_score]]) { const x = pts.get(fr(t)) ?? { for: 0, games: 0 }; x.for += f; x.games++; pts.set(fr(t), x) }
    const lastGame = new Map<string, string>()
    for (const g of [...done].sort((a, b) => a.week - b.week)) { lastGame.set(fr(g.home), g.game_id); lastGame.set(fr(g.away), g.game_id) }
    const actual = new Map(rows.filter((r) => r.week === w).map((r) => [r.player_id, r]))
    for (const g of reg.filter((x) => x.season === s && x.week === w)) for (const home of [true, false]) {
      const team = fr(home ? g.home : g.away), opp = fr(home ? g.away : g.home)
      const tp = pts.get(team) ?? { for: 0, games: 0 }
      const factor = V.teamFactor(V.impliedPoints(g, home), tp.for, tp.games, leaguePts, 4)
      for (const r of before) {
        if (fr(r.team) !== team || lastGame.get(team) !== r.game_id) continue
        const y = actual.get(r.player_id)
        if (!y || fr(y.team) !== team) continue
        const c = cur.get(r.player_id)!, pv = prevTot.get(r.player_id) ?? { games: 0, ...zeroLine() }
        const avg = Object.fromEntries(STAT_KEYS.map((k) => [k, c[k] / c.games])) as any
        for (const m of V.MARKETS as any[]) {
          if (!m.eligible(r, avg)) continue
          const o = faced[m.key].get(opp) ?? { total: 0, games: new Set() }
          marketRows[m.key].push({ s, cur: { games: c.games, total: m.per(c) }, prev: { games: pv.games, total: m.per(pv) }, opp: { total: o.total, games: o.games.size }, league: league[m.key], factor, y: m.per(y) })
        }
      }
    }
  }
}
const markets: Record<string, any> = {}
for (const m of V.MARKETS as any[]) {
  const rs = marketRows[m.key]
  const proj = (P: any) => (r: any) => V.statProjection(r.cur, r.prev, r.opp, r.league, r.factor, P)
  const score = (rows: any[], P: any) => m.kind === 'number' ? mae(rows, proj(P)) : ll(rows.map((r) => ({ ...r, y: r.y > 0 ? 1 : 0 })), (r: any) => V.tdChance(Math.max(proj(P)(r), 0.005)))
  // a typical listed player's number a game, from the training seasons
  const prior = rs.filter(train).reduce((t, r) => t + r.y, 0) / rs.filter(train).length
  let best: any = null
  for (const prev of [0, 0.1, 0.25, 0.5, 1]) for (const kDef of [1, 2, 4, 8, 16, 1e9]) for (const a of [0, 0.5, 1]) for (const k of [0, 1, 2, 4, 8, 16, 32]) {
    const sc = score(rs.filter(train), { prev, kDef, a, k, prior })
    if (!best || sc < best.sc) best = { P: { prev, kDef, a, k, prior }, sc }
  }
  const t = rs.filter(test)
  const naive = { prev: 0, kDef: 1e9, a: 0, k: 0, prior }
  const flat = { prev: 0, kDef: 1e9, a: 0, k: 1e9, prior }
  markets[m.key] = { params: best.P, test: { rows: t.length, score: score(t, best.P), naive: score(t, naive), flat: score(t, flat), metric: m.kind === 'number' ? 'mae' : 'logloss' } }
  console.log(`${m.key.padEnd(8)} ${JSON.stringify(best.P)} ${markets[m.key].test.metric} ${markets[m.key].test.score.toFixed(4)} (meðaltal tímabils ${markets[m.key].test.naive.toFixed(4)}, allir eins ${markets[m.key].test.flat.toFixed(4)}), n=${t.length}`)
}

// ---------- 6. player stats in the win chance ----------
// Can the players' EPA (offence per game, defence allowed per game) add anything to the market's chance?
// logit p = logit(market) + c1 * EPA difference + c2 * (Elo logit − market logit), fitted on 2016-2021.
const logit = (p: number) => Math.log(p / (1 - p))
const sig = (x: number) => 1 / (1 + Math.exp(-x))
const winRows: any[] = []
for (let s = FIRST + 1; s <= LAST; s++) {
  const rows = weeksBy.get(s)!
  for (let w = 4; w <= lastWeek(s); w++) {
    const before = rows.filter((r) => r.week < w)
    const off = new Map<string, { epa: number; games: Set<string> }>(), def = new Map<string, { epa: number; games: Set<string> }>()
    for (const r of before) {
      const e = r.passing_epa + r.rushing_epa
      const a = off.get(fr(r.team)) ?? { epa: 0, games: new Set() }; a.epa += e; a.games.add(r.game_id); off.set(fr(r.team), a)
      const d = def.get(fr(r.opponent)) ?? { epa: 0, games: new Set() }; d.epa += e; d.games.add(r.game_id); def.set(fr(r.opponent), d)
    }
    // per game, pulled to zero by 3 games
    const net = (t: string) => { const o = off.get(t), d = def.get(t); return (o ? o.epa / (o.games.size + 3) : 0) - (d ? d.epa / (d.games.size + 3) : 0) }
    for (const g of reg.filter((x) => x.season === s && x.week === w)) {
      const m = devig(g.home_ml, g.away_ml), pe = pHome.get(g.game_id)
      if (!m || pe === undefined || g.home_score === g.away_score) continue
      winRows.push({ s, market: m.home, elo: pe, epa: (net(fr(g.home)) - net(fr(g.away))) / 10, y: g.home_score > g.away_score ? 1 : 0 })
    }
  }
}
const winP = (c: number[]) => (r: any) => sig(logit(r.market) + c[0] * r.epa + c[1] * (logit(r.elo) - logit(r.market)))
let coef = [0, 0]
for (let it = 0; it < 4000; it++) {
  const gr = [0, 0]
  for (const r of winRows.filter(train)) { const e = winP(coef)(r) - r.y; gr[0] += e * r.epa; gr[1] += e * (logit(r.elo) - logit(r.market)) }
  const n = winRows.filter(train).length
  coef = coef.map((c, i) => c - 0.5 * gr[i] / n)
}
const winTest = winRows.filter(test)
const winModel = { coef, test: { rows: winTest.length, loglossMarket: ll(winTest, (r) => r.market), loglossBlend: ll(winTest, winP(coef)), loglossElo: ll(winTest, (r) => r.elo) } }
console.log(`sigurlíkur ${TRAIN_TO + 1}-${LAST}: markaður ${winModel.test.loglossMarket.toFixed(4)}, markaður + leikmenn/Elo ${winModel.test.loglossBlend.toFixed(4)} (stuðlar ${coef.map((c) => c.toFixed(3)).join(', ')}), Elo eitt ${winModel.test.loglossElo.toFixed(4)}`)

const out = { made: new Date().toISOString().slice(0, 10), slipSeasons: [FIRST, LAST], slipWeight, train: [FIRST + 1, TRAIN_TO], test: [TRAIN_TO + 1, LAST], slips, slipsTest, slipsModelOnly, td, rush, totals, markets, winModel }
writeFileSync(join(webDir, 'src/lib/nfl/data/vedmal-backtest.json'), JSON.stringify(out, null, 2) + '\n')
console.log('skrifað: src/lib/nfl/data/vedmal-backtest.json')
