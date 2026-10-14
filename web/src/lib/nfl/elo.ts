import { FRANCHISE, isPlayed, type NflGame } from './types'

export interface EloParams { K: number; HFA: number; R: number; BYE: number }

/**
 * Chosen by scripts/nfl-backtest.mts on 2016-2025. Home advantage has shrunk
 * (best HFA 55 before 2017, 30-40 since); tuning on recent seasons scored no
 * worse out of sample on 2020-2025. See the vault, NFL/Líkanið.
 */
export const NFL_ELO: EloParams = { K: 20, HFA: 40, R: 0.4, BYE: 35 }
export const ELO_MEAN = 1505

export const franchiseOf = (abbr: string) => FRANCHISE[abbr] ?? abbr
export const winProb = (diff: number) => 1 / (1 + 10 ** (-diff / 400))
/** 25 Elo points is worth one point on the scoreboard (FiveThirtyEight's NFL scale). */
export const eloSpread = (diff: number) => diff / 25

/** Big wins count more, less so when the favourite was expected to win big. */
export function movMultiplier(margin: number, winnerDiff: number): number {
  if (margin === 0) return 1
  return (Math.log(Math.abs(margin) + 1) * 2.2) / (winnerDiff * 0.001 + 2.2)
}

export type EloGame = Pick<NflGame, 'game_id' | 'season' | 'game_type' | 'week' | 'kickoff' | 'home' | 'away' | 'home_score' | 'away_score' | 'neutral'>

export interface EloRow {
  game_id: string
  team: string
  season: number
  week: number
  elo_before: number
  elo_after: number
  /** What the model gave this club before kickoff. */
  p_win: number
}
export interface EloRecord { game_id: string; season: number; home: string; away: string; diff: number; pHome: number; margin: number }
export interface EloState { ratings: Map<string, number>; lastSeason: Map<string, number>; scheduled: Set<string>; params: EloParams }

const slot = (season: number, week: number, team: string) => `${season}:${week}:${team}`

/** Regular-season week after a week with no game for this club. */
function cameOffBye(state: EloState, g: EloGame, team: string): boolean {
  return g.game_type === 'REG' && g.week > 1 && !state.scheduled.has(slot(g.season, g.week - 1, team))
}

function rating(state: EloState, team: string, season: number, commit: boolean): number {
  let r = state.ratings.get(team) ?? ELO_MEAN
  const last = state.lastSeason.get(team)
  if (last !== undefined && last !== season) r = r * (1 - state.params.R) + ELO_MEAN * state.params.R
  if (commit) { state.ratings.set(team, r); state.lastSeason.set(team, season) }
  return r
}

function gameDiff(state: EloState, g: EloGame, eh: number, ea: number): number {
  const p = state.params
  const h = franchiseOf(g.home)
  const a = franchiseOf(g.away)
  return eh - ea + (g.neutral ? 0 : p.HFA) + (cameOffBye(state, g, h) ? p.BYE : 0) - (cameOffBye(state, g, a) ? p.BYE : 0)
}

/**
 * Fold every played game, oldest first. Unplayed games only feed the schedule
 * (bye weeks are read from it, so a future week sees the same byes as history).
 */
export function runElo(games: EloGame[], params: EloParams = NFL_ELO) {
  const state: EloState = { ratings: new Map(), lastSeason: new Map(), scheduled: new Set(), params }
  for (const g of games) if (g.game_type === 'REG') {
    state.scheduled.add(slot(g.season, g.week, franchiseOf(g.home)))
    state.scheduled.add(slot(g.season, g.week, franchiseOf(g.away)))
  }
  const played = games.filter(isPlayed).sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.game_id.localeCompare(b.game_id))
  const rows: EloRow[] = []
  const records: EloRecord[] = []
  for (const g of played) {
    const h = franchiseOf(g.home)
    const a = franchiseOf(g.away)
    const eh = rating(state, h, g.season, true)
    const ea = rating(state, a, g.season, true)
    const diff = gameDiff(state, g, eh, ea)
    const pHome = winProb(diff)
    const margin = g.home_score! - g.away_score!
    const s = margin > 0 ? 1 : margin < 0 ? 0 : 0.5
    const delta = params.K * movMultiplier(margin, margin > 0 ? diff : -diff) * (s - pHome)
    state.ratings.set(h, eh + delta)
    state.ratings.set(a, ea - delta)
    rows.push(
      { game_id: g.game_id, team: h, season: g.season, week: g.week, elo_before: eh, elo_after: eh + delta, p_win: pHome },
      { game_id: g.game_id, team: a, season: g.season, week: g.week, elo_before: ea, elo_after: ea - delta, p_win: 1 - pHome },
    )
    records.push({ game_id: g.game_id, season: g.season, home: h, away: a, diff, pHome, margin })
  }
  return { rows, records, state }
}

export interface GamePrediction { eloHome: number; eloAway: number; diff: number; pHome: number; spread: number }

/** Forecast an unplayed game from the latest ratings without changing them. */
export function predictGame(g: EloGame, state: EloState, params: EloParams = state.params): GamePrediction {
  const s = { ...state, params }
  const eloHome = rating(s, franchiseOf(g.home), g.season, false)
  const eloAway = rating(s, franchiseOf(g.away), g.season, false)
  const diff = gameDiff(s, g, eloHome, eloAway)
  return { eloHome, eloAway, diff, pHome: winProb(diff), spread: eloSpread(diff) }
}

/**
 * Rebuild the state from stored rows (latest per club) plus this season's
 * schedule, so a page can forecast without replaying 7,000 games.
 */
export function stateFromRows(rows: Pick<EloRow, 'team' | 'season' | 'week' | 'elo_after'>[], schedule: EloGame[], params: EloParams = NFL_ELO): EloState {
  const latest = new Map<string, Pick<EloRow, 'season' | 'week' | 'elo_after'>>()
  for (const r of rows) {
    const cur = latest.get(r.team)
    if (!cur || r.season > cur.season || (r.season === cur.season && r.week > cur.week)) latest.set(r.team, r)
  }
  const state: EloState = { ratings: new Map(), lastSeason: new Map(), scheduled: new Set(), params }
  for (const [team, r] of latest) { state.ratings.set(team, r.elo_after); state.lastSeason.set(team, r.season) }
  for (const g of schedule) if (g.game_type === 'REG') {
    state.scheduled.add(slot(g.season, g.week, franchiseOf(g.home)))
    state.scheduled.add(slot(g.season, g.week, franchiseOf(g.away)))
  }
  return state
}
