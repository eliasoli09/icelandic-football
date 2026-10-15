/**
 * Quarterback adjustments to NFL Elo, measured forward (spec 2026-10-15-nfl-qb-design.md).
 *  1. A (fixed penalty) and B (EPA rating) tuned on 2002-2014, Elo itself held at NFL_ELO.
 *  2. Tested on 2015-2025 against today's model and Vegas, paired 95% intervals.
 *  3. Verdict: a version ships only if its whole interval against today's model is below 0.
 *  4. Production parameters for the winner, tuned on 2016-2025.
 * Usage: cd web && npx tsx scripts/nfl-qb-backtest.mts
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { parseGames } = await import(join(webDir, 'src/lib/nfl/csv.ts'))
const { GAMES_URL } = await import(join(webDir, 'src/lib/nfl/ingest.ts'))
const { modelPreds, score, pairedDiff, ll, tuneBy } = await import(join(webDir, 'src/lib/nfl/backtest.ts'))
const { NFL_ELO, runElo } = await import(join(webDir, 'src/lib/nfl/elo.ts'))
const { devig } = await import(join(webDir, 'src/lib/nfl/odds.ts'))
const { changeAdjuster, ratingAdjuster, fetchQbEpa } = await import(join(webDir, 'src/lib/nfl/qbElo.ts'))

const games = parseGames(await (await fetch(GAMES_URL)).text()).filter((g: any) => g.season <= 2025)
const seasons = Array.from({ length: 2025 - 1999 + 1 }, (_, i) => 1999 + i)
const epa = await fetchQbEpa(seasons)
const starts = games.filter((g: any) => g.home_score !== null).flatMap((g: any) => [g.home_qb_id, g.away_qb_id])
const found = games.filter((g: any) => g.home_score !== null).flatMap((g: any) => [
  [g.home_qb_id, g.season, g.week, g.game_type], [g.away_qb_id, g.season, g.week, g.game_type],
]).filter(([q, s, w, t]: any) => epa.has(`${q}:${s}:${w}:${t === 'REG' ? 'REG' : 'POST'}`)).length
console.log(`EPA-línur: ${epa.size}; byrjunarmenn með EPA í leiknum: ${found} af ${starts.length}`)

const byId = new Map(games.map((g: any) => [g.game_id, g]))
const priced = (x: any) => { const g: any = byId.get(x.game_id); return g.spread_line !== null && devig(g.home_ml, g.away_ml) !== null }
const asMarket = (x: any) => { const g: any = byId.get(x.game_id); return { ...x, p: devig(g.home_ml, g.away_ml)!.home, spread: g.spread_line } }
const fmt = (s: any) => `log loss ${s.logLoss.toFixed(5)}  hittni ${(100 * s.acc).toFixed(1)}%  forgjafarskekkja ${s.spreadMae.toFixed(2)}`
const ci = (d: any) => `${d.mean.toFixed(5)} [${d.lo.toFixed(5)}, ${d.hi.toFixed(5)}]`
const lls = (xs: any[]) => xs.map((x) => ll(x.p, x.s))

const upTo = (to: number) => games.filter((g: any) => g.season <= to)
const fit = (adj: (() => any) | undefined, from: number, to: number) => score(modelPreds(upTo(to), NFL_ELO, from, to, adj)).logLoss
const edge = (name: string, v: number, grid: number[]) => (v === grid[0] || v === grid[grid.length - 1] ? `  (${name} á jaðri)` : '')

const P_GRID = [0, 10, 20, 30, 40, 50, 60, 80, 100, 120]
const B_GRID = { c: [5, 10, 15, 20, 25, 30, 40], a: [0.01, 0.02, 0.05, 0.1, 0.2], t: [0.01, 0.02, 0.05, 0.1, 0.2], n0: [0, 1, 2, 5], prior: [-30, -20, -15, -12, -9, -6, -3, 0] }
const bCands = B_GRID.c.flatMap((c) => B_GRID.a.flatMap((a) => B_GRID.t.flatMap((t) => B_GRID.n0.flatMap((n0) => B_GRID.prior.map((prior) => ({ c, a, t, n0, prior }))))))

function choose(from: number, to: number, testFrom: number) {
  const A = tuneBy(P_GRID, (P: number) => fit(() => changeAdjuster(P), from, to), to, testFrom)
  const B = tuneBy(bCands, (p: any) => fit(() => ratingAdjuster(p, epa), from, to), to, testFrom)
  return { A, B }
}

// 1. tuning
const base = fit(undefined, 2002, 2014)
const { A, B } = choose(2002, 2014, 2015)
console.log('\n1) val á 2002-2014 (núverandi líkan:', base.toFixed(5) + ')')
console.log(`   A: P = ${A.best}, log loss ${A.logLoss.toFixed(5)}${edge('P', A.best, P_GRID)}`)
console.log(`   B: ${JSON.stringify(B.best)}, log loss ${B.logLoss.toFixed(5)}${Object.entries(B_GRID).map(([k, g]) => edge(k, (B.best as any)[k], g)).join('')}`)

// 2. test
const now = modelPreds(games, NFL_ELO, 2015, 2025).filter(priced)
const a = modelPreds(games, NFL_ELO, 2015, 2025, () => changeAdjuster(A.best)).filter(priced)
const b = modelPreds(games, NFL_ELO, 2015, 2025, () => ratingAdjuster(B.best, epa)).filter(priced)
const mk = now.map(asMarket)
const dA = pairedDiff(lls(a), lls(now))
const dB = pairedDiff(lls(b), lls(now))
console.log(`\n2) prófun 2015-2025, ${now.length} leikir með Vegas-verði`)
console.log('   núverandi', fmt(score(now)))
console.log('   A        ', fmt(score(a)))
console.log('   B        ', fmt(score(b)))
console.log('   Vegas    ', fmt(score(mk)))
console.log('   A − núverandi:', ci(dA))
console.log('   B − núverandi:', ci(dB))
console.log('   B − A:        ', ci(pairedDiff(lls(b), lls(a))))
console.log('   B − Vegas:    ', ci(pairedDiff(lls(b), lls(mk))))
console.log('   núv. − Vegas: ', ci(pairedDiff(lls(now), lls(mk))))

// 3. verdict
const pass = [['A', dA], ['B', dB]].filter(([, d]: any) => d.hi < 0) as [string, any][]
const winner = pass.sort((x, y) => x[1].mean - y[1].mean)[0]?.[0] ?? null
console.log('\n3) úrskurður:', winner ? `${winner} stenst og fer á síðuna` : 'hvorug stenst, ekkert fer á síðuna')

// 4. production parameters
if (winner) {
  const prod = choose(2016, 2025, 2026)
  console.log(`\n4) lokastillingar ${winner}, valdar á 2016-2025:`, JSON.stringify(winner === 'A' ? prod.A : prod.B))
}

// 5. Kansas City at the end of 2025
const show = (label: string, adj?: any) => {
  const run = runElo(games, NFL_ELO, adj)
  const kc = run.rows.filter((r: any) => r.team === 'KC' && r.season === 2025)
  const w15 = kc.filter((r: any) => r.week <= 15).at(-1)
  console.log(`   ${label}: KC eftir viku 15 ${w15.elo_before.toFixed(0)} → ${w15.elo_after.toFixed(0)}, í lok 2025 ${kc.at(-1).elo_after.toFixed(0)}`)
}
console.log('\n5) KC 2025 (Mahomes frá í vikum 16-18)')
show('núverandi')
show('A', changeAdjuster(A.best))
show('B', ratingAdjuster(B.best, epa))
