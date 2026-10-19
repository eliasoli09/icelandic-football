import { teamAbbr, type LiveEvent } from './live'

export type ScoreKind = 'TD' | 'FG'

/** One touchdown or field goal worth a banner. */
export interface ScoreMoment {
  key: string
  kind: ScoreKind
  game_id: string
  /** The club that scored, by our abbreviation. */
  team: string
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  quarter: string
  minute: string | null
  comment: string
}

interface GameEvents { game_id: string; home: string; away: string; events?: LiveEvent[] }

/** The same play keeps its key from poll to poll. */
export const eventKey = (gameId: string, e: LiveEvent) => [gameId, e.quarter, e.minute ?? '', e.type, e.homeScore ?? '', e.awayScore ?? ''].join('|')

/** Who scored: the feed's club name when it is one of the two, else whose score went up. */
export function scorer(e: LiveEvent, prev: LiveEvent | undefined, g: GameEvents, teams: { abbr: string; name: string }[]): string | null {
  const named = e.team ? teamAbbr(e.team, teams.filter((t) => t.abbr === g.home || t.abbr === g.away)) : null
  if (named) return named
  if (e.homeScore === null || e.awayScore === null) return null
  const dh = e.homeScore - (prev?.homeScore ?? 0), da = e.awayScore - (prev?.awayScore ?? 0)
  return dh > da ? g.home : da > dh ? g.away : null
}

/** Every touchdown and field goal in the games, oldest first within each game. */
export function scoringMoments(games: GameEvents[], teams: { abbr: string; name: string }[]): ScoreMoment[] {
  const out: ScoreMoment[] = []
  for (const g of games) {
    const evs = g.events ?? []
    let prev: LiveEvent | undefined
    for (const e of evs) {
      if (e.type === 'TD' || e.type === 'FG') {
        const team = scorer(e, prev, g, teams)
        if (team) out.push({ key: eventKey(g.game_id, e), kind: e.type, game_id: g.game_id, team, home: g.home, away: g.away, homeScore: e.homeScore, awayScore: e.awayScore, quarter: e.quarter, minute: e.minute, comment: e.comment })
      }
      if (e.homeScore !== null && e.awayScore !== null) prev = e
    }
  }
  return out
}

/**
 * The moments not seen before. The first look only takes note, so opening the
 * page mid-game does not replay the afternoon; after that each new play once.
 */
export function freshMoments(seen: Set<string> | null, moments: ScoreMoment[]): { fresh: ScoreMoment[]; seen: Set<string> } {
  const next = new Set(seen ?? [])
  const fresh = seen ? moments.filter((m) => !seen.has(m.key)) : []
  for (const m of moments) next.add(m.key)
  return { fresh, seen: next }
}
