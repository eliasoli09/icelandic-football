import { isPlayed, type NflGame } from './types'

/** The pick'em game on /nfl/spa: points, the model as a player, the boards. Pure; the page feeds it. */

export type PickGame = Pick<NflGame, 'game_id' | 'season' | 'week' | 'game_type' | 'kickoff' | 'home' | 'away' | 'home_score' | 'away_score'>
export interface UserPick { player: string; game_id: string; pick: string }
export interface Tiebreak { player: string; season: number; week: number; total: number }
export interface BoardRow {
  id: string
  name: string
  points: number
  /** Picks in played games. */
  picks: number
  /** Distance from the tiebreak to the real total; null without one or before the last game is played. */
  tiebreakOff: number | null
  place: number
  model?: true
}

export const MODEL_ID = 'model'
export const MODEL_NAME = 'Líkanið'

/** 1 for the winner, ½ for a tie, 0 otherwise; null while the game is unplayed. */
export function pickPoints(pick: string, g: PickGame): number | null {
  if (!isPlayed(g)) return null
  if (g.home_score === g.away_score) return 0.5
  return pick === (g.home_score! > g.away_score! ? g.home : g.away) ? 1 : 0
}

/** The model picks the side it gave the better chance before kickoff; the home side on an even call. */
export function modelPicks(games: PickGame[], pHome: Map<string, number>): UserPick[] {
  return games.flatMap((g) => {
    const p = pHome.get(g.game_id)
    return p === undefined ? [] : [{ player: MODEL_ID, game_id: g.game_id, pick: p >= 0.5 ? g.home : g.away }]
  })
}

const byKickoff = (a: PickGame, b: PickGame) => a.kickoff.localeCompare(b.kickoff) || a.game_id.localeCompare(b.game_id)

/** The round's last game by kickoff: its total is the tiebreak. */
export function lastGameOf<T extends PickGame>(games: T[], season: number, week: number): T | null {
  const round = games.filter((g) => g.season === season && g.week === week).sort(byKickoff)
  return round[round.length - 1] ?? null
}

/** The round to pick in: the first with a game not yet started. */
export function pickWeek(games: PickGame[], now: Date): { season: number; week: number } | null {
  const next = games.filter((g) => !isPlayed(g) && new Date(g.kickoff) > now).sort(byKickoff)[0]
  return next ? { season: next.season, week: next.week } : null
}

function tally(games: PickGame[], picks: UserPick[]) {
  const byId = new Map(games.map((g) => [g.game_id, g]))
  const out = new Map<string, { points: number; picks: number }>()
  for (const p of picks) {
    const g = byId.get(p.game_id)
    if (!g) continue
    const t = out.get(p.player) ?? { points: 0, picks: 0 }
    const pts = pickPoints(p.pick, g)
    if (pts !== null) { t.points += pts; t.picks++ }
    out.set(p.player, t)
  }
  return out
}

/** Order by points, then tiebreak (closest first, none last), then name; equal on both share a place. */
function place(rows: Omit<BoardRow, 'place'>[]): BoardRow[] {
  const off = (r: Omit<BoardRow, 'place'>) => r.tiebreakOff ?? Infinity
  const sorted = [...rows].sort((a, b) => b.points - a.points || off(a) - off(b) || a.name.localeCompare(b.name, 'is'))
  return sorted.map((r, i) => {
    let first = i
    while (first > 0 && sorted[first - 1].points === r.points && off(sorted[first - 1]) === off(r)) first--
    return { ...r, place: first + 1 }
  })
}

function rows(tallies: Map<string, { points: number; picks: number }>, names: Map<string, string>, off: (id: string) => number | null): Omit<BoardRow, 'place'>[] {
  return [...tallies].map(([id, t]) => ({
    id,
    name: id === MODEL_ID ? MODEL_NAME : names.get(id) ?? 'Óþekkt(ur)',
    points: t.points,
    picks: t.picks,
    tiebreakOff: id === MODEL_ID ? null : off(id),
    ...(id === MODEL_ID ? { model: true as const } : {}),
  }))
}

export function weekBoard(games: PickGame[], picks: UserPick[], tiebreaks: Tiebreak[], names: Map<string, string>, season: number, week: number): BoardRow[] {
  const round = games.filter((g) => g.season === season && g.week === week)
  const last = lastGameOf(round, season, week)
  const total = last && isPlayed(last) ? last.home_score! + last.away_score! : null
  const guess = new Map(tiebreaks.filter((t) => t.season === season && t.week === week).map((t) => [t.player, t.total]))
  return place(rows(tally(round, picks), names, (id) => (total === null || !guess.has(id) ? null : Math.abs(guess.get(id)! - total))))
}

export function seasonBoard(games: PickGame[], picks: UserPick[], names: Map<string, string>, season: number): BoardRow[] {
  return place(rows(tally(games.filter((g) => g.season === season), picks), names, () => null))
}
