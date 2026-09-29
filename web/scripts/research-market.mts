/**
 * Does the model add anything to the closing price?
 *
 * Answer, on 28,000 matches across eight leagues with Pinnacle closing odds:
 * no. The optimal weight on the model is zero in every league and in every
 * probability band. The price is ahead by about 0.025 of log loss and the gap
 * does not close with recalibration.
 *
 * Run it with:
 *   cd web && npx tsx scripts/research-market.mts
 * It expects the season files from football-data.co.uk in the odds directory
 * named below; fetch them with
 *   curl -sfL "https://www.football-data.co.uk/mmz4281/<season>/<div>.csv"
 * for seasons 1617..2627 and divisions E0 E1 SP1 I1 D1 F1 N1 P1.
 *
 * The market has beaten this model every time it has been checked. The question
 * that has never been answered is whether the model still carries information
 * the price does not — if it does, a blend beats both; if it does not, the
 * honest answer is to use the price where there is one.
 *
 * Walk-forward, per league, over eleven seasons of eight leagues. Ratings only
 * ever see finished matches, and the price is the one posted before kick-off.
 */
import { readFileSync, readdirSync } from 'fs'
const SP = '/private/tmp/claude-501/-Users-elias-FH-leikmenn-/65c87b5e-6d92-47c6-b996-b5da95bfafe5/scratchpad/odds'
const web = '/Users/elias/FH leikmenn/icelandic-football-predictor/web'
const { predictMatch } = await import(web + '/src/lib/predict.ts')
const { fit: dcFit, predict: dcPredict, DC_BLEND } = await import(web + '/src/lib/dixonColes.ts')
type DcMatch = { home: string; away: string; homeGoals: number; awayGoals: number; ageDays: number }

const DIV: Record<string, string> = {
  E0: 'premier', E1: 'championship', SP1: 'laliga', I1: 'seriea',
  D1: 'bundesliga', F1: 'ligue1', N1: 'eredivisie', P1: 'primeira',
}
interface M {
  div: string; date: string; home: string; away: string; gh: number; ga: number
  odds: [number, number, number] | null; book: string
}
const all: M[] = []
for (const f of readdirSync(SP).filter((x) => x.endsWith('.csv')).sort()) {
  const div = f.slice(5, -4)
  if (!DIV[div]) continue
  const text = readFileSync(`${SP}/${f}`, 'utf-8').replace(/^﻿/, '')
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const head = lines.shift()!.split(',')
  const at = (r: string[], n: string) => (r[head.indexOf(n)] ?? '').trim()
  for (const line of lines) {
    const r = line.split(',')
    const gh = Number(at(r, 'FTHG')), ga = Number(at(r, 'FTAG'))
    const home = at(r, 'HomeTeam'), away = at(r, 'AwayTeam')
    const d = at(r, 'Date').match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
    if (!home || !away || !Number.isFinite(gh) || !Number.isFinite(ga) || !d) continue
    const yr = d[3].length === 2 ? (Number(d[3]) < 50 ? 2000 + Number(d[3]) : 1900 + Number(d[3])) : Number(d[3])
    // the sharpest price available, in order
    let odds: [number, number, number] | null = null, book = ''
    for (const [h, dd, a, name] of [
      ['PSCH', 'PSCD', 'PSCA', 'Pinnacle lokastuðull'],
      ['AvgH', 'AvgD', 'AvgA', 'meðaltal markaðar'],
      ['B365H', 'B365D', 'B365A', 'Bet365'],
    ] as const) {
      const v = [Number(at(r, h)), Number(at(r, dd)), Number(at(r, a))]
      if (v.every((x) => x > 1.01)) { odds = v as [number, number, number]; book = name; break }
    }
    all.push({ div: DIV[div], date: `${yr}-${d[2]}-${d[1]}`, home, away, gh, ga, odds, book })
  }
}
all.sort((a, b) => a.date.localeCompare(b.date))
const withOdds = all.filter((m) => m.odds)
console.log(`leikir: ${all.length.toLocaleString('is')}   með stuðlum: ${withOdds.length.toLocaleString('is')}`)
const books = new Map<string, number>()
for (const m of withOdds) books.set(m.book, (books.get(m.book) ?? 0) + 1)
console.log(`heimildir: ${[...books].map(([k, v]) => `${k} ${v.toLocaleString('is')}`).join(', ')}\n`)

/** strip the bookmaker's margin, proportionally */
const devig = (o: [number, number, number]) => {
  const inv = o.map((x) => 1 / x)
  const t = inv[0] + inv[1] + inv[2]
  return [inv[0] / t, inv[1] / t, inv[2] / t] as [number, number, number]
}

const K = 24, HFA = 60, BASE = 1500
const GOALS: Record<string, { home: number; away: number }> = {
  premier: { home: 1.550, away: 1.273 }, championship: { home: 1.419, away: 1.138 },
  laliga: { home: 1.550, away: 1.112 }, seriea: { home: 1.511, away: 1.141 },
  bundesliga: { home: 1.681, away: 1.264 }, ligue1: { home: 1.445, away: 1.025 },
  eredivisie: { home: 1.768, away: 1.347 }, primeira: { home: 1.436, away: 1.141 },
}
const day = (d: string) => Math.floor(Date.parse(d + 'T00:00:00Z') / 86400000)
const WEIGHTS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1]

const elo = new Map<string, number>()
const rate = (t: string) => elo.get(t) ?? BASE
const perLeague = new Map<string, M[]>()
for (const m of all) perLeague.set(m.div, [...(perLeague.get(m.div) ?? []), m])

const rows: { date: string; div: string; model: number[]; market: number[]; truth: 0 | 1 | 2 }[] = []
for (const [div, list] of perLeague) {
  const goals = GOALS[div]
  let params: ReturnType<typeof dcFit> | null = null
  let fitted = -Infinity
  const localElo = new Map<string, number>()
  const lr = (t: string) => localElo.get(t) ?? BASE
  for (const [i, m] of list.entries()) {
    const today = day(m.date)
    if (today - fitted >= 14) {
      const hist: DcMatch[] = []
      for (let k = i - 1; k >= 0; k--) {
        const p = list[k]
        const age = today - day(p.date)
        if (age > 5 * 365) break
        if (age >= 0) hist.push({ home: p.home, away: p.away, homeGoals: p.gh, awayGoals: p.ga, ageDays: age })
      }
      params = hist.length >= 200 ? dcFit(hist, { maxIterations: 220 }) : null
      fitted = today
    }
    if (m.odds && params && localElo.has(m.home) && localElo.has(m.away)) {
      const e = predictMatch({ eloHome: lr(m.home), eloAway: lr(m.away), home: null, away: null, goals })
      let ph = e.pHome, pd = e.pDraw, pa = e.pAway
      if (params.attack.has(m.home) && params.attack.has(m.away)) {
        const q = dcPredict(params, m.home, m.away)
        ph = ph * (1 - DC_BLEND) + q.pHome * DC_BLEND
        pd = pd * (1 - DC_BLEND) + q.pDraw * DC_BLEND
        pa = pa * (1 - DC_BLEND) + q.pAway * DC_BLEND
      }
      rows.push({
        date: m.date, div, model: [ph, pd, pa], market: devig(m.odds),
        truth: m.gh > m.ga ? 0 : m.gh === m.ga ? 1 : 2,
      })
    }
    const eh = lr(m.home), ea = lr(m.away)
    const s = m.gh > m.ga ? 1 : m.gh === m.ga ? 0.5 : 0
    const d = K * (s - 1 / (1 + 10 ** ((ea - (eh + HFA)) / 400)))
    localElo.set(m.home, eh + d); localElo.set(m.away, ea - d)
  }
}
rows.sort((a, b) => a.date.localeCompare(b.date))
const HOLDOUT = '2024-07-01'
const ll = (p: number[], t: number) => -Math.log(Math.max(p[t], 1e-9))
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const mix = (a: number[], b: number[], w: number) => a.map((x, i) => x * (1 - w) + b[i] * w)

console.log(`metnir leikir: ${rows.length.toLocaleString('is')}   held út frá ${HOLDOUT}\n`)
console.log('vægi líkans   log loss (fit)   (held út)')
const fitSet = rows.filter((r) => r.date < HOLDOUT)
const held = rows.filter((r) => r.date >= HOLDOUT)
let best = { w: 0, v: Infinity }
for (const w of WEIGHTS) {
  const f = mean(fitSet.map((r) => ll(mix(r.market, r.model, w), r.truth)))
  const h = mean(held.map((r) => ll(mix(r.market, r.model, w), r.truth)))
  if (f < best.v) best = { w, v: f }
  const label = w === 0 ? 'markaður einn' : w === 1 ? 'líkan eitt' : `${w.toFixed(1)}`
  console.log(`${label.padEnd(13)} ${f.toFixed(5)}          ${h.toFixed(5)}`)
}
console.log(`\nvalið á fit-gögnum: vægi líkans ${best.w}`)
const dMarket = held.map((r) => ll(r.market, r.truth) - ll(mix(r.market, r.model, best.w), r.truth))
const m0 = mean(dMarket)
const sd = Math.sqrt(dMarket.reduce((s, x) => s + (x - m0) ** 2, 0) / (dMarket.length - 1))
const ci = 1.96 * sd / Math.sqrt(dMarket.length)
console.log(`blanda betri en markaður einn: ${m0.toFixed(5)} ±${ci.toFixed(5)}  → ${m0 - ci > 0 ? 'marktækt' : 'EKKI marktækt'}`)

// ── where, if anywhere, does the model earn its keep? ──────────────────
console.log('\n── eftir deildum (allt úrtakið) ──')
console.log('deild            leikir   markaður   líkan    besta vægi   ávinningur')
const byDiv = new Map<string, typeof rows>()
for (const r of rows) byDiv.set(r.div, [...(byDiv.get(r.div) ?? []), r])
for (const [div, list] of [...byDiv].sort((a, b) => b[1].length - a[1].length)) {
  const mk = mean(list.map((r) => ll(r.market, r.truth)))
  const md = mean(list.map((r) => ll(r.model, r.truth)))
  let bw = 0, bv = mk
  for (const w of WEIGHTS) {
    const v = mean(list.map((r) => ll(mix(r.market, r.model, w), r.truth)))
    if (v < bv) { bv = v; bw = w }
  }
  console.log(`${div.padEnd(15)} ${String(list.length).padStart(6)}   ${mk.toFixed(5)}  ${md.toFixed(5)}   ${bw.toFixed(1).padStart(6)}      ${(mk - bv).toFixed(5)}`)
}

console.log('\n── eftir því hversu skýr favorítinn er (markaðslíkur á líklegustu útkomu) ──')
console.log('bil          leikir   markaður   líkan     besta vægi')
const bands: [number, number, string][] = [[0, 0.4, 'undir 40%'], [0.4, 0.5, '40–50%'], [0.5, 0.6, '50–60%'], [0.6, 0.75, '60–75%'], [0.75, 1.01, 'yfir 75%']]
for (const [lo, hi, label] of bands) {
  const list = rows.filter((r) => { const m = Math.max(...r.market); return m >= lo && m < hi })
  if (list.length < 200) continue
  const mk = mean(list.map((r) => ll(r.market, r.truth)))
  const md = mean(list.map((r) => ll(r.model, r.truth)))
  let bw = 0, bv = mk
  for (const w of WEIGHTS) {
    const v = mean(list.map((r) => ll(mix(r.market, r.model, w), r.truth)))
    if (v < bv) { bv = v; bw = w }
  }
  console.log(`${label.padEnd(12)} ${String(list.length).padStart(6)}   ${mk.toFixed(5)}  ${md.toFixed(5)}    ${bw.toFixed(1)}`)
}


// ── is the model simply over- or under-confident? ──────────────────────
// The price is unavailable for most of what this site predicts: Iceland, and
// every fixture more than a few days out. If the model is miscalibrated in a
// fixable way, that is worth more than anything the market blend could give.
const temper = (p: number[], t: number) => {
  const q = p.map((x) => Math.pow(Math.max(x, 1e-9), 1 / t))
  const s = q[0] + q[1] + q[2]
  return q.map((x) => x / s)
}
console.log('\n── hitastigsskölun líkansins, mæld á raunverulegum úrslitum ──')
console.log('hitastig   log loss (fit)   (held út)')
let bestT = { t: 1, v: Infinity }
for (const t of [0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.3]) {
  const f = mean(fitSet.map((r) => ll(temper(r.model, t), r.truth)))
  const h = mean(held.map((r) => ll(temper(r.model, t), r.truth)))
  if (f < bestT.v) bestT = { t, v: f }
  console.log(`${t.toFixed(2).padEnd(10)} ${f.toFixed(5)}          ${h.toFixed(5)}`)
}
console.log(`\nbest á fit-gögnum: hitastig ${bestT.t}`)
const dT = held.map((r) => ll(r.model, r.truth) - ll(temper(r.model, bestT.t), r.truth))
const mT = mean(dT)
const sdT = Math.sqrt(dT.reduce((s, x) => s + (x - mT) ** 2, 0) / (dT.length - 1))
const ciT = 1.96 * sdT / Math.sqrt(dT.length)
console.log(`skölun betri en óskalað: ${mT.toFixed(5)} ±${ciT.toFixed(5)}  → ${mT - ciT > 0 ? 'marktækt' : 'ekki marktækt'}`)

// where the miscalibration sits
console.log('\n── kvörðun líkansins í líkindabilum (allt úrtakið) ──')
console.log('spáð bil     leikir   spáð    raun')
for (const [lo, hi] of [[0, 0.15], [0.15, 0.25], [0.25, 0.35], [0.35, 0.45], [0.45, 0.55], [0.55, 0.7], [0.7, 1.01]]) {
  let n = 0, pred = 0, hit = 0
  for (const r of rows) for (let k = 0; k < 3; k++) {
    if (r.model[k] >= lo && r.model[k] < hi) { n++; pred += r.model[k]; if (r.truth === k) hit++ }
  }
  if (n < 300) continue
  console.log(`${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}%`.padEnd(12) + `${String(n).padStart(6)}   ${(100 * pred / n).toFixed(1)}%   ${(100 * hit / n).toFixed(1)}%`)
}


// ── Platt scaling on the log-odds ──────────────────────────────────────
// The bands show an S: long shots priced too high, strong favourites too low.
// One temperature cannot fix that, but a slope on the log-odds can.
const logit = (p: number) => Math.log(Math.max(p, 1e-9) / Math.max(1 - p, 1e-9))
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))
function platt(p: number[], a: number, b: number) {
  const q = p.map((x) => sigmoid(a + b * logit(x)))
  const s = q[0] + q[1] + q[2]
  return q.map((x) => x / s)
}
// fit a and b by gradient descent on the fit set
let a = 0, b = 1
for (let step = 0; step < 4000; step++) {
  let ga = 0, gb = 0
  for (const r of fitSet) {
    for (let k = 0; k < 3; k++) {
      const z = a + b * logit(r.model[k])
      const q = sigmoid(z)
      const y = r.truth === k ? 1 : 0
      ga += q - y
      gb += (q - y) * logit(r.model[k])
    }
  }
  a -= 0.00002 * ga / fitSet.length * 100
  b -= 0.00002 * gb / fitSet.length * 100
}
console.log(`\n── Platt-kvörðun ──`)
console.log(`stillt: a = ${a.toFixed(4)}, hallatala b = ${b.toFixed(4)}  (b > 1 þýðir að líkanið var of flatt)`)
const before = mean(held.map((r) => ll(r.model, r.truth)))
const after = mean(held.map((r) => ll(platt(r.model, a, b), r.truth)))
console.log(`held út:  óskalað ${before.toFixed(5)}   kvarðað ${after.toFixed(5)}`)
const dP = held.map((r) => ll(r.model, r.truth) - ll(platt(r.model, a, b), r.truth))
const mP = mean(dP)
const sdP = Math.sqrt(dP.reduce((s, x) => s + (x - mP) ** 2, 0) / (dP.length - 1))
const ciP = 1.96 * sdP / Math.sqrt(dP.length)
console.log(`bæting: ${mP.toFixed(5)} ±${ciP.toFixed(5)}  → ${mP - ciP > 0 ? 'MARKTÆK' : 'ekki marktæk'}`)
console.log(`til samanburðar er markaðurinn á ${mean(held.map((r) => ll(r.market, r.truth))).toFixed(5)}`)

console.log('\n── kvörðun eftir Platt ──')
console.log('spáð bil     leikir   spáð    raun')
for (const [lo, hi] of [[0, 0.15], [0.15, 0.25], [0.25, 0.35], [0.35, 0.45], [0.45, 0.55], [0.55, 0.7], [0.7, 1.01]]) {
  let n = 0, pred = 0, hit = 0
  for (const r of rows) {
    const c = platt(r.model, a, b)
    for (let k = 0; k < 3; k++) if (c[k] >= lo && c[k] < hi) { n++; pred += c[k]; if (r.truth === k) hit++ }
  }
  if (n < 300) continue
  console.log(`${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}%`.padEnd(12) + `${String(n).padStart(6)}   ${(100 * pred / n).toFixed(1)}%   ${(100 * hit / n).toFixed(1)}%`)
}
