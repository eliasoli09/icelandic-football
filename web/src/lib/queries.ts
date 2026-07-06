import { db } from './db'
import { CURRENT_SEASON } from './recompute'
import type { League } from './types'

export interface TeamInfo {
  id: number
  name: string
}

export async function teams(): Promise<Map<number, string>> {
  const { data } = await db().from('teams').select('id, name')
  return new Map((data ?? []).map((t) => [t.id, t.name]))
}

export interface MatchWithPrediction {
  id: number
  date: string | null
  venue: string | null
  league: League
  phase: string
  home_team: number
  away_team: number
  home_goals: number | null
  away_goals: number | null
  status: string
  prediction?: {
    p_home: number
    p_draw: number
    p_away: number
    factors: Record<string, unknown> | null
  } | null
}

export async function upcomingWithPredictions(
  limit = 12,
): Promise<MatchWithPrediction[]> {
  const { data } = await db()
    .from('matches')
    .select('id, date, venue, league, phase, home_team, away_team, home_goals, away_goals, status')
    .eq('season', CURRENT_SEASON)
    .eq('status', 'upcoming')
    .order('date', { ascending: true, nullsFirst: false })
    .limit(limit)
  const matches = (data ?? []) as MatchWithPrediction[]
  if (!matches.length) return []
  const { data: preds } = await db()
    .from('predictions')
    .select('match_id, p_home, p_draw, p_away, factors')
    .in('match_id', matches.map((m) => m.id))
  const byId = new Map((preds ?? []).map((p) => [p.match_id, p]))
  return matches.map((m) => ({ ...m, prediction: byId.get(m.id) ?? null }))
}

export async function recentResults(limit = 12): Promise<MatchWithPrediction[]> {
  const { data } = await db()
    .from('matches')
    .select('id, date, venue, league, phase, home_team, away_team, home_goals, away_goals, status')
    .eq('season', CURRENT_SEASON)
    .eq('status', 'played')
    .order('date', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as MatchWithPrediction[]
}

export async function seasonMatches(
  season = CURRENT_SEASON,
): Promise<MatchWithPrediction[]> {
  const { data } = await db()
    .from('matches')
    .select('id, date, venue, league, phase, home_team, away_team, home_goals, away_goals, status')
    .eq('season', season)
    .order('date', { ascending: true, nullsFirst: false })
  return (data ?? []) as MatchWithPrediction[]
}

export async function matchDetail(id: number) {
  const { data: match } = await db()
    .from('matches')
    .select('*')
    .eq('id', id)
    .single()
  if (!match) return null
  const { data: prediction } = await db()
    .from('predictions')
    .select('*')
    .eq('match_id', id)
    .maybeSingle()
  const { data: events } = await db()
    .from('match_events')
    .select('*')
    .eq('match_id', id)
    .order('minute')
  return { match, prediction, events: events ?? [] }
}

export interface EloRow {
  team_id: number
  date: string | null
  elo_after: number
  match_id: number
}

export async function eloHistory(): Promise<EloRow[]> {
  const out: EloRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await db()
      .from('team_elo')
      .select('team_id, date, elo_after, match_id')
      .order('match_id')
      .range(from, from + 999)
    if (!data?.length) break
    out.push(...(data as EloRow[]))
    if (data.length < 1000) break
  }
  return out
}

export interface StandingRow {
  teamId: number
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points: number
  form: string
}

/** Live standings for a season+league (split points carry over). */
export async function standings(
  season = CURRENT_SEASON,
  league: League = 'besta',
): Promise<StandingRow[]> {
  const { data } = await db()
    .from('matches')
    .select('home_team, away_team, home_goals, away_goals, date')
    .eq('season', season)
    .eq('league', league)
    .eq('status', 'played')
    .order('date', { ascending: true, nullsFirst: true })
  const per = new Map<number, StandingRow & { res: string[] }>()
  const row = (t: number) => {
    if (!per.has(t))
      per.set(t, {
        teamId: t, played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, points: 0, form: '', res: [],
      })
    return per.get(t)!
  }
  for (const m of data ?? []) {
    if (m.home_goals === null) continue
    const h = row(m.home_team)
    const a = row(m.away_team)
    h.played++; a.played++
    h.gf += m.home_goals; h.ga += m.away_goals
    a.gf += m.away_goals; a.ga += m.home_goals
    if (m.home_goals > m.away_goals) { h.won++; a.lost++; h.points += 3; h.res.push('W'); a.res.push('L') }
    else if (m.home_goals < m.away_goals) { a.won++; h.lost++; a.points += 3; a.res.push('W'); h.res.push('L') }
    else { h.drawn++; a.drawn++; h.points++; a.points++; h.res.push('D'); a.res.push('D') }
  }
  return [...per.values()]
    .map((r) => ({ ...r, form: r.res.slice(-5).reverse().join('') }))
    .sort((x, y) => y.points - x.points || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf)
}

export async function seasonSim() {
  const { data } = await db()
    .from('season_sim')
    .select('*')
    .eq('season', CURRENT_SEASON)
    .eq('league', 'besta')
  return data ?? []
}

export async function scorerSim(kind: 'goals' | 'assists') {
  const { data } = await db()
    .from('scorer_sim')
    .select('*')
    .eq('season', CURRENT_SEASON)
    .eq('kind', kind)
    .order('p_win', { ascending: false })
  return data ?? []
}

export async function playerEloTable(limit = 60) {
  const { data } = await db()
    .from('player_elo')
    .select('player_ksi_id, match_id, elo_after')
    .order('match_id')
  const latest = new Map<number, { elo: number; apps: number }>()
  for (const r of data ?? []) {
    const prev = latest.get(r.player_ksi_id)
    latest.set(r.player_ksi_id, {
      elo: r.elo_after,
      apps: (prev?.apps ?? 0) + 1,
    })
  }
  const { data: players } = await db().from('players').select('ksi_id, name')
  const names = new Map((players ?? []).map((p) => [p.ksi_id, p.name]))
  return [...latest]
    .map(([id, v]) => ({ id, name: names.get(id) ?? `#${id}`, ...v }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, limit)
}

export async function sofascorePlayers() {
  const { data } = await db()
    .from('sofascore_players')
    .select('name, team, rating, appearances, goals, assists, rank')
    .eq('season', CURRENT_SEASON)
    .order('rank')
  return data ?? []
}

export async function lastIngest() {
  const { data } = await db()
    .from('ingest_log')
    .select('run_at, new_matches, new_events, warnings')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}
