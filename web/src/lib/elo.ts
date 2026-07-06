import type { League } from './types'

export const BASE: Record<League, number> = { besta: 1500, lengjudeild: 1400 }
export const K = 24
export const HFA = 60 // home-field advantage in Elo points

export interface EloMatch {
  matchId: number
  order: number // chronological sort key (date-derived or insertion order)
  date: string | null
  league: League
  home: string
  away: string
  homeGoals: number
  awayGoals: number
}

export interface TeamEloRecord {
  team: string
  matchId: number
  date: string | null
  eloBefore: number
  eloAfter: number
}

export const expectedHome = (rHome: number, rAway: number) =>
  1 / (1 + 10 ** (-(rHome + HFA - rAway) / 400))

/** World Football Elo margin-of-victory multiplier: 1, 1.5, 1.75, then +1/8 per extra goal. */
export function movMultiplier(goalDiff: number) {
  const gd = Math.abs(goalDiff)
  if (gd <= 1) return 1
  if (gd === 2) return 1.5
  return 1.75 + (gd - 3) / 8
}

/**
 * Fold matches chronologically into Elo history records.
 * Teams enter at the baseline of the league they first appear in;
 * ratings persist across seasons and divisions (promotion/relegation).
 */
export function runElo(matches: EloMatch[]): TeamEloRecord[] {
  const rating = new Map<string, number>()
  const records: TeamEloRecord[] = []
  const sorted = [...matches].sort((a, b) => a.order - b.order)
  for (const m of sorted) {
    const rh = rating.get(m.home) ?? BASE[m.league]
    const ra = rating.get(m.away) ?? BASE[m.league]
    const eHome = expectedHome(rh, ra)
    const gd = m.homeGoals - m.awayGoals
    const score = gd > 0 ? 1 : gd < 0 ? 0 : 0.5
    const mult = movMultiplier(gd)
    const delta = K * mult * (score - eHome)
    const rhAfter = rh + delta
    const raAfter = ra - delta
    records.push(
      { team: m.home, matchId: m.matchId, date: m.date, eloBefore: rh, eloAfter: rhAfter },
      { team: m.away, matchId: m.matchId, date: m.date, eloBefore: ra, eloAfter: raAfter },
    )
    rating.set(m.home, rhAfter)
    rating.set(m.away, raAfter)
  }
  return records
}

export function currentRatings(records: TeamEloRecord[]): Map<string, number> {
  const cur = new Map<string, number>()
  for (const r of records) cur.set(r.team, r.eloAfter) // records are chronological
  return cur
}
