/**
 * FIFA ratings for every Besta deild player, from scripts/fifa/players.json
 * (minutes, goals and positions from KSÍ and Transfermarkt) and the season's
 * player statistics Elias supplied on 17 September 2026
 * (scripts/fifa/stats-2026-09-17.csv): goals, dribbles, tackles, assists, pass
 * accuracy and average match rating for all of the league's players.
 *
 * 1. What a player's numbers say: a weighted regression of the average rating
 *    on share of minutes, club strength, goals and cards per 90 and keeping
 *    goal, checked by ten-fold cross-validation.
 * 2. Each player's quality: his own average rating, pulled towards the model
 *    by how few matches it rests on: the full matches the statistics saw, judged
 *    from their own tackle and dribble counts (an 8.70 from a season with one
 *    tackle and one dribble recorded is not a season of 8.70).
 * 3. The FIFA scale, even rather than steep: the established players (five
 *    matches or more) are ranked, the best is 94 and the rest follow the curve
 *    94 - 32 * rank^0.62, so the top of the league is a group, not one man.
 *    (about ten players at 90 or more)
 *    Everyone else is placed on the same curve by quality.
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
const { normalise } = await import(join(webDir, 'src/lib/topp10/normalise.ts'))
const STATS_FILE = 'stats-2026-09-17.csv'

export const TOP = 94
/** The steepness of the scale: the lowest established player sits TOP − SPREAD. */
const SPREAD = 32
const CURVE = 0.62
/** Full matches (90 minutes) of the model's evidence a player's own average rating is weighed against. */
const PRIOR_MATCHES = 4
/** Established players set the scale. */
const ESTABLISHED = 5
const FLOOR = 45

type Log = { date: string; minutes: number; start: boolean; goals: number; cards: number }
interface Raw {
  ksiId: number; ksiName: string; team: string; keeperStarts: number; log: Log[]
  tm: { name: string; position: string; born: string | null; nations: string[] } | null
  sofa: { position: string | null } | null
}
const players: Raw[] = data.players

// ── the supplied statistics ──────────────────────────────────────────

const TEAM: Record<string, string> = {
  'Víkingur Reykjavík': 'Víkingur R.', 'KR Reykjavík': 'KR', 'Breidablik Kópavogur': 'Breiðablik', 'KA Akureyri': 'KA',
  'Stjarnan Garðabær': 'Stjarnan', 'Valur Reykjavík': 'Valur', 'Keflavík IF': 'Keflavík', 'ÍA Akranes': 'ÍA',
  'FH Hafnarfjörður': 'FH', 'Fram Reykjavík': 'Fram', 'ÍBV Vestmannaeyjar': 'ÍBV', 'Þór Akureyri': 'Þór',
}
/**
 * Names the statistics spell differently from KSÍ, by club. Each is the only
 * unpaired player of that name in his club on either side.
 */
const ALIASES: Record<string, string> = {
  'Valur|Dagur Orri Gardarson': 'Dagur Orri Garðarsson',
  'Fram|Kyle McLagan': 'Kyle Douglas Mc Lagan',
  'Keflavík|Breki Baxter': 'Þorlákur Breki Þ. Baxter',
  'KA|Rodri': 'Rodrigo Gomes Mateo',
  'Þór|Kevin Vázquez': 'Kevin Vazquez Comesaña',
  'Breiðablik|Gabriel Snaer': 'Gabríel Snær Hallsson',
  'Valur|Bjarni Antonsson Duffield': 'Bjarni Mark Antonsson',
  'ÍBV|Vítor Pisco': 'Vitor Hugo Cruz Rocha',
  'Þór|Birgir Ómar Hlnysson': 'Birgir Ómar Hlynsson',
  'ÍBV|Milan Jezdimirović': 'Milan Jezdemirovic',
  'FH|Bastian Andersen': 'Bastian Anderson',
  'Keflavík|Arnor Atli': 'Arnór Atli Aðalbjörnsson',
}
interface Stat { goals: number; dribbles: number; tackles: number; assists: number; passPct: number; rating: number }
const stats = new Map<number, Stat>()
const unmatched: string[] = []
{
  const words = (x: string) => normalise(x).split(' ').filter(Boolean)
  const used = new Set<number>()
  for (const line of readFileSync(join(here, STATS_FILE), 'utf-8').trim().split('\n').slice(1)) {
    const c = line.split(';')
    const team = TEAM[c[0]]
    if (!team) throw new Error(`óþekkt lið í tölfræði: ${c[0]}`)
    const k = words(ALIASES[`${team}|${c[1]}`] ?? c[1])
    const pool = players.filter((p) => p.team === team && !used.has(p.ksiId))
    const names = (p: Raw) => [p.ksiName, p.tm?.name].filter(Boolean).map((n) => words(n!))
    const tests = [
      (n: string[]) => n.join(' ') === k.join(' '),
      (n: string[]) => n[0] === k[0] && n[n.length - 1] === k[k.length - 1],
      (n: string[]) => n[n.length - 1] === k[k.length - 1] && (n[0].startsWith(k[0]) || k[0].startsWith(n[0])),
    ]
    let hit: Raw | null = null
    for (const t of tests) {
      const h = pool.filter((p) => names(p).some(t))
      if (h.length === 1) { hit = h[0]; break }
      if (h.length > 1) break
    }
    if (!hit) { unmatched.push(`${team}: ${c[1]}`); continue }
    used.add(hit.ksiId)
    const n = (i: number) => Number(c[i])
    stats.set(hit.ksiId, { goals: n(2), dribbles: n(3), tackles: n(4), assists: n(5), passPct: n(6), rating: n(7) })
  }
}

// ── the model ────────────────────────────────────────────────────────

const elo = Object.values(data.teamElo as Record<string, number>)
const eloMean = elo.reduce((a, b) => a + b, 0) / elo.length
const eloSd = Math.sqrt(elo.reduce((a, b) => a + (b - eloMean) ** 2, 0) / elo.length)

function features(p: Raw) {
  const minutes = p.log.reduce((a, l) => a + l.minutes, 0)
  const first = p.log.map((l) => l.date).sort()[0]
  const teamMatches = (data.teamDates[p.team] as string[]).filter((d) => d >= first).length
  const nineties = minutes / 90
  return [
    1,
    Math.min(1, minutes / (Math.max(1, teamMatches) * 90)),
    Math.log1p(nineties),
    (data.teamElo[p.team] - eloMean) / eloSd,
    p.log.reduce((a, l) => a + l.goals, 0) / (nineties + 5),
    p.log.reduce((a, l) => a + l.cards, 0) / (nineties + 5),
    p.keeperStarts > 0 ? 1 : 0,
  ]
}
const NAMES = ['fasti', 'mínútuhlutfall', 'log(90 mín.)', 'Elo liðs', 'mörk/90', 'spjöld/90', 'markvörður']

/** Weighted least squares with a light ridge on the slopes. */
function fit(rows: { x: number[]; y: number; w: number }[]) {
  const k = rows[0].x.length
  const A = Array.from({ length: k }, () => new Array(k).fill(0)), b = new Array(k).fill(0)
  for (const r of rows) for (let i = 0; i < k; i++) { b[i] += r.w * r.x[i] * r.y; for (let j = 0; j < k; j++) A[i][j] += r.w * r.x[i] * r.x[j] }
  for (let i = 1; i < k; i++) A[i][i] += 0.5
  // Gaussian elimination
  for (let i = 0; i < k; i++) {
    let piv = i
    for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r
    ;[A[i], A[piv]] = [A[piv], A[i]]; [b[i], b[piv]] = [b[piv], b[i]]
    for (let r = i + 1; r < k; r++) {
      const f = A[r][i] / A[i][i]
      for (let c = i; c < k; c++) A[r][c] -= f * A[i][c]
      b[r] -= f * b[i]
    }
  }
  const beta = new Array(k).fill(0)
  for (let i = k - 1; i >= 0; i--) beta[i] = (b[i] - A[i].slice(i + 1).reduce((a, v, j) => a + v * beta[i + 1 + j], 0)) / A[i][i]
  return beta
}
const predict = (beta: number[], x: number[]) => x.reduce((a, xi, i) => a + xi * beta[i], 0)

/**
 * How many full matches the supplied statistics saw for a player. Their counts
 * say it: a regular's tackles and dribbles per 90 in his line are known, so a
 * season of 1,676 minutes with one tackle and one dribble was barely recorded,
 * and its average rating rests on little. Never more than KSÍ's minutes;
 * goalkeepers, who tackle and dribble little, count by minutes.
 */
const lineOf = (p: Raw) => {
  const pos = p.tm?.position ?? ''
  if (p.keeperStarts > 0 || pos === 'Goalkeeper') return 'GK'
  if (/Back|Defender|Sweeper/.test(pos)) return 'DEF'
  if (/Winger|Forward|Striker/.test(pos)) return 'FWD'
  return 'MID'
}
const activity = (st: Stat) => st.tackles + st.dribbles
const ratePer90 = new Map<string, number>()
for (const line of ['DEF', 'MID', 'FWD']) {
  const rates = players
    .filter((p) => lineOf(p) === line && stats.has(p.ksiId) && p.log.reduce((a, l) => a + l.minutes, 0) >= 900)
    .map((p) => activity(stats.get(p.ksiId)!) / (p.log.reduce((a, l) => a + l.minutes, 0) / 90))
    .sort((a, b) => a - b)
  ratePer90.set(line, rates[Math.floor(rates.length / 2)])
}
function seen(p: Raw, st: Stat): number {
  const nineties = p.log.reduce((a, l) => a + l.minutes, 0) / 90
  const line = lineOf(p)
  if (line === 'GK') return nineties
  return Math.min(nineties, activity(st) / ratePer90.get(line)!)
}

const rows = players.filter((p) => (stats.get(p.ksiId)?.rating ?? 0) > 0)
  .map((p) => { const n = seen(p, stats.get(p.ksiId)!); return { id: p.ksiId, x: features(p), y: stats.get(p.ksiId)!.rating, w: n / (n + 2) } })
const beta = fit(rows)

const corr = (a: number[], b: number[]) => {
  const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0)
  return cov / Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0))
}
const held: { y: number; pred: number; w: number }[] = []
for (let f = 0; f < 10; f++) {
  const b = fit(rows.filter((_, i) => i % 10 !== f))
  rows.forEach((r, i) => { if (i % 10 === f) held.push({ y: r.y, pred: predict(b, r.x), w: r.w }) })
}
const established = held.filter((h) => h.w >= ESTABLISHED / (ESTABLISHED + 2))
const cv = { correlation: +corr(held.map((h) => h.y), held.map((h) => h.pred)).toFixed(3), establishedCorrelation: +corr(established.map((h) => h.y), established.map((h) => h.pred)).toFixed(3), players: held.length }

// ── quality and the FIFA scale ───────────────────────────────────────

const FIFA_POSITION: Record<string, string> = {
  'Goalkeeper': 'GK', 'Centre-Back': 'CB', 'Left-Back': 'LB', 'Right-Back': 'RB', 'Defensive Midfield': 'CDM',
  'Central Midfield': 'CM', 'Attacking Midfield': 'CAM', 'Left Midfield': 'LM', 'Right Midfield': 'RM',
  'Left Winger': 'LW', 'Right Winger': 'RW', 'Second Striker': 'CF', 'Centre-Forward': 'ST',
}
const BROAD: Record<string, string> = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'FWD' }

const rated = players.map((p) => {
  const mu = predict(beta, features(p))
  const st = stats.get(p.ksiId)
  const apps = p.log.length
  // how much his average rests on: the full matches the statistics saw
  const n = st && st.rating > 0 ? seen(p, st) : 0
  const q = n > 0 ? (PRIOR_MATCHES * mu + n * st!.rating) / (PRIOR_MATCHES + n) : mu
  const position = p.tm ? FIFA_POSITION[p.tm.position] ?? null : p.keeperStarts > 0 ? 'GK' : p.sofa?.position ? BROAD[p.sofa.position] : null
  return {
    id: p.ksiId,
    // the short name Transfermarkt uses, spelt as KSÍ spells it: Óskar Borgþórsson, not Borgthórsson
    name: p.tm ? respell(p.tm.name, p.ksiName, p.ksiName) : p.ksiName,
    team: p.team,
    position,
    nation: p.tm?.nations[0] ?? null,
    born: p.tm?.born ? +p.tm.born.slice(0, 4) : null,
    q,
    basis: (st && st.rating > 0 ? 'meðaleinkunn' : 'líkan') as 'meðaleinkunn' | 'líkan',
    apps,
    starts: p.log.filter((l) => l.start).length,
    minutes: p.log.reduce((a, l) => a + l.minutes, 0),
    goals: p.log.reduce((a, l) => a + l.goals, 0),
    assists: st?.assists ?? null,
    dribbles: st?.dribbles ?? null,
    tackles: st?.tackles ?? null,
    passPct: st && st.passPct > 0 ? st.passPct : null,
    average: st && st.rating > 0 ? st.rating : null,
  }
})

// the curve through the established players, and everyone placed on it by quality
const anchors = rated.filter((r) => r.apps >= ESTABLISHED).map((r) => r.q).sort((a, b) => b - a)
const onCurve = (i: number) => TOP - SPREAD * Math.pow(i / (anchors.length - 1), CURVE)
function scale(q: number): number {
  if (q >= anchors[0]) return TOP
  if (q <= anchors[anchors.length - 1]) return Math.max(FLOOR, onCurve(anchors.length - 1) - (anchors[anchors.length - 1] - q) * 30)
  let i = 0
  while (anchors[i + 1] > q) i++
  const t = (anchors[i] - q) / (anchors[i] - anchors[i + 1])
  return onCurve(i) + t * (onCurve(i + 1) - onCurve(i))
}

const ratings = rated
  .map(({ q, ...r }) => ({ ...r, rating: Math.max(FLOOR, Math.min(TOP, Math.round(scale(q)))) }))
  .sort((a, b) => b.rating - a.rating || b.minutes - a.minutes)

writeFileSync(join(webDir, 'src/lib/fifa/ratings.json'), JSON.stringify({
  season: data.season,
  updated: data.gathered,
  matches: data.matches,
  statistics: STATS_FILE,
  model: { weights: Object.fromEntries(NAMES.map((n, i) => [n, +beta[i].toFixed(3)])), crossValidation: cv },
  scale: { top: TOP, spread: SPREAD, curve: CURVE, established: ESTABLISHED, priorMatches: PRIOR_MATCHES },
  players: ratings,
}) + '\n')

console.log('ópöruð í tölfræði:', unmatched)
console.log('vægi:', Object.fromEntries(NAMES.map((n, i) => [n, +beta[i].toFixed(3)])))
console.log('krossprófun:', cv)
const tally = (lo: number, hi: number) => ratings.filter((r) => r.rating >= lo && r.rating <= hi).length
console.log(`${ratings.length} leikmenn: 90+ ${tally(90, 94)}, 80-89 ${tally(80, 89)}, 70-79 ${tally(70, 79)}, 60-69 ${tally(60, 69)}, <60 ${tally(0, 59)}`)
console.log(ratings.slice(0, 20).map((r) => `${r.rating} ${r.position ?? '-'} ${r.name} (${r.team}, ${r.apps} leikir, meðaleink. ${r.average ?? '-'})`).join('\n'))
