/**
 * Are the simulated playoff chances honest? For every season 2002-2025, simulate
 * from the table after weeks 6, 10 and 14 with Elo as it stood then, and score
 * the playoff probability against what happened. Hot or cold is chosen on
 * 2002-2014 and only then scored on 2015-2025.
 * Usage: cd web && npx tsx scripts/nfl-sim-backtest.mts [sims]
 */
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { parseGames, parseTeams } = await import(join(webDir, 'src/lib/nfl/csv.ts'))
const { GAMES_URL, TEAMS_URL } = await import(join(webDir, 'src/lib/nfl/ingest.ts'))
const { runElo, NFL_ELO } = await import(join(webDir, 'src/lib/nfl/elo.ts'))
const { simulateSeason } = await import(join(webDir, 'src/lib/nfl/sim.ts'))

const SIMS = Number(process.argv[2] ?? 500)
const TUNE_TO = 2014
const all = parseGames(await (await fetch(GAMES_URL)).text()).filter((g: any) => g.season <= 2025)
const allTeams = parseTeams(await (await fetch(TEAMS_URL)).text())

type Pt = { season: number; week: number; p: number; y: number }
const points: Record<'hot' | 'cold', Pt[]> = { hot: [], cold: [] }
const t0 = Date.now()
for (let season = 2002; season <= 2025; season++) {
  const inSeason = all.filter((g: any) => g.season === season)
  const made = new Set(inSeason.filter((g: any) => g.game_type !== 'REG').flatMap((g: any) => [g.home, g.away]))
  const names = new Set(inSeason.flatMap((g: any) => [g.home, g.away]))
  const teams = allTeams.filter((t: any) => names.has(t.abbr))
  for (const week of [6, 10, 14]) {
    const masked = inSeason.map((g: any) => (g.game_type !== 'REG' || g.week > week ? { ...g, home_score: null, away_score: null } : g))
    const state = runElo([...all.filter((g: any) => g.season < season), ...masked], NFL_ELO).state
    for (const mode of ['hot', 'cold'] as const) {
      const sim = simulateSeason(masked, teams, state, { sims: SIMS, hot: mode === 'hot', seed: season * 100 + week })
      for (const t of teams) points[mode].push({ season, week, p: sim[t.abbr].p_playoffs, y: made.has(t.abbr) ? 1 : 0 })
    }
  }
}
console.log(`${SIMS} hermanir á stöðu, ${Math.round((Date.now() - t0) / 1000)} s`)

const brier = (xs: Pt[]) => xs.reduce((t, x) => t + (x.p - x.y) ** 2, 0) / xs.length
const base = (xs: Pt[]) => { const m = xs.reduce((t, x) => t + x.y, 0) / xs.length; return xs.reduce((t, x) => t + (m - x.y) ** 2, 0) / xs.length }
const slice = (xs: Pt[], a: number, b: number) => xs.filter((x) => x.season >= a && x.season <= b)

const tune = { hot: brier(slice(points.hot, 2002, TUNE_TO)), cold: brier(slice(points.cold, 2002, TUNE_TO)) }
const pick = tune.hot <= tune.cold ? 'hot' : 'cold'
console.log(`val á 2002-${TUNE_TO}: heit ${tune.hot.toFixed(4)}, köld ${tune.cold.toFixed(4)} -> ${pick === 'hot' ? 'HEIT' : 'KÖLD'}`)

const test = slice(points[pick], 2015, 2025)
console.log(`\nprófun 2015-2025 (${pick}), ${test.length} spár: Brier ${brier(test).toFixed(4)}, viðmið (alltaf meðaltalið) ${base(test).toFixed(4)}`)
for (const w of [6, 10, 14]) { const xs = test.filter((x) => x.week === w); console.log(`  eftir viku ${w}: Brier ${brier(xs).toFixed(4)}`) }
console.log('\nkvörðun (prófun): spáð -> raun')
for (let b = 0; b < 10; b++) {
  const xs = test.filter((x) => x.p >= b / 10 && (b === 9 ? x.p <= 1 : x.p < (b + 1) / 10))
  if (!xs.length) continue
  const p = xs.reduce((t, x) => t + x.p, 0) / xs.length
  const y = xs.reduce((t, x) => t + x.y, 0) / xs.length
  const se = Math.sqrt((y * (1 - y)) / xs.length)
  console.log(`  ${String(b * 10).padStart(2)}-${(b + 1) * 10}%: ${String(xs.length).padStart(4)} lið, spáð ${(100 * p).toFixed(1)}%, raun ${(100 * y).toFixed(1)}% (±${(196 * se).toFixed(1)})`)
}
