import { parseGames } from './csv'
import { NFL_ELO, runElo, type EloRow, type QbAdj } from './elo'
import { GAMES_URL } from './ingest'
import { NFL_QB, fetchQbEpa, ratingAdjuster } from './qbElo'
import { isPlayed } from './types'

let cached: Promise<{ rows: EloRow[]; qb: Record<string, QbAdj> }> | null = null

/**
 * Local preview of a model change before the cron writes it: with
 * NFL_PREVIEW_ELO=1 in .env.local, pages replay every game with this code
 * instead of reading nfl_elo and nfl_game_qb. Never set in production.
 */
export function previewModel(): Promise<{ rows: EloRow[]; qb: Record<string, QbAdj> }> {
  cached ??= (async () => {
    const games = parseGames(await (await fetch(GAMES_URL)).text())
    const first = Math.min(...games.map((g) => g.season))
    const last = Math.max(...games.map((g) => g.season))
    const adjuster = ratingAdjuster(NFL_QB, await fetchQbEpa(Array.from({ length: last - first + 1 }, (_, i) => first + i)))
    const run = runElo(games, NFL_ELO, adjuster)
    const qb: Record<string, QbAdj> = Object.fromEntries(run.records.map((r) => [r.game_id, { home: r.adjHome, away: r.adjAway }]))
    for (const g of games) if (!isPlayed(g) && (g.home_qb_id || g.away_qb_id)) qb[g.game_id] = adjuster.before(g)
    return { rows: run.rows, qb }
  })()
  return cached
}
