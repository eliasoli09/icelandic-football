import type { MatchEvent, League } from './types'

export const PLAYER_BASE: Record<League, number> = { besta: 1500, lengjudeild: 1400 }
/** goals and results in the second tier move the needle less */
export const LEAGUE_WEIGHT: Record<League, number> = { besta: 1, lengjudeild: 0.6 }

export interface PlayerMatchInput {
  matchId: number
  order: number
  league: League
  homeGoals: number
  awayGoals: number
  events: MatchEvent[]
}

export interface PlayerEloRecord {
  playerKsiId: number
  playerName: string
  matchId: number
  league: League
  eloBefore: number
  eloAfter: number
}

/**
 * Event-observable player Elo. KSÍ exposes scorers, cards and substitutions
 * (not full lineups), so ratings cover players who appear in events.
 * Per appearance: team-result term + per-event terms, capped at ±60,
 * scaled by division weight (a Lengjudeild goal counts 60% of a Besta one).
 * Players first seen in Lengjudeildin start at a lower baseline and carry
 * their rating with them when promoted.
 */
export function runPlayerElo(matches: PlayerMatchInput[]): PlayerEloRecord[] {
  const rating = new Map<number, number>()
  const names = new Map<number, string>()
  const out: PlayerEloRecord[] = []
  const sorted = [...matches].sort((a, b) => a.order - b.order)

  for (const m of sorted) {
    const gd = m.homeGoals - m.awayGoals
    const perPlayer = new Map<number, number>()
    const seenSide = new Map<number, 'home' | 'away'>()

    for (const e of m.events) {
      if (!e.playerKsiId) continue
      names.set(e.playerKsiId, e.playerName)
      seenSide.set(e.playerKsiId, e.side)
      let d = perPlayer.get(e.playerKsiId) ?? 0
      switch (e.type) {
        case 'goal':
        case 'penalty':
          d += 25
          break
        case 'owngoal':
          d -= 15
          break
        case 'yellow':
          d -= 10
          break
        case 'red':
          d -= 30
          break
        case 'sub_in':
        case 'sub_out':
          d += 0 // appearance only
          break
      }
      perPlayer.set(e.playerKsiId, d)
    }

    for (const [pid, eventDelta] of perPlayer) {
      const side = seenSide.get(pid)!
      const result = side === 'home' ? Math.sign(gd) : -Math.sign(gd)
      const weight = LEAGUE_WEIGHT[m.league]
      const delta = clamp((eventDelta + 8 * result) * weight, -60, 60)
      const before = rating.get(pid) ?? PLAYER_BASE[m.league]
      const after = before + delta
      rating.set(pid, after)
      out.push({
        playerKsiId: pid,
        playerName: names.get(pid)!,
        matchId: m.matchId,
        league: m.league,
        eloBefore: before,
        eloAfter: after,
      })
    }
  }
  return out
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n))

export function currentPlayerRatings(records: PlayerEloRecord[]) {
  const cur = new Map<number, { name: string; elo: number; apps: number }>()
  for (const r of records) {
    const prev = cur.get(r.playerKsiId)
    cur.set(r.playerKsiId, {
      name: r.playerName,
      elo: r.eloAfter,
      apps: (prev?.apps ?? 0) + 1,
    })
  }
  return cur
}
