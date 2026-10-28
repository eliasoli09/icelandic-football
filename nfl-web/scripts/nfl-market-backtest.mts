/**
 * Markaðurinn: does the projection beat "points a game so far"? (spec 2026-10-26-nfl-markadur-design.md)
 *  - Samples: after rounds 3-14 of seasons 2016-2025, offence players with at least 1 game so far
 *    and at least 3 games after the round. Target: points a game over the rest of the regular season.
 *  - prev/k/prior chosen per position on 2016-2021, tested once on 2022-2025 against the naive
 *    average. 95% interval over player-seasons (each one's mean difference), not over rows.
 *  - Passes only if the whole interval of (|proj − target| − |naive − target|) is below 0.
 * Usage: cd nfl-web && npx tsx scripts/nfl-market-backtest.mts
 */
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { parsePlayerWeeks, weeksUrlFor } = await (async () => {
  const p = await import(join(webDir, 'src/lib/nfl/players.ts'))
  const i = await import(join(webDir, 'src/lib/nfl/playerIngest.ts'))
  return { parsePlayerWeeks: p.parsePlayerWeeks, weeksUrlFor: i.weeksUrl }
})()
const { offenceScore } = await import(join(webDir, 'src/lib/nfl/stars.ts'))
const { MARKET_NAIVE, MARKET_POSITIONS, isMarketPos, projection } = await import(join(webDir, 'src/lib/nfl/market.ts'))
const { pairedDiff, tuneBy } = await import(join(webDir, 'src/lib/nfl/backtest.ts'))

type Tally = { games: number; total: number }
type Sample = { season: number; id: string; pos: string; cur: Tally; prev: Tally; target: number }

const pts = new Map<number, Map<string, Map<number, number>>>() // season → player → week → points
const pos = new Map<string, string>()
for (let s = 2015; s <= 2025; s++) {
  const res = await fetch(weeksUrlFor(s))
  if (!res.ok) throw new Error(`nflverse ${res.status} ${s}`)
  const { weeks, seen } = parsePlayerWeeks(await res.text())
  for (const [id, p] of seen) if (p.position) pos.set(id, p.position)
  const m = new Map<string, Map<number, number>>()
  for (const w of weeks) if (w.season_type === 'REG') {
    if (!m.has(w.player_id)) m.set(w.player_id, new Map())
    m.get(w.player_id)!.set(w.week, offenceScore(w))
  }
  pts.set(s, m)
  console.log(`${s}: ${weeks.length} raðir`)
}

const samples: Sample[] = []
for (let s = 2016; s <= 2025; s++) {
  const prevSeason = pts.get(s - 1)!
  for (const [id, byWeek] of pts.get(s)!) {
    const p = pos.get(id) ?? null
    if (!isMarketPos(p)) continue
    const pw = [...(prevSeason.get(id)?.values() ?? [])]
    const prev = { games: pw.length, total: pw.reduce((t, x) => t + x, 0) }
    for (let w = 3; w <= 14; w++) {
      const before = [...byWeek].filter(([wk]) => wk <= w).map(([, x]) => x)
      const after = [...byWeek].filter(([wk]) => wk > w).map(([, x]) => x)
      if (before.length < 1 || after.length < 3) continue
      samples.push({ season: s, id, pos: p!, cur: { games: before.length, total: before.reduce((t, x) => t + x, 0) }, prev, target: after.reduce((t, x) => t + x, 0) / after.length })
    }
  }
}
console.log(`úrtak: ${samples.length}`)

const GRID = {
  prev: [0, 0.25, 0.5, 0.75, 1],
  k: [0, 1, 2, 3, 4, 6, 8],
  prior: { QB: [6, 9, 12, 15, 18], RB: [2, 4, 6, 8, 10], WR: [0, 1, 2, 4, 6, 8, 10], TE: [0, 1, 2, 4, 6, 8, 10] } as Record<string, number[]>,
}
const err = (x: Sample, p: any) => Math.abs(projection(x.cur, x.prev, p) - x.target)
const mae = (xs: Sample[], p: any) => xs.reduce((t, x) => t + err(x, p), 0) / xs.length

// 1. tuning, 2016-2021
const best: Record<string, any> = {}
console.log('\n1) val á 2016-2021')
for (const P of MARKET_POSITIONS) {
  const tr = samples.filter((x) => x.pos === P && x.season <= 2021)
  const cands = GRID.prev.flatMap((prev) => GRID.k.flatMap((k) => GRID.prior[P].map((prior) => ({ prev, k, prior }))))
  const r = tuneBy(cands, (c: any) => mae(tr, c), 2021, 2022)
  best[P] = r.best
  const edge = (['prev', 'k', 'prior'] as const).filter((key) => {
    const g = key === 'prior' ? GRID.prior[P] : GRID[key]
    const v = r.best[key]
    return (v === g[0] && v !== 0) || v === g[g.length - 1]
  })
  console.log(`   ${P}: ${JSON.stringify(r.best)} MAE ${r.logLoss.toFixed(3)} (einfalt ${mae(tr, MARKET_NAIVE[P]).toFixed(3)})${edge.length ? `  JAÐAR: ${edge.join(', ')}` : ''}`)
}

// 2. test, 2022-2025, clustered by player-season
const te = samples.filter((x) => x.season >= 2022)
const groups = new Map<string, { m: number[]; n: number[] }>()
for (const x of te) {
  const g = groups.get(`${x.season}:${x.id}`) ?? { m: [], n: [] }
  g.m.push(err(x, best[x.pos])); g.n.push(err(x, MARKET_NAIVE[x.pos as 'QB']))
  groups.set(`${x.season}:${x.id}`, g)
}
const mean = (xs: number[]) => xs.reduce((t, v) => t + v, 0) / xs.length
const gm = [...groups.values()]
const d = pairedDiff(gm.map((g) => mean(g.m)), gm.map((g) => mean(g.n)))
console.log(`\n2) prófun 2022-2025: ${te.length} raðir, ${gm.length} leikmannatímabil`)
console.log(`   MAE spá ${(te.reduce((t, x) => t + err(x, best[x.pos]), 0) / te.length).toFixed(3)}, einfalt ${(te.reduce((t, x) => t + err(x, MARKET_NAIVE[x.pos as 'QB']), 0) / te.length).toFixed(3)}`)
console.log(`   spá − einfalt: ${d.mean.toFixed(4)} [${d.lo.toFixed(4)}, ${d.hi.toFixed(4)}]`)
for (const P of MARKET_POSITIONS) {
  const g = [...groups.entries()].filter(([k]) => pos.get(k.split(':')[1]) === P).map(([, v]) => v)
  const dp = pairedDiff(g.map((x) => mean(x.m)), g.map((x) => mean(x.n)))
  console.log(`   ${P} (${g.length}): ${dp.mean.toFixed(4)} [${dp.lo.toFixed(4)}, ${dp.hi.toFixed(4)}]`)
}

// 3. verdict and the line for market.ts
const pass = d.hi < 0
console.log(`\n3) úrskurður: ${pass ? 'spáin stenst' : 'spáin stenst ekki, einfalda meðaltalið fer á síðuna'}`)
const final = pass ? best : { QB: MARKET_NAIVE.QB, RB: MARKET_NAIVE.RB, WR: MARKET_NAIVE.WR, TE: MARKET_NAIVE.TE }
console.log(`\nexport const NFL_MARKET: MarketParams = ${JSON.stringify(final).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ')}`)
