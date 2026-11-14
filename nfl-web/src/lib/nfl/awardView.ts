import models from './data/award-models.json'
import { candidates, logitProbs, type PastSeason, type PlayerInfo } from './awardRace'
import type { Award } from './awards'
import { STATS, type Stat } from './players'

/**
 * Every award shows odds since 14 Nov 2026 (Elias asked for percentages on all
 * of them). The 2015-2025 backtest still decides how they are framed: MVP,
 * OPOY and DPOY barely beat "the leader wins" and the comeback model is weak,
 * so the page prints each award's test hit rate next to its odds. The shown
 * odds are scaled by how often the winner was in the candidate pool at all,
 * so the weak awards cannot claim certainty they never had.
 */
export const RACE_MODE: Record<Award, 'odds' | 'leaders' | 'history'> = {
  OROY: 'odds', DROY: 'odds', MVP: 'odds', OPOY: 'odds', DPOY: 'odds', CPOY: 'odds',
}

export const FIRST_RACE_WEEK = 4

type Model = { mean: number[]; sd: number[]; w: number[]; coverage?: number; test: { hit: number; base: number } }
export const MODEL_TEST: Record<Award, { hit: number; base: number }> = Object.fromEntries(
  Object.entries(models as Record<string, Model>).map(([k, m]) => [k, { hit: m.test.hit, base: m.test.base }]),
) as Record<Award, { hit: number; base: number }>

/** Share of seasons where the eventual winner was among the candidates (test seasons); 1 if not measured. */
export const MODEL_COVERAGE: Record<Award, number> = Object.fromEntries(
  Object.entries(models as Record<string, Model>).map(([k, m]) => [k, m.coverage ?? 1]),
) as Record<Award, number>

export interface SeasonRow extends Record<Stat, number> {
  player_id: string
  team: string
  games: number
  position: string | null
  rookie_season: number | null
}

/** Odds for an award from current season totals; empty before week 4. They sum to the award's coverage, the rest is "someone else". */
export function raceOdds(award: Award, season: number, week: number, seasonWeeks: number, rows: SeasonRow[], team: Map<string, { games: number; pct: number }>, past?: Map<string, PastSeason[]>): { player_id: string; p: number }[] {
  if (week < FIRST_RACE_WEEK) return []
  const m = (models as Record<string, Model>)[award]
  const info = new Map<string, PlayerInfo>(rows.map((r) => [r.player_id, { position: r.position, rookie_season: r.rookie_season }]))
  const totals = new Map(rows.map((r) => [r.player_id, { ...Object.fromEntries(STATS.map((k) => [k, r[k]])), games: r.games, team: r.team } as Record<Stat, number> & { games: number; team: string }]))
  const cands = candidates({ award, season, week, seasonWeeks, info, team, past }, totals)
  if (!cands.length) return []
  const p = logitProbs(cands.map((c) => c.x.map((v, k) => (v - m.mean[k]) / m.sd[k])), m.w)
  return cands.map((c, i) => ({ player_id: c.player_id, p: p[i] * MODEL_COVERAGE[award] })).sort((a, b) => b.p - a.p)
}
