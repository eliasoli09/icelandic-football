import { isPlayed, type NflGame } from './types'

/**
 * A listed starter who did not start most of the club's last three games -
 * usually an injury, which the market prices and the Elo model cannot see.
 * Needs at least two games behind the club so week 1 never flags.
 */
export function qbChange(game: NflGame, side: 'home' | 'away', season: NflGame[]): { qb: string; usual: string } | null {
  const team = game[side]
  const qb = side === 'home' ? game.home_qb : game.away_qb
  if (!qb) return null
  const prior = season
    .filter((g) => isPlayed(g) && g.kickoff < game.kickoff && (g.home === team || g.away === team))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, 3)
  if (prior.length < 2) return null
  const starters = prior.map((g) => (g.home === team ? g.home_qb : g.away_qb)).filter((x): x is string => !!x)
  const count = new Map<string, number>()
  for (const s of starters) count.set(s, (count.get(s) ?? 0) + 1)
  // most starts wins; on a tie the most recent starter (first in the list) does
  const usual = starters.reduce<string | null>((best, s) => (best === null || count.get(s)! > count.get(best)! ? s : best), null)
  return usual && usual !== qb ? { qb, usual } : null
}
