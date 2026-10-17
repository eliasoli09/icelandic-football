import { devig } from './odds'
import type { NflGame } from './types'

/** A European (decimal) price from an American moneyline. */
export const decimalOdds = (ml: number) => (ml < 0 ? 1 + 100 / -ml : 1 + ml / 100)

/** One side of one game on a slip: the bookmaker's price, the model's chance and the bookmaker's chance without its margin. */
export interface Leg { game_id: string; team: string; opp: string; home: boolean; kickoff: string; odds: number; p: number; market: number }
export interface Slip { legs: Leg[]; odds: number; p: number; market: number }

export const SLIPS = [
  { key: 'double', name: 'Double Trouble', target: 2 },
  { key: 'sprengjan', name: 'Sprengjan', target: 3.5 },
  { key: 'bomban', name: 'Bomban', target: 5 },
] as const
/** A slip may land up to 15% above its price, with 2 to 8 games on it. */
export const SLIP_OVER = 1.15
export const MIN_LEGS = 2
export const MAX_LEGS = 8

/**
 * Both winners of a game as legs; none without a moneyline or a model chance.
 * A leg's chance is the model's at `weight`, the margin-free market's at the rest.
 */
export function gameLegs(g: Pick<NflGame, 'game_id' | 'home' | 'away' | 'kickoff' | 'home_ml' | 'away_ml'>, pHome: number | undefined, weight = 1): Leg[] {
  const m = devig(g.home_ml, g.away_ml)
  if (!m || pHome === undefined) return []
  const p = weight * pHome + (1 - weight) * m.home
  const base = { game_id: g.game_id, kickoff: g.kickoff }
  return [
    { ...base, team: g.home, opp: g.away, home: true, odds: decimalOdds(g.home_ml!), p, market: m.home },
    { ...base, team: g.away, opp: g.home, home: false, odds: decimalOdds(g.away_ml!), p: 1 - p, market: m.away },
  ]
}

/**
 * The slip the model rates likeliest among those priced between `target` and
 * `target × SLIP_OVER`, at most one leg per game. Games are treated as
 * independent. Every search over the games; a branch stops once its price is
 * over the ceiling or its chance can no longer beat the best found, since each
 * leg only raises the price and lowers the chance.
 */
export function bestSlip(games: Leg[][], target: number, over = SLIP_OVER, minLegs = MIN_LEGS, maxLegs = MAX_LEGS): Slip | null {
  const hi = target * over
  let best: { legs: Leg[]; odds: number; p: number } | null = null
  const legs: Leg[] = []
  const go = (i: number, odds: number, p: number) => {
    if (best && p <= best.p) return
    if (legs.length >= minLegs && odds >= target && odds <= hi) best = { legs: [...legs], odds, p }
    if (i === games.length || legs.length === maxLegs) return
    for (const leg of games[i]) {
      if (odds * leg.odds > hi) continue
      legs.push(leg)
      go(i + 1, odds * leg.odds, p * leg.p)
      legs.pop()
    }
    go(i + 1, odds, p)
  }
  go(0, 1, 1)
  if (!best) return null
  const b = best as { legs: Leg[]; odds: number; p: number }
  return { ...b, market: b.legs.reduce((m, l) => m * l.market, 1) }
}

/** Points the bookmaker expects from one side: half the total, plus or minus half the spread (nflverse: positive favours home). */
export function impliedPoints(g: Pick<NflGame, 'spread_line' | 'total_line'>, home: boolean): number | null {
  if (g.spread_line === null || g.total_line === null) return null
  return g.total_line / 2 + (home ? g.spread_line : -g.spread_line) / 2
}

/** Per-game usage and touchdowns (rushing + receiving) over some games. */
export interface Usage { games: number; carries: number; targets: number; tds: number; rushYards: number }
export const NO_USAGE: Usage = { games: 0, carries: 0, targets: 0, tds: 0, rushYards: 0 }

export interface TdParams { rCarry: number; rTarget: number; k: number; prev: number; kTeam: number }

/** This season plus last season at weight `w`. */
const blend = (cur: Usage, prev: Usage, w: number): Usage => ({
  games: cur.games + w * prev.games, carries: cur.carries + w * prev.carries, targets: cur.targets + w * prev.targets,
  tds: cur.tds + w * prev.tds, rushYards: cur.rushYards + w * prev.rushYards,
})

/**
 * Touchdowns a player scores a game: his own rate pulled towards what his
 * carries and targets would score for a typical player, by `k` games.
 */
export function tdRate(cur: Usage, prev: Usage, P: Pick<TdParams, 'rCarry' | 'rTarget' | 'k' | 'prev'>): number {
  const u = blend(cur, prev, P.prev)
  if (u.games <= 0) return 0
  const fromUse = (u.carries * P.rCarry + u.targets * P.rTarget) / u.games
  return (u.tds + P.k * fromUse) / (u.games + P.k)
}

/** How many points the bookmaker expects from a side against what it usually scores, pulled to the league by `k` games. */
export function teamFactor(implied: number | null, points: number, games: number, league: number, k: number): number {
  if (implied === null) return 1
  return implied / ((points + k * league) / (games + k))
}

/** Chance of one touchdown or more when `lambda` are expected. */
export const tdChance = (lambda: number) => 1 - Math.exp(-lambda)

export interface RushParams { prev: number; kDef: number }

/** Rushing yards a game: the player's average (last season at weight `prev`) times how much the opponent gives up against the league, pulled by `kDef` games. */
export function rushProjection(cur: Usage, prev: Usage, allowed: number, oppGames: number, league: number, P: RushParams): number {
  const u = blend(cur, prev, P.prev)
  if (u.games <= 0) return 0
  const def = (allowed + P.kDef * league) / (oppGames + P.kDef) / league
  return (u.rushYards / u.games) * def
}

/** A side's points from its scoring and the opponent's conceding, each pulled to the league by `k` games. */
export function sidePoints(scored: number, scoredGames: number, conceded: number, concededGames: number, league: number, k: number): number {
  const off = (scored + k * league) / (scoredGames + k)
  const def = (conceded + k * league) / (concededGames + k)
  return (off * def) / league
}
