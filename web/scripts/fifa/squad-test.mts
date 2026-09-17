/**
 * Does knowing who starts, and how those players rated in earlier seasons,
 * improve the Besta deild prediction? A walk-forward test on this season.
 *
 * Baseline: the site's own model, predictMatch() on Elo and the season's
 * scoring rates, both from matches already played.
 * With squads: the same, with the Elo gap moved by the difference in the
 * starting elevens' past quality. A starter's past quality is his SofaScore
 * average in 2025, 2024 and 2023 only (scripts/fifa/history), so nothing from
 * this season leaks in; the line-up itself is known an hour before kick-off.
 *
 * The weight is chosen on the first half of the season and measured on the
 * second half, with a paired 95% interval on the log loss per match.
 *
 * Usage: cd web && npx tsx scripts/fifa/squad-test.mts
 */
import { existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { db } = await import(join(webDir, 'src/lib/db.ts'))
const { runElo } = await import(join(webDir, 'src/lib/elo.ts'))
const { predictMatch } = await import(join(webDir, 'src/lib/predict.ts'))
const { parseKsiReport } = await import(join(webDir, 'scripts/xi/parse.ts'))
const { normalise } = await import(join(webDir, 'src/lib/topp10/normalise.ts'))

const SEASON = 2026

// ── every Besta and Lengjudeild match, for Elo ───────────────────────
type M = { id: number; season: number; date: string | null; league: 'besta' | 'lengjudeild'; home_team: number; away_team: number; home_goals: number; away_goals: number }
const all: M[] = []
for (const league of ['besta', 'lengjudeild'] as const) {
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('matches').select('id, season, date, league, home_team, away_team, home_goals, away_goals')
      .eq('league', league).eq('status', 'played').gte('season', 2010).order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    all.push(...(data as M[]))
    if (!data || data.length < 1000) break
  }
}
all.sort((a, b) => a.season - b.season || (a.date ?? '').localeCompare(b.date ?? '') || a.id - b.id)
const records = runElo(all.map((m, i) => ({ matchId: m.id, order: i, date: m.date, league: m.league, home: String(m.home_team), away: String(m.away_team), homeGoals: m.home_goals, awayGoals: m.away_goals })))
const before = new Map<string, number>()
for (const r of records) before.set(`${r.matchId}:${r.team}`, r.eloBefore)

// ── past quality of each player, from earlier seasons only ────────────
const WEIGHT: Record<number, number> = { 2025: 0.5, 2024: 0.3, 2023: 0.15 }
const past = new Map<string, { sum: number; w: number }>()
for (const year of [2025, 2024, 2023]) {
  const [head, ...lines] = readFileSync(join(here, 'history', `sofascore-${year}.csv`), 'utf-8').trim().split('\n').map((l) => l.split(';'))
  const col = (n: string) => head.indexOf(n)
  for (const c of lines) {
    const rating = Number(c[col('Sofascore-einkunn')])
    if (!(rating > 0)) continue
    const w = normalise(c[col('Leikmaður')]).split(' ')
    const key = `${w[0]} ${w[w.length - 1]}`
    const nineties = col('Mínútur') >= 0 ? Number(c[col('Mínútur')]) / 90 : 15
    const x = past.get(key) ?? { sum: 0, w: 0 }
    const weight = Math.min(nineties, 27) * WEIGHT[year]
    x.sum += weight * rating; x.w += weight
    past.set(key, x)
  }
}
/** A starter with no past season in the data: below the listed players, as a newcomer or a fringe player usually is. */
const UNKNOWN = 6.7
const quality = (name: string) => {
  const w = normalise(name).split(' ')
  const x = past.get(`${w[0]} ${w[w.length - 1]}`)
  return x && x.w > 0 ? { q: x.sum / x.w, known: true } : { q: UNKNOWN, known: false }
}

// ── this season's matches, in order ──────────────────────────────────
const season = all.filter((m) => m.season === SEASON && m.league === 'besta')
const cache = join(tmpdir(), 'fifa-cache')
const rows: { hQ: number; aQ: number; base: { eloHome: number; eloAway: number; home: unknown; away: unknown }; result: 0 | 1 | 2; known: number }[] = []
const played: M[] = []
const rate = (team: number) => {
  const g = played.filter((m) => m.home_team === team || m.away_team === team)
  if (!g.length) return null
  const gf = g.reduce((a, m) => a + (m.home_team === team ? m.home_goals : m.away_goals), 0)
  const ga = g.reduce((a, m) => a + (m.home_team === team ? m.away_goals : m.home_goals), 0)
  return { gfPerGame: gf / g.length, gaPerGame: ga / g.length, games: g.length, form: '' }
}
for (const m of season) {
  const file = join(cache, `www.ksi.is_leikir-og-urslit_felagslid_leikur_id_${m.id}_banner-tab_report`)
  if (!existsSync(file)) throw new Error(`KSÍ-skýrsla ${m.id} ekki í skyndiminni; keyrðu gather.mts`)
  const report = parseKsiReport(readFileSync(file, 'utf-8'))
  const side = (s: 'home' | 'away') => report.lineups[s].map((p: { name: string }) => quality(p.name))
  const h = side('home'), a = side('away')
  const mean = (xs: { q: number }[]) => xs.reduce((s, x) => s + x.q, 0) / xs.length
  rows.push({
    hQ: mean(h), aQ: mean(a),
    base: { eloHome: before.get(`${m.id}:${m.home_team}`)!, eloAway: before.get(`${m.id}:${m.away_team}`)!, home: rate(m.home_team), away: rate(m.away_team) },
    result: m.home_goals > m.away_goals ? 0 : m.home_goals === m.away_goals ? 1 : 2,
    known: [...h, ...a].filter((x) => x.known).length / 22,
  })
  played.push(m)
}

const loss = (r: typeof rows[number], beta: number) => {
  const p = predictMatch({ ...r.base, eloHome: r.base.eloHome + beta * 100 * (r.hQ - r.aQ) } as never)
  return -Math.log([p.pHome, p.pDraw, p.pAway][r.result])
}
const half = Math.floor(rows.length / 2)
const train = rows.slice(0, half), test = rows.slice(half)
let best = 0, bestLoss = Infinity
for (let beta = 0; beta <= 8; beta += 0.25) {
  const l = train.reduce((s, r) => s + loss(r, beta), 0) / train.length
  if (l < bestLoss) { bestLoss = l; best = beta }
}
const diffs = test.map((r) => loss(r, 0) - loss(r, best))
const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length
const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (diffs.length - 1))
const ci = 1.96 * sd / Math.sqrt(diffs.length)
const known = rows.reduce((a, r) => a + r.known, 0) / rows.length

console.log(`${rows.length} leikir; ${(known * 100).toFixed(0)}% byrjunarliðsmanna eiga fyrra tímabil`)
console.log(`vægi valið á fyrri helmingi (${train.length} leikir): ${best} (100·vægi Elo-stig á hverja 1,0 í meðaleinkunn byrjunarliðs)`)
console.log(`seinni helmingur (${test.length} leikir): log loss grunnur ${(test.reduce((s, r) => s + loss(r, 0), 0) / test.length).toFixed(4)}, með byrjunarliðum ${(test.reduce((s, r) => s + loss(r, best), 0) / test.length).toFixed(4)}`)
console.log(`ávinningur ${mean.toFixed(4)} ± ${ci.toFixed(4)} (95%)`)
