import { franchiseOf, type EloRow } from './elo'
import type { WLT } from './standings'
import { isPlayed, type NflGame } from './types'

export interface TeamForm {
  /** Regular-season record before kickoff. */
  record: WLT
  /** Last five results, oldest first: S sigur, T tap, J jafntefli. */
  last5: ('S' | 'T' | 'J')[]
  /** Elo change over those five games; null before the first. */
  eloChange5: number | null
}

/** A club's form going into a game, from the season's games and its Elo rows. */
export function teamForm(abbr: string, kickoff: string, games: NflGame[], elo: Pick<EloRow, 'game_id' | 'team' | 'elo_before' | 'elo_after'>[]): TeamForm {
  const team = franchiseOf(abbr)
  const before = games
    .filter((g) => isPlayed(g) && g.kickoff < kickoff && (franchiseOf(g.home) === team || franchiseOf(g.away) === team))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const result = (g: NflGame) => {
    const own = franchiseOf(g.home) === team ? g.home_score! : g.away_score!
    const other = franchiseOf(g.home) === team ? g.away_score! : g.home_score!
    return own > other ? 'S' : own < other ? 'T' : 'J'
  }
  const record = { w: 0, l: 0, t: 0 }
  for (const g of before.filter((x) => x.game_type === 'REG')) {
    const r = result(g)
    if (r === 'S') record.w++; else if (r === 'T') record.l++; else record.t++
  }
  const five = before.slice(-5)
  const rows = new Map(elo.filter((r) => r.team === team).map((r) => [r.game_id, r]))
  const first = five.length ? rows.get(five[0].game_id) : undefined
  const last = five.length ? rows.get(five[five.length - 1].game_id) : undefined
  return {
    record,
    last5: five.map(result),
    eloChange5: first && last ? last.elo_after - first.elo_before : null,
  }
}
