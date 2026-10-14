import models from './data/award-models.json'
import { candidates, logitProbs, type PlayerInfo } from './awardRace'
import type { Award } from './awards'
import { STATS, type Stat } from './players'

/**
 * What each award shows, decided on the 2015-2025 backtest (14 Oct 2026):
 * only the rookie awards beat "the leader wins" clearly and in both runs.
 * MVP, OPOY and DPOY show their leaders without odds; the comeback model
 * missed the winner from its pool too often to show anything but history.
 */
export const RACE_MODE: Record<Award, 'odds' | 'leaders' | 'history'> = {
  OROY: 'odds', DROY: 'odds', MVP: 'leaders', OPOY: 'leaders', DPOY: 'leaders', CPOY: 'history',
}

export const FIRST_RACE_WEEK = 4

type Model = { mean: number[]; sd: number[]; w: number[]; test: { hit: number; base: number } }
export const MODEL_TEST: Record<Award, { hit: number; base: number }> = Object.fromEntries(
  Object.entries(models as Record<string, Model>).map(([k, m]) => [k, { hit: m.test.hit, base: m.test.base }]),
) as Record<Award, { hit: number; base: number }>

export interface SeasonRow extends Record<Stat, number> {
  player_id: string
  team: string
  games: number
  position: string | null
  rookie_season: number | null
}

/** Odds for an award from current season totals; empty before week 4. */
export function raceOdds(award: Award, season: number, week: number, seasonWeeks: number, rows: SeasonRow[], team: Map<string, { games: number; pct: number }>): { player_id: string; p: number }[] {
  if (week < FIRST_RACE_WEEK) return []
  const m = (models as Record<string, Model>)[award]
  const info = new Map<string, PlayerInfo>(rows.map((r) => [r.player_id, { position: r.position, rookie_season: r.rookie_season }]))
  const totals = new Map(rows.map((r) => [r.player_id, { ...Object.fromEntries(STATS.map((k) => [k, r[k]])), games: r.games, team: r.team } as Record<Stat, number> & { games: number; team: string }]))
  const cands = candidates({ award, season, week, seasonWeeks, info, team }, totals)
  if (!cands.length) return []
  const p = logitProbs(cands.map((c) => c.x.map((v, k) => (v - m.mean[k]) / m.sd[k])), m.w)
  return cands.map((c, i) => ({ player_id: c.player_id, p: p[i] })).sort((a, b) => b.p - a.p)
}
