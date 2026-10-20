import { NextRequest, NextResponse } from 'next/server'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { STATUS_LABEL, fractionLeft, liveWinProb, parseEvents, type LiveEvent } from '@/lib/nfl/live'
import { LIVE_FLOOR, gamesUnderWay, shared, upstream } from '@/lib/nfl/liveFeed'
import { nflCurrentSeason, nflSeasonModel } from '@/lib/nfl/queries'
import { db } from '@/lib/db'
import { wpRows } from '@/lib/nfl/winChart'

export const dynamic = 'force-dynamic'

export interface LiveRow {
  game_id: string
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  status: string
  statusLabel: string
  quarter: number | null
  clock: string | null
  live: boolean
  final: boolean
  /** Our live home win probability; the pre-game one before the first score is known. */
  pHome: number | null
  pHomePre: number | null
  /** Scoring plays, when events are on. */
  events?: LiveEvent[]
}
export interface LiveReply { enabled: boolean; interval: number; games: LiveRow[]; error?: string }

const EVENTS = () => process.env.NFL_LIVE_EVENTS !== '0'

/**
 * Live scores for the games under way by our schedule, matched to our game ids,
 * with our own live win probability. No key, nothing live, or a failing feed:
 * an empty list, and the pages simply show nothing live.
 */
export async function GET(_req: NextRequest) {
  // localhost only: NFL_LIVE_MOCK=1 shows two made-up live games, to see the boxes without a key or a game on
  if (process.env.NFL_LIVE_MOCK === '1' && process.env.NODE_ENV !== 'production') return NextResponse.json(await mock())
  const key = process.env.API_SPORTS_NFL_KEY
  let interval = LIVE_FLOOR()
  if (!key) return NextResponse.json({ enabled: false, interval, games: [] } satisfies LiveReply)
  try {
    const under = await gamesUnderWay(key)
    interval = under.interval
    const games: (LiveRow & { apiId: number })[] = under.games
    // scoring plays for every game under way each poll, so the day's use follows the schedule, not the readers
    let partial = false
    if (EVENTS()) await Promise.all(games.filter((g) => g.live || g.final).map(async (g) => {
      try { g.events = parseEvents(await upstream(`/games/events?id=${g.apiId}`, key, interval)) } catch { partial = true /* the score still shows */ }
    }))
    // keep the chance for the win-probability charts; with the CDN in front this runs about once per interval
    const rows = wpRows(games)
    if (rows.length && process.env.CRON_SECRET) {
      const { error } = await db().rpc('rpc_nfl_live_wp_add', { p_secret: process.env.CRON_SECRET, p_rows: rows })
      if (error) console.error('nfl_live_wp:', error.message)
    }
    return shared({ enabled: true, interval, games: games.map(({ apiId: _, ...g }) => g) } satisfies LiveReply, partial)
  } catch (e) {
    return shared({ enabled: true, interval, games: [], error: e instanceof Error ? e.message : String(e) } satisfies LiveReply)
  }
}

async function mock(): Promise<LiveReply> {
  const season = (await nflCurrentSeason())!
  const model = await nflSeasonModel(season)
  const forecasts = seasonForecasts(model.games, model.elo, model.state)
  const next = model.games.filter((g) => g.home_score === null).sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, 2)
  const plays: [number, number, number, string, string][] = [[3, 17, 10, '08:12', 'Q3'], [2, 7, 7, '01:45', 'Q2']]
  const games = next.map((g, i) => {
    const [quarter, h, a, clock, status] = plays[i]
    const f = forecasts[g.game_id]
    return {
      game_id: g.game_id, home: g.home, away: g.away, homeScore: h, awayScore: a, status, statusLabel: STATUS_LABEL[status], quarter, clock,
      live: true, final: false, pHome: liveWinProb(f?.spread ?? 0, h, a, fractionLeft(quarter, clock, status)), pHomePre: f?.pHome ?? null,
    }
  })
  const events: LiveEvent[] = [{ quarter: 'First', minute: '9:02', team: '', player: null, type: 'TD', comment: 'J.K. Dobbins 4 Yd Rush (Wil Lutz Kick)', homeScore: 7, awayScore: 0 }]
  return { enabled: true, interval: 30, games: games.map((g) => ({ ...g, events })) }
}
