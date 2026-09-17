/**
 * FIFA ratings for every Besta deild player, from scripts/fifa/players.json.
 *
 * 1. What a player's numbers say. SofaScore's season snapshot holds the 150
 *    best average match ratings (the lowest 6.69), so a player who had played
 *    by then and is missing from it rated below that line. A censored (Tobit)
 *    regression uses both: the rating where it is known, "below 6.69" where it
 *    is not. The inputs are the season as it stood on the snapshot date, and
 *    ten-fold cross-validation reports how well they predict ratings they did
 *    not see.
 * 2. Each player's quality on the SofaScore scale: the model on the whole
 *    season so far, pulled towards his own SofaScore rating by the matches it
 *    rests on, or held below the line where the snapshot left him out.
 * 3. The FIFA scale: the best player is 94, and every 0.1 of SofaScore rating
 *    below him is POINTS_PER_TENTH fewer.
 *
 * Usage: cd web && npx tsx scripts/fifa/rate.mts
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
const data = JSON.parse(readFileSync(join(here, 'players.json'), 'utf-8'))
const { respell } = await import(join(here, '../hver/parse.ts'))

export const TOP = 94
/** FIFA points for 0.1 of SofaScore average rating. */
const POINTS_PER_TENTH = Number(process.env.POINTS_PER_TENTH ?? 2)
/** Matches of the model's evidence a player's own SofaScore rating is weighed against. */
const PRIOR_MATCHES = 4
const FLOOR = 40

type Log = { date: string; minutes: number; start: boolean; goals: number; cards: number }
interface Raw {
  ksiId: number; ksiName: string; team: string; keeperStarts: number; log: Log[]
  tm: { name: string; position: string; born: string | null; nations: string[] } | null
  sofa: { name: string; rating: number; appearances: number; position: string | null } | null
}
const players: Raw[] = data.players
const snapshot: string = data.sofaLoaded
const elo = Object.values(data.teamElo as Record<string, number>)
const eloMean = elo.reduce((a, b) => a + b, 0) / elo.length
const eloSd = Math.sqrt(elo.reduce((a, b) => a + (b - eloMean) ** 2, 0) / elo.length)

/** A player's inputs from the matches before a date. */
function features(p: Raw, before: string) {
  const log = p.log.filter((l) => l.date < before)
  if (!log.length) return null
  const minutes = log.reduce((a, l) => a + l.minutes, 0)
  const first = log.map((l) => l.date).sort()[0]
  const teamMatches = (data.teamDates[p.team] as string[]).filter((d) => d >= first && d < before).length
  const nineties = minutes / 90
  return {
    apps: log.length,
    x: [
      1,
      Math.min(1, minutes / (Math.max(1, teamMatches) * 90)), // share of the minutes he could have played
      Math.log1p(nineties), // how much of a record there is
      (data.teamElo[p.team] - eloMean) / eloSd, // his club's strength
      log.reduce((a, l) => a + l.goals, 0) / (nineties + 5), // goals per 90, shrunk
      log.reduce((a, l) => a + l.cards, 0) / (nineties + 5), // cards per 90, shrunk
      p.keeperStarts > 0 ? 1 : 0,
    ],
  }
}
const NAMES = ['fasti', 'mínútuhlutfall', 'log(90 mín.)', 'Elo liðs', 'mörk/90', 'spjöld/90', 'markvörður']

// ── the censored regression ──────────────────────────────────────────

const phi = (z: number) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI)
function Phi(z: number) {
  // Abramowitz and Stegun 7.1.26, accurate to 1e-7
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2)
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2
}

interface Row { x: number[]; y: number | null; w: number }
const LINE = Math.min(...players.filter((p) => p.sofa).map((p) => p.sofa!.rating))

function fit(rows: Row[]) {
  const k = rows[0].x.length
  let beta = new Array(k).fill(0); beta[0] = LINE
  let logS = Math.log(0.4)
  const m = new Array(k + 1).fill(0), v = new Array(k + 1).fill(0)
  for (let it = 1; it <= 4000; it++) {
    const g = new Array(k + 1).fill(0)
    const s = Math.exp(logS)
    for (const r of rows) {
      const mu = r.x.reduce((a, xi, i) => a + xi * beta[i], 0)
      if (r.y !== null) {
        const z = (r.y - mu) / s
        for (let i = 0; i < k; i++) g[i] += r.w * z / s * r.x[i]
        g[k] += r.w * (z * z - 1)
      } else {
        const a = (LINE - mu) / s
        const ratio = phi(a) / Math.max(1e-12, Phi(a))
        for (let i = 0; i < k; i++) g[i] += r.w * -ratio / s * r.x[i]
        g[k] += r.w * -ratio * a
      }
    }
    // Adam, with a light ridge on the slopes
    for (let i = 0; i <= k; i++) {
      const grad = -(g[i] - (i > 0 && i < k ? 0.5 * beta[i] : 0))
      m[i] = 0.9 * m[i] + 0.1 * grad
      v[i] = 0.999 * v[i] + 0.001 * grad * grad
      const step = 0.01 * (m[i] / (1 - 0.9 ** it)) / (Math.sqrt(v[i] / (1 - 0.999 ** it)) + 1e-8)
      if (i < k) beta[i] -= step; else logS -= step
    }
  }
  return { beta, sigma: Math.exp(logS) }
}
const predict = (beta: number[], x: number[]) => x.reduce((a, xi, i) => a + xi * beta[i], 0)

const fitRows: (Row & { id: number })[] = []
for (const p of players) {
  const f = features(p, snapshot)
  if (!f) continue
  const apps = p.sofa ? p.sofa.appearances : f.apps
  fitRows.push({ id: p.ksiId, x: f.x, y: p.sofa ? p.sofa.rating : null, w: apps / (apps + 2) })
}
const model = fit(fitRows)

// ten-fold cross-validation: correlation with ratings not seen, and ranking of who made the 150
const folds = 10
const held: { y: number | null; pred: number }[] = []
fitRows.forEach((r, i) => ((r as { fold?: number }).fold = i % folds))
for (let f = 0; f < folds; f++) {
  const train = fitRows.filter((r) => (r as { fold?: number }).fold !== f)
  const m = fit(train)
  for (const r of fitRows.filter((r) => (r as { fold?: number }).fold === f)) held.push({ y: r.y, pred: predict(m.beta, r.x) })
}
const seen = held.filter((h) => h.y !== null && fitRows.find(() => true))
const corr = (a: number[], b: number[]) => {
  const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0)
  return cov / Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0))
}
const listed = held.map((h) => h.y !== null)
let pairs = 0, right = 0
held.forEach((a, i) => held.forEach((b, j) => { if (listed[i] && !listed[j]) { pairs++; if (a.pred > b.pred) right++ } }))
const cv = { correlation: +corr(seen.map((h) => h.y!), seen.map((h) => h.pred)).toFixed(3), auc: +(right / pairs).toFixed(3), players: held.length }

// ── quality and the FIFA scale ───────────────────────────────────────

const today = '9999-12-31'
const FIFA_POSITION: Record<string, string> = {
  'Goalkeeper': 'GK', 'Centre-Back': 'CB', 'Left-Back': 'LB', 'Right-Back': 'RB', 'Defensive Midfield': 'CDM',
  'Central Midfield': 'CM', 'Attacking Midfield': 'CAM', 'Left Midfield': 'LM', 'Right Midfield': 'RM',
  'Left Winger': 'LW', 'Right Winger': 'RW', 'Second Striker': 'CF', 'Centre-Forward': 'ST',
}
const BROAD: Record<string, string> = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'FWD' }

const rated = players.map((p) => {
  const f = features(p, today)!
  const mu = predict(model.beta, f.x)
  let q: number, basis: 'sofascore' | 'líkan' | 'líkan undir línu'
  if (p.sofa) {
    q = (PRIOR_MATCHES * mu + p.sofa.appearances * p.sofa.rating) / (PRIOR_MATCHES + p.sofa.appearances)
    basis = 'sofascore'
  } else if (p.log.some((l) => l.date < snapshot)) {
    // left out of the 150: the expected rating given that it is below the line
    const a = (LINE - mu) / model.sigma
    q = mu - model.sigma * phi(a) / Math.max(1e-12, Phi(a))
    basis = 'líkan undir línu'
  } else {
    q = mu
    basis = 'líkan'
  }
  const position = p.tm ? FIFA_POSITION[p.tm.position] ?? null : p.keeperStarts > 0 ? 'GK' : p.sofa?.position ? BROAD[p.sofa.position] : null
  const born = p.tm?.born
  return {
    id: p.ksiId,
    // the short name Transfermarkt uses, spelt as KSÍ spells it: Óskar Borgþórsson, not Borgthórsson
    name: p.tm ? respell(p.tm.name, p.ksiName, p.ksiName) : p.ksiName,
    team: p.team,
    position,
    nation: p.tm?.nations[0] ?? null,
    born: born ? +born.slice(0, 4) : null,
    q,
    basis,
    apps: p.log.length,
    starts: p.log.filter((l) => l.start).length,
    minutes: p.log.reduce((a, l) => a + l.minutes, 0),
    goals: p.log.reduce((a, l) => a + l.goals, 0),
  }
})
const best = Math.max(...rated.map((r) => r.q))
const ratings = rated
  .map(({ q, ...r }) => ({ ...r, rating: Math.max(FLOOR, Math.min(TOP, Math.round(TOP - (best - q) * 10 * POINTS_PER_TENTH))) }))
  .sort((a, b) => b.rating - a.rating || b.minutes - a.minutes)

writeFileSync(join(webDir, 'src/lib/fifa/ratings.json'), JSON.stringify({
  season: data.season,
  updated: data.gathered,
  matches: data.matches,
  sofascoreSnapshot: snapshot,
  line: LINE,
  model: { weights: Object.fromEntries(NAMES.map((n, i) => [n, +model.beta[i].toFixed(3)])), sigma: +model.sigma.toFixed(3), crossValidation: cv },
  players: ratings,
}) + '\n')

console.log('vægi:', Object.fromEntries(NAMES.map((n, i) => [n, +model.beta[i].toFixed(3)])), 'sigma', model.sigma.toFixed(3))
console.log('krossprófun:', cv)
const regulars = ratings.filter((r) => r.minutes >= 900).map((r) => r.rating).sort((a, b) => a - b)
console.log(`${ratings.length} leikmenn; fastamenn (900+ mín.): miðgildi ${regulars[Math.floor(regulars.length / 2)]}, lægst ${regulars[0]}; allir lægst ${ratings[ratings.length - 1].rating}`)
console.log(ratings.slice(0, 25).map((r) => `${r.rating} ${r.position ?? '-'} ${r.name} (${r.team}, ${r.basis})`).join('\n'))
