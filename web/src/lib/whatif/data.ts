import { db } from '../db'
import { standings } from '../queries'
import { splitGroups } from '../split'
import { CURRENT_SEASON } from '../recompute'
import type { WhatIfFixture, WhatIfTeam } from './simulate'

export interface WhatIfData {
  teams: (WhatIfTeam & { name: string; form: string })[]
  fixtures: (WhatIfFixture & { date: string | null; phase: string })[]
  /** the site's own numbers, for the line that says what the model thinks */
  baseline: { id: number; pTitle: number; pEurope: number; pRelegation: number; projPoints: number }[]
  season: number
}

/**
 * Everything the reader's browser needs to play the season out for itself: the
 * table as it stands, every match still to come with the model's expectation
 * for it, and which half of the split each club is in.
 */
export async function whatIfData(league = 'besta'): Promise<WhatIfData> {
  const [{ data: teamRows }, { data: matchRows }, table] = await Promise.all([
    db().from('teams').select('id, name'),
    db().from('matches').select('id, date, home_team, away_team, home_goals, phase')
      .eq('season', CURRENT_SEASON).eq('league', league),
    standings(CURRENT_SEASON, league as 'besta'),
  ])
  const names = new Map((teamRows ?? []).map((t) => [t.id as number, t.name as string]))
  const groups = splitGroups((matchRows ?? []) as { phase: string; home_team: number; away_team: number }[])
  const upcoming = (matchRows ?? []).filter((m) => m.home_goals === null && m.phase !== 'umspil')
  const { data: preds } = upcoming.length
    ? await db().from('predictions').select('match_id, lambda_home, lambda_away').in('match_id', upcoming.map((m) => m.id))
    : { data: [] }
  const lambdas = new Map((preds ?? []).map((p) => [p.match_id as number, p]))
  const { data: sim } = await db().from('season_sim')
    .select('team_id, p_title, p_europe, p_relegation, proj_points')
    .eq('season', CURRENT_SEASON).eq('league', league)

  return {
    season: CURRENT_SEASON,
    teams: table.map((row) => ({
      id: row.teamId,
      name: names.get(row.teamId) ?? String(row.teamId),
      points: row.points,
      gf: row.gf,
      ga: row.ga,
      played: row.played,
      form: row.form,
      group: groups?.get(row.teamId) ?? null,
    })),
    // a fixture with no stored prediction would be played on league averages,
    // so it is left out rather than quietly simulated on the wrong numbers
    fixtures: upcoming
      .filter((m) => lambdas.has(m.id))
      .map((m) => ({
        id: m.id,
        home: m.home_team,
        away: m.away_team,
        date: m.date,
        phase: m.phase,
        lambdaHome: lambdas.get(m.id)!.lambda_home as number,
        lambdaAway: lambdas.get(m.id)!.lambda_away as number,
      }))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    baseline: (sim ?? []).map((s) => ({
      id: s.team_id as number,
      pTitle: s.p_title as number,
      pEurope: s.p_europe as number,
      pRelegation: s.p_relegation as number,
      projPoints: s.proj_points as number,
    })),
  }
}
