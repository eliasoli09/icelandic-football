/**
 * Walk-forward backtest of the site's own prediction model against Pinnacle
 * closing odds — the sharpest line available, and the standard benchmark for
 * whether a model knows anything the market does not.
 *
 * Ratings are built strictly from matches that had already finished, so no
 * result informs a prediction made before it. A fixture is only scored once
 * both clubs have MIN_GAMES of history.
 *
 * Data: exported from the soccer-dataset parquet files (see README in the
 * scratchpad exporter). Usage: cd web && npx tsx scripts/backtest.mts [league]
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const DATA = '/private/tmp/claude-501/-Users-elias-FH-leikmenn-/5a1239f1-ef56-4f70-95e0-a2d6c66305c7/scratchpad/sd'
const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { predictMatch } = await import(join(webDir, 'src/lib/predict.ts'))

const K = 24, HFA = 60, BASE = 1500
const MIN_GAMES = 10

interface Fx { id: number; date: string; league: number; home: number; away: number; gh: number; ga: number }

const rows = readFileSync(join(DATA, 'bt_fixtures.csv'), 'utf-8').split('\n').slice(1)
const fixtures: Fx[] = []
for (const line of rows) {
  if (!line) continue
  const p = line.split(',')
  fixtures.push({ id: +p[0], date: p[1], league: +p[2], home: +p[3], away: +p[4], gh: +p[5], ga: +p[6] })
}

const odds = new Map<number, [number, number, number]>()
for (const line of readFileSync(join(DATA, 'bt_odds.csv'), 'utf-8').split('\n').slice(1)) {
  if (!line) continue
  const p = line.split(',')
  odds.set(+p[0], [+p[1], +p[2], +p[3]])
}

const leagueName = new Map<number, string>()
for (const line of readFileSync(join(DATA, 'bt_leagues.csv'), 'utf-8').split('\n').slice(1)) {
  if (!line) continue
  const i = line.indexOf(',')
  const j = line.lastIndexOf(',')
  leagueName.set(+line.slice(0, i), line.slice(i + 1, j).replace(/^"|"$/g, ''))
}

const onlyLeague = process.argv[2] ? Number(process.argv[2]) : null

const elo = new Map<number, number>()
const games = new Map<number, number>()
const rate = (t: number) => elo.get(t) ?? BASE

let n = 0, llModel = 0, llMarket = 0, hitModel = 0, hitMarket = 0
let staked = 0, returned = 0, bets = 0
const bins = new Map<number, { n: number; hit: number; sum: number }>()
const byBand = new Map<number, { n: number; staked: number; ret: number }>()
const EDGE = 0.05 // only back a price when the model claims this much more

for (const f of fixtures) {
  const eh = rate(f.home), ea = rate(f.away)
  const gh = games.get(f.home) ?? 0, ga = games.get(f.away) ?? 0
  const price = odds.get(f.id)
  const eligible = price && gh >= MIN_GAMES && ga >= MIN_GAMES && (!onlyLeague || f.league === onlyLeague)

  if (eligible) {
    const p = predictMatch({ eloHome: eh, eloAway: ea, home: null, away: null })
    const model = [p.pHome, p.pDraw, p.pAway]
    const inv = price!.map((o) => 1 / o)
    const overround = inv.reduce((a, b) => a + b, 0)
    const market = inv.map((x) => x / overround) // de-margined
    const out = f.gh > f.ga ? 0 : f.gh === f.ga ? 1 : 2

    n++
    llModel += -Math.log(Math.max(model[out], 1e-9))
    llMarket += -Math.log(Math.max(market[out], 1e-9))
    if (model.indexOf(Math.max(...model)) === out) hitModel++
    if (market.indexOf(Math.max(...market)) === out) hitMarket++
    for (let i = 0; i < 3; i++) {
      const b = Math.min(9, Math.floor(model[i] * 10))
      const c = bins.get(b) ?? { n: 0, hit: 0, sum: 0 }
      c.n++; c.sum += model[i]; if (out === i) c.hit++
      bins.set(b, c)
    }
    // flat-stake test: back every outcome the model prices above the market
    for (let i = 0; i < 3; i++) {
      if (model[i] - market[i] < EDGE) continue
      bets++; staked += 1
      if (out === i) returned += price![i]
      const b = Math.min(9, Math.floor(model[i] * 10))
      const r = byBand.get(b) ?? { n: 0, staked: 0, ret: 0 }
      r.n++; r.staked += 1; if (out === i) r.ret += price![i]
      byBand.set(b, r)
    }
  }

  // update ratings only after the fixture has been used
  const exp = 1 / (1 + 10 ** ((ea - (eh + HFA)) / 400))
  const s = f.gh > f.ga ? 1 : f.gh === f.ga ? 0.5 : 0
  elo.set(f.home, eh + K * (s - exp))
  elo.set(f.away, ea - K * (s - exp))
  games.set(f.home, gh + 1)
  games.set(f.away, ga + 1)
}

console.log(`metnir leikir: ${n.toLocaleString('is')}${onlyLeague ? ` (deild ${onlyLeague}: ${leagueName.get(onlyLeague)})` : ''}`)
console.log()
console.log(`log loss  líkan:    ${(llModel / n).toFixed(4)}`)
console.log(`log loss  Pinnacle: ${(llMarket / n).toFixed(4)}`)
console.log(`munur:              ${((llModel - llMarket) / n).toFixed(4)}  ${llModel < llMarket ? '(líkanið betra)' : '(markaðurinn betri)'}`)
console.log()
console.log(`hittni    líkan:    ${(100 * hitModel / n).toFixed(1)}%`)
console.log(`hittni    Pinnacle: ${(100 * hitMarket / n).toFixed(1)}%`)
console.log()
console.log(`veðmál með ${(100 * EDGE).toFixed(0)}%+ forskot: ${bets.toLocaleString('is')}`)
if (bets) console.log(`ávöxtun: ${(100 * (returned - staked) / staked).toFixed(2)}%`)
console.log()
console.log('ávöxtun eftir líkindabili (þar sem veðjað var)')
for (const b of [...byBand.keys()].sort((a, z) => a - z)) {
  const r = byBand.get(b)!
  const roi = 100 * (r.ret - r.staked) / r.staked
  console.log(`  ${String(b * 10).padStart(2)}-${String(b * 10 + 10).padStart(3)}%  n=${String(r.n).padStart(6)}  ávöxtun ${roi.toFixed(1).padStart(7)}%`)
}
console.log()
console.log('kvörðun  spáð% -> raun%')
for (const b of [...bins.keys()].sort((a, z) => a - z)) {
  const v = bins.get(b)!
  console.log(`  ${String(b * 10).padStart(2)}-${String(b * 10 + 10).padStart(3)}%  spáð ${(100 * v.sum / v.n).toFixed(1).padStart(5)}%  raun ${(100 * v.hit / v.n).toFixed(1).padStart(5)}%  n=${v.n}`)
}
