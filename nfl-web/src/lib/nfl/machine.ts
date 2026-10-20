/**
 * Umspilsvélin: the reader picks winners of the games left and sees the playoff
 * seeds and chances move. The picks become results; the rest is the same
 * simulation and tiebreakers the rest of the site uses.
 */
import type { EloParams, EloState } from './elo'
import { isPlayed, type NflGame } from './types'

export type Side = 'H' | 'A'
export type Picks = Record<string, Side>

/** EloState with its maps and set as plain JSON, to send to the browser. */
export interface PlainState { ratings: Record<string, number>; lastSeason: Record<string, number>; scheduled: string[]; params: EloParams }

export const toPlain = (s: EloState, season: number): PlainState => ({
  ratings: Object.fromEntries(s.ratings), lastSeason: Object.fromEntries(s.lastSeason),
  // only this season's slots matter for byes in the games left
  scheduled: [...s.scheduled].filter((x) => x.startsWith(`${season}:`)), params: s.params,
})
export const fromPlain = (p: PlainState): EloState => ({
  ratings: new Map(Object.entries(p.ratings)), lastSeason: new Map(Object.entries(p.lastSeason)), scheduled: new Set(p.scheduled), params: p.params,
})

/** The regular-season games still to play, in kickoff order: the ones a reader can pick. */
export const openGames = (games: NflGame[]) => games.filter((g) => g.game_type === 'REG' && !isPlayed(g)).sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.game_id.localeCompare(b.game_id))

/** The season with the picks as results (1-0), the rest as it stands. */
export function applyPicks(games: NflGame[], picks: Picks): NflGame[] {
  return games.map((g) => {
    const p = picks[g.game_id]
    if (!p || isPlayed(g)) return g
    return { ...g, home_score: p === 'H' ? 1 : 0, away_score: p === 'H' ? 0 : 1 }
  })
}

/** Every open game decided: the reader's pick where there is one, the model's favourite otherwise. */
export function fillWithFavourites(games: NflGame[], picks: Picks, pHome: (g: NflGame) => number | undefined): Picks {
  const out: Picks = { ...picks }
  for (const g of openGames(games)) if (!out[g.game_id]) out[g.game_id] = (pHome(g) ?? 0.5) >= 0.5 ? 'H' : 'A'
  return out
}

/** Picks as a short string for a link: one character per open game, "h", "a" or "-". */
export const encodePicks = (open: NflGame[], picks: Picks) => open.map((g) => (picks[g.game_id] === 'H' ? 'h' : picks[g.game_id] === 'A' ? 'a' : '-')).join('').replace(/-+$/, '')

export function decodePicks(open: NflGame[], code: string): Picks {
  const out: Picks = {}
  open.forEach((g, i) => { const c = code[i]; if (c === 'h') out[g.game_id] = 'H'; else if (c === 'a') out[g.game_id] = 'A' })
  return out
}
