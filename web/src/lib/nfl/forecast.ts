import { franchiseOf, predictGame, type EloRow, type EloState } from './elo'
import { qbChange } from './qb'
import { isPlayed, type NflGame } from './types'

export interface Forecast {
  /** Home win probability: before kickoff for a played game, from today's ratings otherwise. */
  pHome: number
  /** Predicted home margin in points; only for unplayed games. */
  spread: number | null
  played: boolean
  newQb: { home: { qb: string; usual: string } | null; away: { qb: string; usual: string } | null } | null
}

/** One forecast per game of the season, keyed by game_id. A played game without an Elo row is left out. */
export function seasonForecasts(games: NflGame[], elo: Pick<EloRow, 'game_id' | 'team' | 'p_win'>[], state: EloState): Record<string, Forecast> {
  const before = new Map(elo.map((r) => [`${r.game_id}:${r.team}`, r.p_win]))
  const out: Record<string, Forecast> = {}
  for (const g of games) {
    if (isPlayed(g)) {
      const p = before.get(`${g.game_id}:${franchiseOf(g.home)}`)
      if (p !== undefined) out[g.game_id] = { pHome: p, spread: null, played: true, newQb: null }
      continue
    }
    const f = predictGame(g, state)
    const home = qbChange(g, 'home', games)
    const away = qbChange(g, 'away', games)
    out[g.game_id] = { pHome: f.pHome, spread: f.spread, played: false, newQb: home || away ? { home, away } : null }
  }
  return out
}
