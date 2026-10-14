/**
 * The award races against "the leader in the main number wins". For every
 * season 2002-2025 and every week 4 to the end of the regular season, build
 * the candidates as they stood, labelled with the eventual AP winner.
 * The L2 penalty is chosen on 2002-2010 (validated 2011-2014); the model is
 * then fitted on 2002-2014 and scored on 2015-2025. An award goes on the site
 * only if it beats the baseline there. Finally the production model is
 * fitted on 2002-2025 and written to src/lib/nfl/data/award-models.json.
 * Usage: cd web && npx tsx scripts/nfl-award-backtest.mts
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { parseGames } = await import(join(webDir, 'src/lib/nfl/csv.ts'))
const { GAMES_URL } = await import(join(webDir, 'src/lib/nfl/ingest.ts'))
const { parsePlayerWeeks, parsePlayers } = await import(join(webDir, 'src/lib/nfl/players.ts'))
const { PLAYERS_URL, weeksUrl } = await import(join(webDir, 'src/lib/nfl/playerIngest.ts'))
const { AWARDS } = await import(join(webDir, 'src/lib/nfl/awards.ts'))
const race = await import(join(webDir, 'src/lib/nfl/awardRace.ts'))
const awards = JSON.parse(readFileSync(join(webDir, 'src/lib/nfl/data/nfl-awards.json'), 'utf-8'))

const cache = join(tmpdir(), 'nflverse-cache')
mkdirSync(cache, { recursive: true })
async function cached(url: string, name: string): Promise<string> {
  const f = join(cache, name)
  if (existsSync(f) && statSync(f).size > 0) return readFileSync(f, 'utf-8')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const t = await res.text()
  // write then rename, so a full disk can never leave a half-written cache file behind
  writeFileSync(`${f}.part`, t)
  renameSync(`${f}.part`, f)
  return t
}

const FIRST = 2002, TUNE_TO = 2010, VALID_TO = 2014, LAST = 2025
const games = parseGames(await cached(GAMES_URL, 'games.csv'))
const weeksBy = new Map<number, any[]>()
const seen = new Map()
for (let s = 1999; s <= LAST; s++) {
  const { weeks, seen: sn } = parsePlayerWeeks(await cached(weeksUrl(s), `week_${s}.csv`))
  weeksBy.set(s, weeks)
  for (const [k, v] of sn) seen.set(k, v)
}
const info = new Map(parsePlayers(await cached(PLAYERS_URL, 'players.csv'), seen).map((p: any) => [p.player_id, p]))
console.log(`gögn: ${seen.size} leikmenn, ${[...weeksBy.values()].reduce((t, w) => t + w.length, 0)} raðir`)

// earlier seasons per player, for the comeback award
const past = new Map<string, any[]>()
for (const [s, weeks] of weeksBy) {
  for (const [id, t] of race.totalsTo(weeks, 99)) {
    const off = t.passing_epa + t.rushing_epa + t.receiving_epa
    past.set(id, [...(past.get(id) ?? []), { season: s, games: t.games, off, def: race.defScore(t) }])
  }
}

function teamAsOf(season: number, week: number) {
  const m = new Map<string, { w: number; n: number }>()
  for (const g of games) {
    if (g.season !== season || g.game_type !== 'REG' || g.week > week || g.home_score === null) continue
    const h = g.home_score > g.away_score ? 1 : g.home_score === g.away_score ? 0.5 : 0
    for (const [t, r] of [[g.home, h], [g.away, 1 - h]] as const) { const x = m.get(t) ?? { w: 0, n: 0 }; m.set(t, { w: x.w + r, n: x.n + 1 }) }
  }
  return new Map([...m].map(([t, x]) => [t, { games: x.n, pct: x.n ? x.w / x.n : 0.5 }]))
}

type Snap = { season: number; week: number; last: boolean; cands: any[]; winners: number[] }
function snapshots(award: string): Snap[] {
  const out: Snap[] = []
  for (let season = FIRST; season <= LAST; season++) {
    const won = new Set(awards.filter((a: any) => a.season === season && a.award === award).map((a: any) => a.player_id))
    const seasonWeeks = Math.max(...games.filter((g: any) => g.season === season && g.game_type === 'REG').map((g: any) => g.week))
    for (let week = 4; week <= seasonWeeks; week++) {
      const totals = race.totalsTo(weeksBy.get(season)!, week)
      const cands = race.candidates({ award, season, week, seasonWeeks, info, team: teamAsOf(season, week), past }, totals)
      out.push({ season, week, last: week === seasonWeeks, cands, winners: cands.map((c: any, i: number) => (won.has(c.player_id) ? i : -1)).filter((i: number) => i >= 0) })
    }
  }
  return out
}

const report: Record<string, any> = {}
const models: Record<string, any> = {}
for (const award of AWARDS) {
  const snaps = snapshots(award)
  const inRange = (a: number, b: number) => snaps.filter((s) => s.season >= a && s.season <= b)
  const fit = (train: Snap[], l2: number) => {
    const rows = train.flatMap((s) => s.cands.map((c: any) => c.x))
    const st = race.standardize(rows)
    const groups = train.filter((s) => s.winners.length).map((s) => ({ x: s.cands.map((c: any) => st.apply(c.x)), winners: s.winners }))
    return { st, w: race.fitLogit(groups, l2) }
  }
  const score = (m: any, test: Snap[]) => test.map((s) => {
    const p = s.cands.length ? race.logitProbs(s.cands.map((c: any) => m.st.apply(c.x)), m.w) : []
    const pw = s.winners.reduce((t: number, i: number) => t + p[i], 0)
    const top = p.length ? p.indexOf(Math.max(...p)) : -1
    const lead = s.cands.length ? s.cands.reduce((b: number, c: any, i: number) => (c.main > s.cands[b].main ? i : b), 0) : -1
    return { week: s.week, last: s.last, ll: -Math.log(Math.max(pw, 1e-3)), hit: s.winners.includes(top), base: s.winners.includes(lead), covered: s.winners.length > 0 }
  })
  // choose the penalty on validation seasons only
  let best = { l2: 0, ll: Infinity }
  for (const l2 of [0.0003, 0.003, 0.03, 0.3]) {
    const r = score(fit(inRange(FIRST, TUNE_TO), l2), inRange(TUNE_TO + 1, VALID_TO))
    const ll = r.reduce((t, x) => t + x.ll, 0) / r.length
    if (ll < best.ll) best = { l2, ll }
  }
  const test = score(fit(inRange(FIRST, VALID_TO), best.l2), inRange(VALID_TO + 1, LAST))
  const at = (pred: (x: any) => boolean) => { const xs = test.filter(pred); return { n: xs.length, hit: xs.filter((x) => x.hit).length / xs.length, base: xs.filter((x) => x.base).length / xs.length, ll: xs.reduce((t, x) => t + x.ll, 0) / xs.length } }
  const byWeek = { 'vika 6': at((x) => x.week === 6), 'vika 10': at((x) => x.week === 10), 'vika 14': at((x) => x.week === 14), 'lok': at((x) => x.last) }
  const all = at(() => true)
  const passed = all.hit > all.base
  report[award] = { l2: best.l2, coverage: test.filter((x) => x.covered).length / test.length, byWeek, all, passed }
  const prod = fit(inRange(FIRST, LAST), best.l2)
  models[award] = { l2: best.l2, mean: prod.st.mean, sd: prod.st.sd, w: prod.w, passed, test: { hit: all.hit, base: all.base, byWeek } }

  console.log(`\n${award}  (L2 ${best.l2}, sigurvegari í hópnum ${(100 * report[award].coverage).toFixed(0)}%)  ${passed ? 'STENST' : 'STENST EKKI'}`)
  for (const [k, v] of Object.entries(byWeek) as any) console.log(`  ${k.padEnd(8)} efsti vann: líkan ${(100 * v.hit).toFixed(0)}%  viðmið ${(100 * v.base).toFixed(0)}%  log loss ${v.ll.toFixed(3)}  (${v.n})`)
  console.log(`  allar vikur: líkan ${(100 * all.hit).toFixed(1)}%  viðmið ${(100 * all.base).toFixed(1)}%`)
}
writeFileSync(join(webDir, 'src/lib/nfl/data/award-models.json'), JSON.stringify(models, null, 1) + '\n')
console.log('\nskrifað: src/lib/nfl/data/award-models.json')
