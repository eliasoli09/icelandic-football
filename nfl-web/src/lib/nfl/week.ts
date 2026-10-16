import { isPlayed, type GameType, type NflGame } from './types'

/** A game without a score this long after kickoff is a data hole, not "this week". */
const STALE_MS = 18 * 3600 * 1000

const PLAYOFF_LABEL: Record<Exclude<GameType, 'REG'>, string> = {
  WC: 'Umspil',
  DIV: '8 liða úrslit',
  CON: 'Undanúrslit',
  SB: 'Super Bowl',
}

// Playoff week numbers moved when the season grew to 17 games, so name rounds by type.
export const weekLabel = (type: GameType, week: number) => (type === 'REG' ? `Vika ${week}` : PLAYOFF_LABEL[type])

export function weekTypes(games: Pick<NflGame, 'week' | 'game_type'>[]): [number, GameType][] {
  const m = new Map<number, GameType>()
  for (const g of games) m.set(g.week, g.game_type)
  return [...m.entries()].sort((a, b) => a[0] - b[0])
}

export function defaultWeek(games: Pick<NflGame, 'week' | 'kickoff' | 'home_score' | 'away_score'>[], now: Date): number {
  const cutoff = now.getTime() - STALE_MS
  const next = games
    .filter((g) => !isPlayed(g) && new Date(g.kickoff).getTime() >= cutoff)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0]
  if (next) return next.week
  const played = games.filter(isPlayed).map((g) => g.week)
  return played.length ? Math.max(...played) : 1
}
