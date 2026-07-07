import { db } from './db'
import { CURRENT_SEASON } from './recompute'
import {
  standings,
  seasonMatches,
  eloHistory,
  teamInfo,
  seasonSim,
  scorerSim,
  type MatchWithPrediction,
  type StandingRow,
} from './queries'
import type { League } from './types'
import type { TeamInfo } from './teamColors'

export interface DashboardTeam extends TeamInfo {
  id: number
}

export interface DashboardFixture {
  id: number
  date: string | null
  venue: string | null
  home: number
  away: number
  pHome: number | null
  pDraw: number | null
  pAway: number | null
}

export interface DashboardScorer {
  name: string
  teamId: number | null
  goals: number
  pWin: number | null
}

export interface DashboardBundle {
  league: League
  title: string
  tagline: string
  standings: (StandingRow & {
    zone: 'champ' | 'up' | 'playoff' | 'down' | null
  })[]
  zoneLegend: { cls: string; label: string }[]
  featured: DashboardFixture | null
  fixtures: DashboardFixture[]
  results: { id: number; home: number; away: number; hg: number; ag: number; date: string | null }[]
  form: { teamId: number; form: string; points5: number }[]
  elo: { teamId: number; elo: number; change: number }[]
  scorers: DashboardScorer[]
  keyStats: { label: string; value: string; sub: string }[]
  pTitle: Record<number, number>
}

const formPoints = (form: string) =>
  [...form].reduce((a, c) => a + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0)

async function leagueScorers(league: League): Promise<Map<string, { goals: number; teamId: number | null }>> {
  const { data } = await db()
    .from('match_events')
    .select('player_name, type, side, matches!inner(league, season, home_team, away_team)')
    .in('type', ['goal', 'penalty'])
    .eq('matches.league', league)
    .eq('matches.season', CURRENT_SEASON)
    .limit(3000)
  const out = new Map<string, { goals: number; teamId: number | null }>()
  for (const e of (data ?? []) as unknown as {
    player_name: string
    side: 'home' | 'away'
    matches: { home_team: number; away_team: number }
  }[]) {
    const teamId = e.side === 'home' ? e.matches.home_team : e.matches.away_team
    const cur = out.get(e.player_name) ?? { goals: 0, teamId }
    cur.goals++
    cur.teamId = teamId
    out.set(e.player_name, cur)
  }
  return out
}

export async function dashboardData(league: League): Promise<DashboardBundle> {
  const [table, matches, elo, sim, goalRace, scorerProbs] = await Promise.all([
    standings(CURRENT_SEASON, league),
    seasonMatches(CURRENT_SEASON),
    eloHistory(),
    seasonSim(league),
    leagueScorers(league),
    scorerSim('goals', league),
  ])

  const leagueMatches = matches.filter((m) => m.league === league)
  const played = leagueMatches.filter((m) => m.status === 'played' && m.home_goals !== null)
  const upcoming = leagueMatches
    .filter((m) => m.status === 'upcoming')
    .sort((a, b) => (a.date ?? '~').localeCompare(b.date ?? '~'))

  // predictions for the visible fixtures
  const fixtureIds = upcoming.slice(0, 6).map((m) => m.id)
  const { data: preds } = fixtureIds.length
    ? await db().from('predictions').select('match_id, p_home, p_draw, p_away').in('match_id', fixtureIds)
    : { data: [] }
  const predOf = new Map((preds ?? []).map((p) => [p.match_id, p]))
  const toFixture = (m: MatchWithPrediction): DashboardFixture => ({
    id: m.id,
    date: m.date,
    venue: m.venue,
    home: m.home_team,
    away: m.away_team,
    pHome: predOf.get(m.id)?.p_home ?? null,
    pDraw: predOf.get(m.id)?.p_draw ?? null,
    pAway: predOf.get(m.id)?.p_away ?? null,
  })

  // per-league Elo with last-5 change
  const teamIds = new Set(table.map((r) => r.teamId))
  const deltas = new Map<number, number[]>()
  const current = new Map<number, number>()
  for (const r of elo) {
    if (!teamIds.has(r.team_id)) continue
    const prev = current.get(r.team_id)
    if (prev !== undefined) {
      const list = deltas.get(r.team_id) ?? []
      list.push(r.elo_after - prev)
      deltas.set(r.team_id, list.slice(-5))
    }
    current.set(r.team_id, r.elo_after)
  }
  const eloRows = [...current]
    .map(([teamId, val]) => ({
      teamId,
      elo: Math.round(val),
      change: Math.round((deltas.get(teamId) ?? []).reduce((a, b) => a + b, 0)),
    }))
    .sort((a, b) => b.elo - a.elo)

  // zones
  const n = table.length
  const zones = table.map((r, i) => ({
    ...r,
    zone:
      league === 'besta'
        ? i === 0
          ? ('champ' as const)
          : i < 3
            ? ('up' as const)
            : i >= n - 2
              ? ('down' as const)
              : null
        : i < 2
          ? ('up' as const)
          : i < 4
            ? ('playoff' as const)
            : i >= n - 2
              ? ('down' as const)
              : null,
  }))
  const zoneLegend =
    league === 'besta'
      ? [
          { cls: 'zone-champ', label: 'Efsta sæti — Íslandsmeistarar' },
          { cls: 'zone-up', label: 'Evrópusæti (nálgun: 3 efstu)' },
          { cls: 'zone-down', label: 'Fallsæti' },
        ]
      : [
          { cls: 'zone-up', label: 'Beint upp í Bestu deildina' },
          { cls: 'zone-playoff', label: 'Umspilssæti' },
          { cls: 'zone-down', label: 'Fallsæti' },
        ]

  // scorers: live goals + (besta) title probability from scorer_sim
  const probOf = new Map(scorerProbs.map((s) => [s.name, s.p_win]))
  const scorers: DashboardScorer[] = [...goalRace]
    .sort((a, b) => b[1].goals - a[1].goals)
    .slice(0, 5)
    .map(([name, v]) => ({
      name,
      teamId: v.teamId,
      goals: v.goals,
      pWin: probOf.get(name) ?? null,
    }))

  // key stats
  const totalGoals = played.reduce((a, m) => a + m.home_goals! + m.away_goals!, 0)
  const homeWins = played.filter((m) => m.home_goals! > m.away_goals!).length
  const bothScored = played.filter((m) => m.home_goals! > 0 && m.away_goals! > 0).length
  const cleanSheets = played.filter((m) => m.home_goals === 0 || m.away_goals === 0).length
  const biggest = played.reduce((a, m) => Math.max(a, m.home_goals! + m.away_goals!), 0)
  const draws = played.filter((m) => m.home_goals === m.away_goals).length
  const pct = (x: number) => (played.length ? `${Math.round((x / played.length) * 100)}%` : '—')
  const keyStats = [
    { label: 'Mörk að meðaltali', value: played.length ? (totalGoals / played.length).toFixed(2) : '—', sub: 'í leik' },
    { label: 'Heimasigrar', value: pct(homeWins), sub: 'af leikjum' },
    { label: 'Bæði skora', value: pct(bothScored), sub: 'af leikjum' },
    { label: 'Markahæsti leikur', value: played.length ? String(biggest) : '—', sub: 'mörk alls' },
    { label: 'Hrein netta', value: pct(cleanSheets), sub: 'annað liðið á núlli' },
    { label: 'Jafntefli', value: pct(draws), sub: 'af leikjum' },
  ]

  return {
    league,
    title: league === 'besta' ? 'Besta deildin' : 'Lengjudeildin',
    tagline:
      league === 'besta'
        ? 'Staðan, form, spár og lykiltölur'
        : 'Baráttan um sæti í efstu deild',
    standings: zones,
    zoneLegend,
    featured: upcoming[0] ? toFixture(upcoming[0]) : null,
    fixtures: upcoming.slice(1, 5).map(toFixture),
    results: played
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .slice(0, 5)
      .map((m) => ({ id: m.id, home: m.home_team, away: m.away_team, hg: m.home_goals!, ag: m.away_goals!, date: m.date })),
    form: table
      .map((r) => ({ teamId: r.teamId, form: r.form, points5: formPoints(r.form) }))
      .sort((a, b) => b.points5 - a.points5)
      .slice(0, 6),
    elo: eloRows.slice(0, 6),
    scorers,
    keyStats,
    pTitle: Object.fromEntries(sim.map((s) => [s.team_id, s.p_title])),
  }
}

export async function allTeamInfo(): Promise<Record<number, DashboardTeam>> {
  const infos = await teamInfo()
  return Object.fromEntries(
    [...infos].map(([id, v]) => [id, { id, ...v }]),
  )
}
