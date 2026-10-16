import { isPlayed, type NflGame, type NflTeam } from './types'

export type Mark = 'division' | 'playoffs' | 'eliminated'

/**
 * Playoff marks that are proven, never guessed. Points = wins + half a tie;
 * "max" = points plus every remaining game won. A tie in the final table is
 * always counted against the club, so a mark may come a week after the NFL's
 * (which applies every tiebreaker) but is never wrong. Seven-team format.
 */
export function clinchMarks(games: NflGame[], teams: NflTeam[]): Record<string, Mark | null> {
  const pts = new Map(teams.map((t) => [t.abbr, 0]))
  const left = new Map(teams.map((t) => [t.abbr, 0]))
  for (const g of games) {
    if (g.game_type !== 'REG' || !pts.has(g.home) || !pts.has(g.away)) continue
    if (!isPlayed(g)) {
      left.set(g.home, left.get(g.home)! + 1)
      left.set(g.away, left.get(g.away)! + 1)
      continue
    }
    const h = g.home_score! > g.away_score! ? 1 : g.home_score! < g.away_score! ? 0 : 0.5
    pts.set(g.home, pts.get(g.home)! + h)
    pts.set(g.away, pts.get(g.away)! + 1 - h)
  }
  const now = (t: NflTeam) => pts.get(t.abbr)!
  const max = (t: NflTeam) => pts.get(t.abbr)! + left.get(t.abbr)!
  const divisions = (xs: NflTeam[]) => new Set(xs.map((t) => t.division)).size

  const out: Record<string, Mark | null> = {}
  for (const t of teams) {
    const conf = teams.filter((o) => o.conference === t.conference && o.abbr !== t.abbr)
    const rivals = conf.filter((o) => o.division === t.division)
    out[t.abbr] = null
    if (rivals.every((o) => max(o) < now(t))) {
      out[t.abbr] = 'division'
      continue
    }
    // worst case: every club that can still reach us finishes above, and each
    // division among them supplies its winner from them - the rest are wild cards
    const above = conf.filter((o) => max(o) >= now(t))
    if (above.length - divisions(above) <= 2) {
      out[t.abbr] = 'playoffs'
      continue
    }
    // already beyond reach: if one is in our division we cannot win it, and
    // three wild cards above us close the other door
    const beyond = conf.filter((o) => now(o) > max(t))
    if (beyond.some((o) => o.division === t.division) && beyond.length - divisions(beyond) >= 3) out[t.abbr] = 'eliminated'
  }
  return out
}
