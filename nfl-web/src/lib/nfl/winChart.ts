import { fractionLeft } from './live'

/** One stored moment of a game: how far in, the score and our home win chance. */
export interface WpPoint { progress: number; p_home: number; home_score: number; away_score: number; status: string }

/** How far into regulation a game is, 0 at kickoff and 1 at the end (overtime stays just under 1). */
export const progressOf = (quarter: number | null, clock: string | null, status: string) => Math.min(1, Math.max(0, 1 - fractionLeft(quarter, clock, status)))

/** The rows the live feed stores each poll: games under way or just over, with a chance. */
export function wpRows(games: { game_id: string; quarter: number | null; clock: string | null; status: string; live: boolean; final: boolean; pHome: number | null; homeScore: number | null; awayScore: number | null }[]) {
  return games.filter((g) => (g.live || g.final) && g.pHome !== null).map((g) => ({
    game_id: g.game_id, progress: Math.round(progressOf(g.quarter, g.clock, g.status) * 1000) / 1000,
    home_score: g.homeScore ?? 0, away_score: g.awayScore ?? 0, status: g.status, p_home: Math.round(g.pHome! * 1000) / 1000,
  }))
}

/** How much the chance swung over the game: the sum of its moves, so a seesaw beats a blowout. */
export function excitement(points: { p_home: number }[]): number {
  let s = 0
  for (let i = 1; i < points.length; i++) s += Math.abs(points[i].p_home - points[i - 1].p_home)
  return s
}
