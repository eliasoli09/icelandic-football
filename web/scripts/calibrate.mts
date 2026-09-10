/**
 * Fit a temperature on the model's probabilities and check it out of sample.
 *
 * p'_i ∝ p_i^(1/T): T > 1 flattens an overconfident model. T is fitted on
 * matches before SPLIT and scored only on matches after it, so the number
 * reported is not the number it was tuned on.
 *
 * Usage: cd web && npx tsx scripts/calibrate.mts
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const DATA = '/private/tmp/claude-501/-Users-elias-FH-leikmenn-/5a1239f1-ef56-4f70-95e0-a2d6c66305c7/scratchpad/sd'
const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { predictMatch } = await import(join(webDir, 'src/lib/predict.ts'))

const K = 24, HFA = 60, BASE = 1500, MIN_GAMES = 10
const SPLIT = '2021-01-01'

const fixtures = readFileSync(join(DATA, 'bt_fixtures.csv'), 'utf-8').split('\n').slice(1)
  .filter(Boolean).map((l) => { const p = l.split(','); return { id: +p[0], date: p[1], home: +p[3], away: +p[4], gh: +p[5], ga: +p[6] } })
const odds = new Map<number, [number, number, number]>()
for (const l of readFileSync(join(DATA, 'bt_odds.csv'), 'utf-8').split('\n').slice(1)) {
  if (!l) continue; const p = l.split(','); odds.set(+p[0], [+p[1], +p[2], +p[3]])
}

const elo = new Map<number, number>(), games = new Map<number, number>()
const rate = (t: number) => elo.get(t) ?? BASE
/** model probabilities and outcome, kept per period */
const train: { p: number[]; out: number }[] = []
const test: { p: number[]; out: number; price: [number, number, number] }[] = []

for (const f of fixtures) {
  const eh = rate(f.home), ea = rate(f.away)
  const gh = games.get(f.home) ?? 0, ga = games.get(f.away) ?? 0
  const price = odds.get(f.id)
  if (price && gh >= MIN_GAMES && ga >= MIN_GAMES) {
    const pr = predictMatch({ eloHome: eh, eloAway: ea, home: null, away: null })
    const p = [pr.pHome, pr.pDraw, pr.pAway]
    const out = f.gh > f.ga ? 0 : f.gh === f.ga ? 1 : 2
    if (f.date < SPLIT) train.push({ p, out })
    else test.push({ p, out, price })
  }
  const exp = 1 / (1 + 10 ** ((ea - (eh + HFA)) / 400))
  const s = f.gh > f.ga ? 1 : f.gh === f.ga ? 0.5 : 0
  elo.set(f.home, eh + K * (s - exp)); elo.set(f.away, ea - K * (s - exp))
  games.set(f.home, gh + 1); games.set(f.away, ga + 1)
}

const temper = (p: number[], T: number) => {
  const q = p.map((x) => Math.pow(Math.max(x, 1e-12), 1 / T))
  const s = q.reduce((a, b) => a + b, 0)
  return q.map((x) => x / s)
}
const loss = (rows: { p: number[]; out: number }[], T: number) =>
  rows.reduce((a, r) => a - Math.log(Math.max(temper(r.p, T)[r.out], 1e-12)), 0) / rows.length

let bestT = 1, best = Infinity
for (let T = 0.8; T <= 3.0; T += 0.01) {
  const l = loss(train, T)
  if (l < best) { best = l; bestT = T }
}

console.log(`þjálfun: ${train.length.toLocaleString('is')} leikir fyrir ${SPLIT}`)
console.log(`prófun:  ${test.length.toLocaleString('is')} leikir eftir ${SPLIT}`)
console.log()
console.log(`besta hitastig T = ${bestT.toFixed(2)}   (T=1 er engin breyting)`)
console.log()
const before = loss(test, 1), after = loss(test, bestT)
let market = 0
for (const r of test) {
  const inv = r.price.map((o) => 1 / o); const s = inv.reduce((a, b) => a + b, 0)
  market -= Math.log(Math.max(inv[r.out] / s, 1e-12))
}
market /= test.length
console.log('UTAN ÞJÁLFUNAR (log loss, lægra er betra)')
console.log(`  fyrir kvörðun: ${before.toFixed(4)}`)
console.log(`  eftir kvörðun: ${after.toFixed(4)}   (${(before - after >= 0 ? '-' : '+')}${Math.abs(before - after).toFixed(4)})`)
console.log(`  Pinnacle:      ${market.toFixed(4)}`)
console.log()
const bins = new Map<number, { n: number; hit: number; sum: number }>()
for (const r of test) {
  const q = temper(r.p, bestT)
  for (let i = 0; i < 3; i++) {
    const b = Math.min(9, Math.floor(q[i] * 10))
    const c = bins.get(b) ?? { n: 0, hit: 0, sum: 0 }
    c.n++; c.sum += q[i]; if (r.out === i) c.hit++; bins.set(b, c)
  }
}
console.log('kvörðun eftir lagfæringu  spáð% -> raun%')
for (const b of [...bins.keys()].sort((a, z) => a - z)) {
  const v = bins.get(b)!
  console.log(`  ${String(b * 10).padStart(2)}-${String(b * 10 + 10).padStart(3)}%  spáð ${(100 * v.sum / v.n).toFixed(1).padStart(5)}%  raun ${(100 * v.hit / v.n).toFixed(1).padStart(5)}%  n=${v.n}`)
}
