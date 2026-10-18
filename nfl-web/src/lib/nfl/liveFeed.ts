import { NextResponse } from 'next/server'
import { seasonForecasts } from './forecast'
import { API_SPORTS_BASE, NFL_LEAGUE, STATUS_LABEL, easternDate, fractionLeft, liveWindow, liveWinProb, parseGames, planInterval, teamAbbr } from './live'
import { nflCurrentSeason, nflSeasonModel, type SeasonModel } from './queries'

/** Requests a day for scores and scoring plays, and for player and team stats (Pro allows 7,500 together). */
export const LIVE_BUDGET = () => Number(process.env.NFL_LIVE_BUDGET) || 4500
export const STATS_BUDGET = () => Number(process.env.NFL_STATS_BUDGET) || 2500
/** The shortest gap worth polling at, for scores and for stats. */
export const LIVE_FLOOR = () => Number(process.env.NFL_LIVE_MIN_INTERVAL) || 15
export const STATS_FLOOR = () => Number(process.env.NFL_STATS_MIN_INTERVAL) || 60

/** The latest reply for each path in this instance, kept for the interval; a failure is kept too, so a rate limit is not hammered. */
const recent = new Map<string, { at: number; reply: Promise<unknown> }>()

export function upstream(path: string, key: string, interval: number): Promise<unknown> {
  const hit = recent.get(path)
  if (hit && Date.now() - hit.at < interval * 1000) return hit.reply
  const reply = fetchUpstream(path, key, interval)
  recent.set(path, { at: Date.now(), reply })
  reply.catch(() => { /* the callers handle it */ })
  return reply
}

async function fetchUpstream(path: string, key: string, interval: number): Promise<unknown> {
  // the data cache makes this one request per interval, however many readers poll
  const res = await fetch(`${API_SPORTS_BASE}${path}`, { headers: { 'x-apisports-key': key }, next: { revalidate: interval } })
  if (!res.ok) throw new Error(`api-sports svaraði ${res.status}`)
  const body = await res.json()
  const errors = body?.errors
  if (errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length)) throw new Error(`api-sports: ${JSON.stringify(errors)}`)
  return body
}

/** A live reply the CDN keeps for the polling interval, so readers share one function call (and its api-sports requests) per interval. */
export function shared<T extends { interval: number; error?: string }>(body: T): NextResponse<T> {
  const ttl = body.error ? LIVE_FLOOR() : body.interval
  return NextResponse.json(body, { headers: { 'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl}` } })
}

export interface FeedGame {
  apiId: number
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
  pHome: number | null
  pHomePre: number | null
}

/** Our games in their live window, matched to api-sports' scoreboard; `interval` is the scores' polling plan, which both routes share so the scoreboard is fetched once. */
export async function gamesUnderWay(key: string, now = new Date()): Promise<{ interval: number; model: SeasonModel | null; games: FeedGame[] }> {
  let interval = LIVE_FLOOR()
  const season = await nflCurrentSeason()
  if (!season) return { interval, model: null, games: [] }
  const model = await nflSeasonModel(season)
  // spread today's budget over today's games: about 45 s on a full Sunday, the floor on a quiet Thursday
  interval = planInterval(model.games.map((g) => g.kickoff), now, LIVE_BUDGET(), LIVE_FLOOR())
  const under = liveWindow(model.games, now)
  if (!under.length) return { interval, model, games: [] }
  const clubs = model.teams.filter((t) => t.franchise === t.abbr)
  const forecasts = seasonForecasts(model.games, model.elo, model.state)
  const dates = [...new Set(under.map((g) => easternDate(g.kickoff)))]
  const feed = (await Promise.all(dates.map((d) => upstream(`/games?league=${NFL_LEAGUE}&season=${season}&date=${d}&timezone=America/New_York`, key, interval)))).flatMap(parseGames)
  const games: FeedGame[] = []
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
  return { interval, model, games }
}
