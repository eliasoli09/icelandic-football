import { NextRequest, NextResponse } from 'next/server'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { API_SPORTS_BASE, NFL_LEAGUE, STATUS_LABEL, easternDate, fractionLeft, liveWindow, liveWinProb, parseEvents, parseGames, teamAbbr, type LiveEvent } from '@/lib/nfl/live'
import { nflCurrentSeason, nflSeasonModel } from '@/lib/nfl/queries'

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
}
export interface LiveReply { enabled: boolean; interval: number; games: LiveRow[]; events?: LiveEvent[]; error?: string }

/** Seconds between requests to api-sports: the free plan's 100 a day last a long Sunday at 8 minutes. */
const INTERVAL = () => Math.max(30, Number(process.env.NFL_LIVE_INTERVAL) || 480)

async function upstream(path: string, key: string): Promise<unknown> {
  // the data cache makes this one request per interval, however many readers poll
  const res = await fetch(`${API_SPORTS_BASE}${path}`, { headers: { 'x-apisports-key': key }, next: { revalidate: INTERVAL() } })
  if (!res.ok) throw new Error(`api-sports svaraði ${res.status}`)
  const body = await res.json()
  const errors = body?.errors
  if (errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length)) throw new Error(`api-sports: ${JSON.stringify(errors)}`)
  return body
}

/**
 * Live scores for the games under way by our schedule, matched to our game ids,
 * with our own live win probability. No key, nothing live, or a failing feed:
 * an empty list, and the pages simply show nothing live.
 */
export async function GET(req: NextRequest) {
  // localhost only: NFL_LIVE_MOCK=1 shows two made-up live games, to see the boxes without a key or a game on
  if (process.env.NFL_LIVE_MOCK === '1' && process.env.NODE_ENV !== 'production') return NextResponse.json(await mock())
  const key = process.env.API_SPORTS_NFL_KEY
  const interval = INTERVAL()
  if (!key) return NextResponse.json({ enabled: false, interval, games: [] } satisfies LiveReply)
  try {
    const season = await nflCurrentSeason()
    if (!season) return NextResponse.json({ enabled: true, interval, games: [] } satisfies LiveReply)
    const model = await nflSeasonModel(season)
    const under = liveWindow(model.games, new Date())
    if (!under.length) return NextResponse.json({ enabled: true, interval, games: [] } satisfies LiveReply)

    const clubs = model.teams.filter((t) => t.franchise === t.abbr)
    const forecasts = seasonForecasts(model.games, model.elo, model.state)
    const dates = [...new Set(under.map((g) => easternDate(g.kickoff)))]
    const feed = (await Promise.all(dates.map((d) => upstream(`/games?league=${NFL_LEAGUE}&season=${season}&date=${d}&timezone=America/New_York`, key)))).flatMap(parseGames)

    const games: (LiveRow & { apiId: number })[] = []
    for (const g of under) {
      const hit = feed.find((x) => teamAbbr(x.home, clubs) === g.home && teamAbbr(x.away, clubs) === g.away)
      if (!hit) continue
      const f = forecasts[g.game_id]
      const scored = hit.homeScore !== null && hit.awayScore !== null
      const pHome = f && scored ? liveWinProb(f.spread ?? 0, hit.homeScore!, hit.awayScore!, fractionLeft(hit.quarter, hit.clock, hit.status)) : f?.pHome ?? null
      games.push({
        apiId: hit.apiId, game_id: g.game_id, home: g.home, away: g.away, homeScore: hit.homeScore, awayScore: hit.awayScore,
        status: hit.status, statusLabel: STATUS_LABEL[hit.status] ?? hit.status, quarter: hit.quarter, clock: hit.clock,
        live: hit.live, final: hit.final, pHome, pHomePre: f?.pHome ?? null,
      })
    }

    // scoring plays cost a request a game: only for the game page asking, and only when switched on
    const want = req.nextUrl.searchParams.get('game')
    let events: LiveEvent[] | undefined
    const one = want ? games.find((g) => g.game_id === want) : undefined
    if (one && process.env.NFL_LIVE_EVENTS === '1') events = parseEvents(await upstream(`/games/events?id=${one.apiId}`, key))

    return NextResponse.json({ enabled: true, interval, games: games.map(({ apiId: _, ...g }) => g), ...(events ? { events } : {}) } satisfies LiveReply)
  } catch (e) {
    return NextResponse.json({ enabled: true, interval, games: [], error: e instanceof Error ? e.message : String(e) } satisfies LiveReply)
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
  return { enabled: true, interval: 60, games, events: [{ quarter: 'Q1', minute: '09:02', team: '', player: null, type: 'TD', comment: 'Sýnidæmi: snertimark', homeScore: 7, awayScore: 0 }] }
}
