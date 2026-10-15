import { franchiseOf, type EloGame, type EloRecord, type GameAdjuster, type QbAdj } from './elo'
import type { NflGame } from './types'

/**
 * Two ways to tell Elo who started at quarterback, measured against each
 * other by scripts/nfl-qb-backtest.mts. See the vault, NFL/Líkanið.
 */

const sides = (g: EloGame) => [
  { side: 'home' as const, club: franchiseOf(g.home), qb: g.home_qb_id ?? null },
  { side: 'away' as const, club: franchiseOf(g.away), qb: g.away_qb_id ?? null },
]

/**
 * A: −P for a side whose starter is not the club's usual one: most starts of
 * its last three games, ties to the latest (as lib/nfl/qb.ts), across seasons.
 * Needs two games behind the club.
 */
export function changeAdjuster(P: number): GameAdjuster {
  const recent = new Map<string, string[]>()
  const usual = (club: string) => {
    const last = recent.get(club) ?? []
    if (last.length < 2) return null
    const count = new Map<string, number>()
    for (const s of last) count.set(s, (count.get(s) ?? 0) + 1)
    return last.reduce<string | null>((best, s) => (best === null || count.get(s)! > count.get(best)! ? s : best), null)
  }
  return {
    before(g) {
      const out: QbAdj = { home: 0, away: 0 }
      for (const { side, club, qb } of sides(g)) {
        const u = usual(club)
        if (qb && u && qb !== u) out[side] = -P
      }
      return out
    },
    after(g) {
      for (const { club, qb } of sides(g)) if (qb) recent.set(club, [qb, ...(recent.get(club) ?? [])].slice(0, 3))
    },
  }
}

export interface QbParams {
  /** Elo points per point of EPA between the starter and the club's usual level. */
  c: number
  /** Weight of a player's latest game. */
  a: number
  /** Weight of the latest starter's game in the club's usual level. */
  t: number
  /** Games' worth of `prior` in every player's rating. */
  n0: number
  /** EPA a game for a starter we know nothing about. */
  prior: number
}

/**
 * B with parameters chosen on 2016-2025 (scripts/nfl-qb-backtest.mts). Tested
 * on 2015-2025 with parameters from 2002-2014: log loss −0.0071 [−0.0113,
 * −0.0028] against Elo without it. Unknown starters rate at −6 EPA a game.
 */
export const NFL_QB: QbParams = { c: 15, a: 0.02, t: 0.02, n0: 2, prior: -6 }

/** Starter EPA (passing + rushing) of one game. */
export type QbEpa = Map<string, number>
export const epaKey = (qb: string, season: number, week: number, gameType: string) =>
  `${qb}:${season}:${week}:${gameType === 'REG' ? 'REG' : 'POST'}`

/**
 * B: c × (starter's rating − the club's usual level), both in EPA a game.
 * A player's rating is a decayed mean of his games shrunk towards `prior`;
 * the club's level is a decayed mean of its starters' games.
 */
export function ratingAdjuster(p: QbParams, epa: QbEpa): GameAdjuster & { player(id: string): number; team(club: string): number } {
  const players = new Map<string, { S: number; W: number }>()
  const teams = new Map<string, number>()
  const player = (id: string) => { const x = players.get(id); return x ? (x.S + p.n0 * p.prior) / (x.W + p.n0) : p.prior }
  const team = (club: string) => teams.get(club) ?? p.prior
  return {
    player,
    team,
    before(g) {
      const out: QbAdj = { home: 0, away: 0 }
      for (const { side, club, qb } of sides(g)) if (qb) out[side] = p.c * (player(qb) - team(club))
      return out
    },
    after(g) {
      for (const { club, qb } of sides(g)) {
        if (!qb) continue
        const v = epa.get(epaKey(qb, g.season, g.week, g.game_type))
        if (v === undefined) continue
        const x = players.get(qb) ?? { S: 0, W: 0 }
        players.set(qb, { S: x.S * (1 - p.a) + v, W: x.W * (1 - p.a) + 1 })
        teams.set(club, team(club) * (1 - p.t) + p.t * v)
      }
    },
  }
}

/**
 * EPA of every game a player threw a pass in, from nfl_player_weeks
 * (about 650 a season since 1999). Read a season at a time, in pages of 1,000.
 */
export async function fetchQbEpa(seasons: number[]): Promise<QbEpa> {
  const { db } = await import('../db')
  const out: QbEpa = new Map()
  await Promise.all(seasons.map(async (season) => {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db().from('nfl_player_weeks')
        .select('player_id, week, season_type, passing_epa, rushing_epa')
        .eq('season', season).gt('attempts', 0)
        .order('player_id').order('week').order('season_type').range(from, from + 999)
      if (error) throw new Error(`nfl_player_weeks ${season}: ${error.message}`)
      for (const r of data) out.set(epaKey(r.player_id, season, r.week, r.season_type), r.passing_epa + r.rushing_epa)
      if (data.length < 1000) break
    }
  }))
  return out
}

export interface GameQbRow { game_id: string; team: string; qb_id: string; qb: string | null; adj: number }

/**
 * One row per side with a listed starter: played games as the run saw them,
 * unplayed ones from the adjuster after the run (everything played so far).
 */
export function gameQbRows(games: (EloGame & Pick<NflGame, 'home_qb' | 'away_qb'>)[], records: EloRecord[], adjuster: GameAdjuster): GameQbRow[] {
  const ran = new Map(records.map((r) => [r.game_id, { home: r.adjHome, away: r.adjAway }]))
  const out: GameQbRow[] = []
  for (const g of games) {
    if (!g.home_qb_id && !g.away_qb_id) continue
    const adj = ran.get(g.game_id) ?? adjuster.before(g)
    if (g.home_qb_id) out.push({ game_id: g.game_id, team: g.home, qb_id: g.home_qb_id, qb: g.home_qb, adj: adj.home })
    if (g.away_qb_id) out.push({ game_id: g.game_id, team: g.away, qb_id: g.away_qb_id, qb: g.away_qb, adj: adj.away })
  }
  return out
}
