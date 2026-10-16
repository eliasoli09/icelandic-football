/** A game whose results reach the board. */
export type GameId = 'tenaball' | 'hver' | 'byrjunarlid' | 'bikar'

export const GAME_LABEL: Record<GameId, string> = {
  tenaball: 'Tenaball',
  hver: 'Hver er maðurinn?',
  byrjunarlid: 'Byrjunarliðið',
  bikar: 'Bikarmeistari',
}

export interface Row {
  id: string
  name: string
  played: number
  won: number
  winPct: number
}

/** A run that is finished and can be recorded. */
export interface Result {
  game: GameId
  /** what was played, so the same puzzle cannot be counted twice */
  puzzle: string
  won: boolean
  detail?: Record<string, number | string | boolean>
}

/**
 * How few games a person may have played and still be ranked by percentage.
 * One win out of one is not a record, and without this the top of that board
 * is whoever played once and stopped.
 */
export const MIN_GAMES = 5

export type Sort = 'won' | 'pct'

/**
 * The board in order. By wins: most wins first, and between equals the better
 * percentage. By percentage: only those who have played enough, best first,
 * and between equals the one with more wins.
 */
export function rank(rows: Row[], sort: Sort): Row[] {
  const byWon = (a: Row, b: Row) => b.won - a.won || b.winPct - a.winPct || a.played - b.played || a.name.localeCompare(b.name, 'is')
  const byPct = (a: Row, b: Row) => b.winPct - a.winPct || b.won - a.won || a.name.localeCompare(b.name, 'is')
  return sort === 'pct'
    ? rows.filter((r) => r.played >= MIN_GAMES).sort(byPct)
    : [...rows].sort(byWon)
}

/** Whole per cent, and nothing at all before a game has been played. */
export const winPct = (won: number, played: number) => (played > 0 ? Math.round((100 * won) / played) : 0)

/** The name a person is known by on the board. */
export function nameProblem(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 2) return 'Nafnið þarf að vera minnst tveir stafir'
  if (name.length > 24) return 'Nafnið má mest vera 24 stafir'
  if (!/^[\p{Letter}\p{Number} ._-]+$/u.test(name)) return 'Nafnið má aðeins hafa bókstafi, tölur, bil, punkt, bandstrik eða undirstrik'
  return null
}
export const cleanName = (raw: string) => raw.trim().replace(/\s+/g, ' ')

/**
 * What was played, so a result lands on the board once and once only. Each
 * key names the puzzle itself, never the day it happened to be played, so
 * replaying yesterday's puzzle cannot add a second win.
 */
export const KEY = {
  tenaball: (questionId: string) => questionId,
  hver: (playerId: string, level: string) => `${level}:${playerId}`,
  byrjunarlid: (matchId: string, side: 'home' | 'away') => `${matchId}:${side}`,
  /** the cup is drawn anew every time, so one run a day counts in each mode */
  bikar: (mode: string, day: number) => `${mode}:${day}`,
}
