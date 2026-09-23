import { db } from './db'
import { LEAGUES } from './leagues'
import { predictMatch, type TeamSeasonRates } from './predict'
import { mulberry32, simulateSeason, type SeasonSimResult, type SimFixture, type SimTeamState } from './simulate'
import type { League } from './types'

/**
 * How much of a club's scoring rate is taken from expected goals rather than
 * the goals it actually scored. Measured over 462 forecasts of the 2026 season
 * across the eight foreign leagues, scoring each side's rate against the goals
 * it then scored: goals alone give RMSE 1.2733, expected goals alone 1.2463,
 * and the best blend sits flat between 60 and 90 per cent xG, lowest at 1.2429.
 * Seven tenths is that minimum, keeping some weight on real goals so a quirk in
 * one feed cannot carry a club on its own.
 */
export const XG_WEIGHT = 0.7

export interface PlayedMatch {
  home_team: number
  away_team: number
  home_goals: number | null
  away_goals: number | null
  home_xg: number | null
  away_xg: number | null
  date: string | null
}

/**
 * What each club has done so far, with expected goals standing in for most of
 * the scoring. A match with no xG of its own falls back to its goals, so a feed
 * that only sometimes carries xG still counts for something.
 */
export function ratesFrom(matches: PlayedMatch[], weight = XG_WEIGHT): Map<number, TeamSeasonRates> {
  const per = new Map<number, { gf: number; ga: number; games: number; res: string[] }>()
  const of = (team: number) => {
    if (!per.has(team)) per.set(team, { gf: 0, ga: 0, games: 0, res: [] })
    return per.get(team)!
  }
  const blend = (goals: number, xg: number | null) => (xg === null ? goals : weight * xg + (1 - weight) * goals)
  for (const m of [...matches].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
    if (m.home_goals === null || m.away_goals === null) continue
    const h = of(m.home_team), a = of(m.away_team)
    h.gf += blend(m.home_goals, m.home_xg); h.ga += blend(m.away_goals, m.away_xg)
    a.gf += blend(m.away_goals, m.away_xg); a.ga += blend(m.home_goals, m.home_xg)
    h.games++; a.games++
    const r = Math.sign(m.home_goals - m.away_goals)
    h.res.push(r > 0 ? 'W' : r < 0 ? 'L' : 'D')
    a.res.push(r < 0 ? 'W' : r > 0 ? 'L' : 'D')
  }
  const out = new Map<number, TeamSeasonRates>()
  for (const [team, s] of per) {
    out.set(team, {
      gfPerGame: s.gf / s.games,
      gaPerGame: s.ga / s.games,
      games: s.games,
      form: s.res.slice(-5).reverse().join(''),
    })
  }
  return out
}

/** The table as it stands, from results alone. */
export function tableFrom(matches: PlayedMatch[]) {
  const per = new Map<number, { points: number; gf: number; ga: number; played: number }>()
  const of = (team: number) => {
    if (!per.has(team)) per.set(team, { points: 0, gf: 0, ga: 0, played: 0 })
    return per.get(team)!
  }
  for (const m of matches) {
    if (m.home_goals === null || m.away_goals === null) continue
    const h = of(m.home_team), a = of(m.away_team)
    h.gf += m.home_goals; h.ga += m.away_goals; a.gf += m.away_goals; a.ga += m.home_goals
    h.played++; a.played++
    if (m.home_goals > m.away_goals) h.points += 3
    else if (m.home_goals < m.away_goals) a.points += 3
    else { h.points++; a.points++ }
  }
  return per
}


/**
 * A draw from Gamma(shape, 1), Marsaglia and Tsang, on a seeded generator so a
 * simulation can be repeated exactly.
 */
function gamma(shape: number, rand: () => number): number {
  if (shape < 1) return gamma(shape + 1, rand) * Math.pow(rand() || 1e-12, 1 / shape)
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x = 0, v = 0
    do {
      // Box-Muller, since the generator gives uniforms
      const u1 = rand() || 1e-12, u2 = rand()
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rand() || 1e-12
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

/**
 * Seven matches do not tell you a club's scoring rate, they suggest it. The
 * simulation treats the rate as known, which is fine in September at home
 * where everyone has played two dozen, and much too sure of itself abroad
 * where they have played seven: it had Barcelona at 98 per cent for the title
 * and a hundred points, off seven games.
 *
 * So the season is played out many times over, and each time the rates are
 * drawn afresh from what the goals so far actually support - Gamma, the
 * conjugate of the Poisson the match model already uses. A club with two dozen
 * games barely moves; a club with seven swings, which is the truth of it.
 */
export function simulateWithUncertainty(
  teams: SimTeamState[],
  remaining: SimFixture[],
  opts: Parameters<typeof simulateSeason>[4],
  draws = 40,
  runsPerDraw = 1000,
  seed = 20260706,
): SeasonSimResult[] {
  const rand = mulberry32(seed)
  const totals = new Map<string, { pos: number[]; points: number; low: number; high: number }>()
  for (const t of teams) totals.set(t.team, { pos: Array(teams.length).fill(0), points: 0, low: 0, high: 0 })
  for (let draw = 0; draw < draws; draw++) {
    const sampled = teams.map((t) => {
      if (!t.rates || t.rates.games <= 0) return t
      const { games, gfPerGame, gaPerGame } = t.rates
      // goals seen is the shape; more games, tighter the draw
      const scale = (perGame: number) => gamma(Math.max(0.5, perGame * games), rand) / games
      return { ...t, rates: { ...t.rates, gfPerGame: scale(gfPerGame), gaPerGame: scale(gaPerGame) } }
    })
    for (const row of simulateSeason(sampled, remaining, runsPerDraw, seed + draw * 7919, opts)) {
      const acc = totals.get(row.team)!
      row.posProbs.forEach((p, i) => { acc.pos[i] += p / draws })
      acc.points += row.projectedPoints / draws
      acc.low += row.pointsLow / draws
      acc.high += row.pointsHigh / draws
    }
  }
  const upSlots = opts?.upSlots ?? 3
  const downSlots = opts?.downSlots ?? 2
  return teams.map((t) => {
    const acc = totals.get(t.team)!
    return {
      team: t.team,
      posProbs: acc.pos,
      pTitle: acc.pos[0],
      pEurope: acc.pos.slice(0, upSlots).reduce((a, b) => a + b, 0),
      pRelegation: acc.pos.slice(acc.pos.length - downSlots).reduce((a, b) => a + b, 0),
      projectedPoints: acc.points,
      pointsLow: Math.round(acc.low),
      pointsHigh: Math.round(acc.high),
    }
  })
}

interface Row { [key: string]: unknown }

/**
 * Match predictions and a season simulation for every league outside Iceland.
 * They already had results, expected goals and Elo; what they lacked was the
 * model on top, so this is the same chain the Icelandic leagues get, told how
 * big each league is and how many it sends up and down.
 */
export async function leagueForecasts(
  season: number,
  ratingOf: (teamId: number) => number,
  leagues: League[],
): Promise<{ predictions: Row[]; sim: Row[]; report: Record<string, { matches: number; fixtures: number; teams: number }> }> {
  const predictions: Row[] = []
  const sim: Row[] = []
  const report: Record<string, { matches: number; fixtures: number; teams: number }> = {}
  if (!leagues.length) return { predictions, sim, report }

  const rows: (PlayedMatch & { id: number; league: string; status: string })[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('matches')
      .select('id, league, status, date, home_team, away_team, home_goals, away_goals, home_xg, away_xg')
      .eq('season', season).in('league', leagues)
      .order('date', { nullsFirst: true }).order('id')
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data as typeof rows))
    if (!data || data.length < 1000) break
  }

  const now = new Date().toISOString()
  for (const league of leagues) {
    const config = LEAGUES[league]
    const own = rows.filter((m) => m.league === league)
    const played = own.filter((m) => m.home_goals !== null)
    const upcoming = own.filter((m) => m.home_goals === null)
    if (!played.length) continue
    const rates = ratesFrom(played)
    const table = tableFrom(played)

    for (const m of upcoming) {
      const p = predictMatch({
        goals: config.goals,
        eloHome: ratingOf(m.home_team),
        eloAway: ratingOf(m.away_team),
        home: rates.get(m.home_team) ?? null,
        away: rates.get(m.away_team) ?? null,
      })
      predictions.push({
        match_id: m.id,
        p_home: p.pHome, p_draw: p.pDraw, p_away: p.pAway,
        lambda_home: p.lambdaHome, lambda_away: p.lambdaAway,
        factors: { ...p.factors, topScorelines: p.topScorelines, xgWeight: XG_WEIGHT },
        computed_at: now,
      })
    }

    // the simulation needs the whole league on the board; a table short of
    // clubs means the fixture list is incomplete and the odds would be wrong
    const teams: SimTeamState[] = [...table].map(([teamId, s]) => ({
      team: String(teamId),
      elo: ratingOf(teamId),
      rates: rates.get(teamId) ?? null,
      points: s.points, goalsFor: s.gf, goalsAgainst: s.ga, played: s.played,
    }))
    report[league] = { matches: played.length, fixtures: upcoming.length, teams: teams.length }
    if (config.size && teams.length !== config.size) continue

    const remaining: SimFixture[] = upcoming.map((m) => ({ home: String(m.home_team), away: String(m.away_team) }))
    const result = simulateWithUncertainty(teams, remaining, {
      goals: config.goals,
      split: false,
      upSlots: config.europeSlots,
      downSlots: config.relegationSlots,
    })
    sim.push(...result.map((r) => ({
      season, league, team_id: Number(r.team),
      pos_probs: r.posProbs, p_title: r.pTitle, p_europe: r.pEurope, p_relegation: r.pRelegation,
      proj_points: r.projectedPoints, proj_low: r.pointsLow, proj_high: r.pointsHigh,
      run_at: now,
    })))
  }
  return { predictions, sim, report }
}
