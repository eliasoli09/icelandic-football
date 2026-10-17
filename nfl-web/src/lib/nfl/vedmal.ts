import { devig } from './odds'
import type { NflGame } from './types'

/** A European (decimal) price from an American moneyline. */
export const decimalOdds = (ml: number) => (ml < 0 ? 1 + 100 / -ml : 1 + ml / 100)

export type LegKind = 'win' | 'over' | 'under' | 'td' | 'yards'
export type YardStat = 'pass' | 'rush' | 'rec'

/**
 * One pick on a slip: the price, our chance and the bookmaker's chance without
 * its margin. Wins and totals carry the bookmaker's own price; player picks have
 * no bookmaker price in our data, so theirs is `estimated`: our chance with a
 * typical bookmaker margin on top, and `market` is our own chance.
 */
export interface Leg {
  kind: LegKind
  game_id: string; kickoff: string
  /** The side picked (win), the home side (totals), the player's club (player picks). */
  team: string; opp: string; home: boolean
  odds: number; p: number; market: number
  /** The total's line (over/under) or the yards line. */
  line?: number
  estimated?: boolean
  player?: { id: string; name: string; position: string | null; headshot: string | null }
  stat?: YardStat
}
export interface Slip { legs: Leg[]; odds: number; p: number; market: number; estimated: boolean }

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
  const base = { kind: 'win' as const, game_id: g.game_id, kickoff: g.kickoff }
  return [
    { ...base, team: g.home, opp: g.away, home: true, odds: decimalOdds(g.home_ml!), p, market: m.home },
    { ...base, team: g.away, opp: g.home, home: false, odds: decimalOdds(g.away_ml!), p: 1 - p, market: m.away },
  ]
}

/** Over and under the game's total at the bookmaker's prices; the chance is the margin-free market's (Vegas beat our own totals). */
export function totalLegs(g: Pick<NflGame, 'game_id' | 'home' | 'away' | 'kickoff' | 'total_line' | 'over_odds' | 'under_odds'>): Leg[] {
  const m = devig(g.over_odds ?? null, g.under_odds ?? null)
  if (!m || g.total_line === null) return []
  const base = { game_id: g.game_id, kickoff: g.kickoff, team: g.home, opp: g.away, home: true, line: g.total_line }
  return [
    { ...base, kind: 'over', odds: decimalOdds(g.over_odds!), p: m.home, market: m.home },
    { ...base, kind: 'under', odds: decimalOdds(g.under_odds!), p: m.away, market: m.away },
  ]
}

/**
 * Margins bookmakers typically build into player prices, used to estimate a
 * price we do not have: alternative yards lines carry about 8%, anytime
 * touchdown scorer markets about 20%.
 */
export const PROP_MARGIN = { yards: 0.08, td: 0.2 } as const
/** An estimated bookmaker price for a chance `p`: fair odds less the margin, never below 1.01. */
export const estimatedOdds = (p: number, margin: number) => Math.max(1.01, 1 / (p * (1 + margin)))

/**
 * Where a player's number lands against his projection: `q[i]` is the
 * (i+1)/(n+1) quantile of actual ÷ projected, from the backtest. The chance of
 * going over `line` reads it off by interpolation.
 */
export function probOver(line: number, proj: number, q: number[]): number {
  if (proj <= 0 || !q.length) return 0
  const r = line / proj, n = q.length
  if (r < q[0]) return 1 - (r / q[0]) * (1 / (n + 1))
  if (r >= q[n - 1]) return 1 / (n + 1) / 2
  let i = 0
  while (i < n - 1 && q[i + 1] <= r) i++
  const f = (i + 1 + (r - q[i]) / Math.max(1e-9, q[i + 1] - q[i])) / (n + 1)
  return Math.max(0, Math.min(1, 1 - f))
}

/** The lowest lines bookmakers' ladders usually offer (25+ rushing, 20+ receiving, 175+ passing yards). */
export const MIN_LINE: Record<YardStat, number> = { rush: 24.5, rec: 19.5, pass: 174.5 }

/** The highest x.5 line a player goes over with chance `p` or more. */
export function lineFor(p: number, proj: number, q: number[]): number | null {
  if (proj <= 0) return null
  let line = Math.floor(proj) + 0.5
  while (line > 0.5 && probOver(line, proj, q) < p) line -= 1
  return line > 0.5 && probOver(line, proj, q) >= p ? line : null
}

/**
 * The slip the model rates likeliest among those priced between `target` and
 * `target × SLIP_OVER`, at most one leg per game. Games are treated as
 * independent. A depth-first search over the games; a branch stops once its
 * price is over the ceiling, once it has reached the price, or once its chance
 * can no longer beat the best found: each leg raises the price and lowers the
 * chance, and no leg gives more than `kmax` chance-times-price. With
 * `needPlayer`, only slips with at least one player pick count.
 */
export const isPlayerLeg = (l: Leg) => l.kind === 'td' || l.kind === 'yards'

export function bestSlip(games: Leg[][], target: number, over = SLIP_OVER, minLegs = MIN_LEGS, maxLegs = MAX_LEGS, needPlayer = false): Slip | null {
  const hi = target * over
  let best: { legs: Leg[]; odds: number; p: number } | null = null
  const legs: Leg[] = []
  // no leg pays more than this per unit of chance (chance × price); with the margin in, it is under 1
  const kmax = Math.max(1e-9, ...games.flat().map((l) => l.p * l.odds))
  const go = (i: number, odds: number, p: number) => {
    if (best && p <= best.p) return
    const ok = !needPlayer || legs.some(isPlayerLeg)
    if (ok && legs.length >= minLegs && odds >= target && odds <= hi) best = { legs: [...legs], odds, p }
    if (i === games.length || legs.length === maxLegs) return
    // at the price already: more legs only lower the chance
    if (ok && odds >= target && legs.length >= minLegs) return
    // the rest must raise the price by target/odds, which costs at least that much chance (less kmax per leg)
    if (best && odds < target) {
      const k = kmax <= 1 ? kmax : kmax ** (maxLegs - legs.length)
      if (p * (odds / target) * k <= best.p) return
    }
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
  return { ...b, market: b.legs.reduce((m, l) => m * l.market, 1), estimated: b.legs.some((l) => l.estimated) }
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

/** The stats a player market reads from a game line. */
export interface StatLine {
  attempts: number; passing_yards: number; interceptions: number; sacks_taken: number
  carries: number; rushing_yards: number; targets: number; receptions: number; receiving_yards: number
  def_sacks: number; qb_hits: number; tackles_solo: number; tackle_assists: number
}

/**
 * A player market. `per` is the player's number in a game. `faced` is what the
 * opponent does about it: `against` sums the stat over everyone who played the
 * opponent (a defence's yards allowed), `own` sums `oppStat` over the opponent's
 * own players (an offence's sacks taken). A `chance` market shows P(one or more).
 */
export interface Market {
  key: 'pass' | 'rec' | 'catches' | 'sacks' | 'ints'
  title: string
  unit: string
  kind: 'number' | 'chance'
  per: (l: StatLine) => number
  faced: 'against' | 'own'
  oppStat: (l: StatLine) => number
  /** Who is listed: from the player's last game and his per-game averages so far. */
  eligible: (last: StatLine, avg: StatLine) => boolean
}

const tackles = (l: StatLine) => l.tackles_solo + l.tackle_assists + l.def_sacks + l.qb_hits
export const MARKETS: Market[] = [
  { key: 'pass', title: 'Sendingamestir', unit: 'spáðir sendingajardar', kind: 'number', per: (l) => l.passing_yards, faced: 'against', oppStat: (l) => l.passing_yards, eligible: (last) => last.attempts >= 15 },
  { key: 'rec', title: 'Gripmestir', unit: 'spáðir gripjardar', kind: 'number', per: (l) => l.receiving_yards, faced: 'against', oppStat: (l) => l.receiving_yards, eligible: (last, avg) => last.targets >= 1 && avg.targets >= 3 },
  { key: 'catches', title: 'Flest grip', unit: 'spáð grip', kind: 'number', per: (l) => l.receptions, faced: 'against', oppStat: (l) => l.receptions, eligible: (last, avg) => last.targets >= 1 && avg.targets >= 3 },
  { key: 'sacks', title: 'Líklegastir til að fella', unit: 'líkur á fellu', kind: 'chance', per: (l) => l.def_sacks, faced: 'own', oppStat: (l) => l.sacks_taken, eligible: (last, avg) => tackles(last) > 0 && avg.def_sacks + avg.qb_hits > 0 },
  { key: 'ints', title: 'Líklegastir til að kasta hlerun', unit: 'líkur á hlerun', kind: 'chance', per: (l) => l.interceptions, faced: 'against', oppStat: (l) => l.interceptions, eligible: (last) => last.attempts >= 15 },
]

export interface StatParams { prev: number; kDef: number; a: number; k: number; prior: number }

/**
 * A player's number in the coming game: his average (last season at weight
 * `prev`), pulled towards `prior` (a typical listed player) by `k` games, times
 * what the opponent concedes against the league (pulled by `kDef` games),
 * times the team factor to the power `a`.
 */
export function statProjection(cur: { games: number; total: number }, prev: { games: number; total: number }, opp: { total: number; games: number }, league: number, factor: number, P: StatParams): number {
  const g = cur.games + P.prev * prev.games
  if (g <= 0 || league <= 0) return 0
  const base = (cur.total + P.prev * prev.total + P.k * P.prior) / (g + P.k)
  const def = (opp.total + P.kDef * league) / (opp.games + P.kDef) / league
  return base * def * factor ** P.a
}
