import { NextRequest, NextResponse } from 'next/server'
import { parsePlayerStats, parseTeamStats, planInterval, teamAbbr, type LivePlayer, type LiveTeamStats } from '@/lib/nfl/live'
import { STATS_BUDGET, STATS_FLOOR, gamesUnderWay, upstream } from '@/lib/nfl/liveFeed'

export const dynamic = 'force-dynamic'

/** One game's player lines and team stats, clubs as our abbreviations. */
export interface StatsGame { game_id: string; players: LivePlayer[]; teams: LiveTeamStats[] }
export interface StatsReply { enabled: boolean; interval: number; games: StatsGame[]; error?: string }

/**
 * Player and team stats for every game under way or just over: fantasy points,
 * bets on players and the red zone read these. Two requests a game a poll, on
 * their own share of the day's budget, so scores keep their pace.
 */
export async function GET(_req: NextRequest) {
  // localhost only: lines for the same two made-up games the scores mock shows
  if (process.env.NFL_LIVE_MOCK === '1' && process.env.NODE_ENV !== 'production') return NextResponse.json(await mock())
  const key = process.env.API_SPORTS_NFL_KEY
  let interval = STATS_FLOOR()
  if (!key) return NextResponse.json({ enabled: false, interval, games: [] } satisfies StatsReply)
  try {
    const { model, games } = await gamesUnderWay(key)
    if (!model) return NextResponse.json({ enabled: true, interval, games: [] } satisfies StatsReply)
    interval = planInterval(model.games.map((g) => g.kickoff), new Date(), STATS_BUDGET(), STATS_FLOOR(), 0, 2)
    const clubs = model.teams.filter((t) => t.franchise === t.abbr)
    const abbr = (name: string) => teamAbbr(name, clubs) ?? name
    const out = await Promise.all(games.filter((g) => g.live || g.final).map(async (g): Promise<StatsGame> => {
      const [p, t] = await Promise.all([
        upstream(`/games/statistics/players?id=${g.apiId}`, key, interval).then(parsePlayerStats).catch(() => []),
        upstream(`/games/statistics/teams?id=${g.apiId}`, key, interval).then(parseTeamStats).catch(() => []),
      ])
      return { game_id: g.game_id, players: p.map((x) => ({ ...x, team: abbr(x.team) })), teams: t.map((x) => ({ ...x, team: abbr(x.team) })) }
    }))
    return NextResponse.json({ enabled: true, interval, games: out } satisfies StatsReply)
  } catch (e) {
    return NextResponse.json({ enabled: true, interval, games: [], error: e instanceof Error ? e.message : String(e) } satisfies StatsReply)
  }
}

async function mock(): Promise<StatsReply> {
  const { db } = await import('@/lib/db')
  const { nflCurrentSeason, nflSeasonGames } = await import('@/lib/nfl/queries')
  const season = (await nflCurrentSeason())!
  const next = (await nflSeasonGames(season)).filter((g) => g.home_score === null).sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, 2)
  const games: StatsGame[] = []
  for (const g of next) {
    const { data } = await db().from('nfl_players').select('name, team, position').in('team', [g.home, g.away]).in('position', ['QB', 'RB', 'WR', 'TE', 'K']).order('player_id', { ascending: false }).limit(40)
    const players = (data ?? []).map((p, i): LivePlayer => {
      const k = (i * 37) % 11
      return {
        name: p.name, team: p.team, passYds: p.position === 'QB' ? 120 + k * 15 : 0, passTd: p.position === 'QB' ? k % 3 : 0, ints: p.position === 'QB' ? k % 2 : 0,
        rushYds: p.position === 'RB' ? 20 + k * 6 : p.position === 'QB' ? k : 0, rushTd: p.position === 'RB' ? k % 2 : 0,
        rec: ['WR', 'TE', 'RB'].includes(p.position) ? k % 7 : 0, recYds: ['WR', 'TE', 'RB'].includes(p.position) ? k * 9 : 0, recTd: ['WR', 'TE'].includes(p.position) ? (k % 4 === 0 ? 1 : 0) : 0,
        fumLost: 0, twoPt: 0, kPts: p.position === 'K' ? 4 + (k % 4) : 0,
      }
    })
    const teams: LiveTeamStats[] = [g.home, g.away].map((team, i) => ({ team, rzMade: 1 + i, rzAtt: 3, sacks: 2 + i, ints: i, fumRec: 0, safeties: 0, defTd: 0, pointsAgainst: i ? 17 : 10 }))
    games.push({ game_id: g.game_id, players, teams })
  }
  return { enabled: true, interval: 60, games }
}
