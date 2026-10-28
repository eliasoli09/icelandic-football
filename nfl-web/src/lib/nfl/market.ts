import { offenceScore, type FantasyLine } from './stars'
import type { InjuryStatus } from './injuries'
import type { NflGame } from './types'

/**
 * Markaðurinn: what every fantasy offence player is worth, from our own stats.
 * Value = (expected points a game − the position's replacement) × games left,
 * in half-PPR points. See the vault, NFL/Markaðurinn.
 */

export type MarketPos = 'QB' | 'RB' | 'WR' | 'TE'
export const MARKET_POSITIONS: MarketPos[] = ['QB', 'RB', 'WR', 'TE']
export const isMarketPos = (p: string | null): p is MarketPos => p === 'QB' || p === 'RB' || p === 'WR' || p === 'TE'

/** The last starter in a 12-team league. */
export const REPLACEMENT: Record<MarketPos, number> = { QB: 12, RB: 30, WR: 36, TE: 12 }

export interface PosParams {
  /** Weight of a game last season against one this season. */
  prev: number
  /** Games' worth of `prior` in every projection. */
  k: number
  /** Points a game for a player we know nothing about. */
  prior: number
}
export type MarketParams = Record<MarketPos, PosParams>
const NAIVE: PosParams = { prev: 0, k: 0, prior: 0 }
/** Points a game so far this season, nothing else. */
export const MARKET_NAIVE: MarketParams = { QB: NAIVE, RB: NAIVE, WR: NAIVE, TE: NAIVE }
/** Chosen by scripts/nfl-market-backtest.mts (Task 3 replaces this line with its output). */
export const NFL_MARKET: MarketParams = MARKET_NAIVE

export interface Tally { games: number; total: number }

/** Expected points a game: this season and last (weighted `prev`), pulled towards `prior` by `k` games. */
export function projection(cur: Tally, prev: Tally, p: PosParams): number {
  const w = cur.games + p.prev * prev.games + p.k
  return w > 0 ? (cur.total + p.prev * prev.total + p.k * p.prior) / w : 0
}

type Sched = Pick<NflGame, 'season' | 'game_type' | 'week' | 'home' | 'away'>
/** Games an injury status takes off; Questionable takes none, Cut takes all. */
const OUT_GAMES: Partial<Record<InjuryStatus, number>> = { Out: 1, Doubtful: 1, IR: 4, PUP: 4, Reserve: 4 }

/** The club's regular-season games after `afterWeek`, less what the player's status keeps him out of. */
export function gamesLeft(team: string, season: number, afterWeek: number, games: Sched[], status: InjuryStatus | null = null): number {
  if (status === 'Cut') return 0
  const left = games.filter((g) => g.season === season && g.game_type === 'REG' && g.week > afterWeek && (g.home === team || g.away === team)).length
  return Math.max(0, left - (status ? OUT_GAMES[status] ?? 0 : 0))
}

export type MarketLine = FantasyLine & { player_id: string; week: number; team: string; game_id: string }
export interface MarketPlayer { player_id: string; position: string | null; team: string | null }
export interface MarketRow {
  player_id: string
  position: MarketPos
  team: string
  /** Games played this season up to the round. */
  games: number
  proj: number
  games_left: number
  value: number
  rank: number
  pos_rank: number
}
export interface MarketInput {
  season: number
  /** The completed round the snapshot is taken after. */
  week: number
  /** This season's regular-season lines (later rounds are ignored). */
  lines: MarketLine[]
  /** Last season's regular season, in fantasy points. */
  prev: Map<string, Tally>
  players: MarketPlayer[]
  games: Sched[]
  injuries: Map<string, InjuryStatus>
  params: MarketParams
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d

/**
 * One snapshot. A player counts if the register has him on a club and he
 * played this season or last; his schedule is the club he last played for
 * this season, else the register's.
 */
export function marketWeek(x: MarketInput): MarketRow[] {
  const cur = new Map<string, Tally & { team: string; week: number }>()
  for (const l of x.lines) {
    if (l.week > x.week) continue
    const t = cur.get(l.player_id) ?? { games: 0, total: 0, team: l.team, week: 0 }
    t.games++
    t.total += offenceScore(l)
    if (l.week >= t.week) { t.team = l.team; t.week = l.week }
    cur.set(l.player_id, t)
  }
  const cands: Omit<MarketRow, 'value' | 'rank' | 'pos_rank'>[] = []
  for (const p of x.players) {
    if (!isMarketPos(p.position) || !p.team) continue
    const c = cur.get(p.player_id)
    const pv = x.prev.get(p.player_id) ?? { games: 0, total: 0 }
    if (!c && pv.games === 0) continue
    const team = c?.team ?? p.team
    cands.push({
      player_id: p.player_id, position: p.position, team, games: c?.games ?? 0,
      proj: round(projection(c ?? { games: 0, total: 0 }, pv, x.params[p.position]), 2),
      games_left: gamesLeft(team, x.season, x.week, x.games, x.injuries.get(p.player_id) ?? null),
    })
  }
  const repl = {} as Record<MarketPos, number>
  for (const pos of MARKET_POSITIONS) {
    const ps = cands.filter((c) => c.position === pos).map((c) => c.proj).sort((a, b) => b - a)
    repl[pos] = ps.length ? ps[Math.min(REPLACEMENT[pos], ps.length) - 1] : 0
  }
  const rows: MarketRow[] = cands
    .map((c) => ({ ...c, value: round((c.proj - repl[c.position]) * c.games_left, 1), rank: 0, pos_rank: 0 }))
    .sort((a, b) => b.value - a.value || b.proj - a.proj || a.player_id.localeCompare(b.player_id))
  const n: Partial<Record<MarketPos, number>> = {}
  rows.forEach((r, i) => { r.rank = i + 1; r.pos_rank = n[r.position] = (n[r.position] ?? 0) + 1 })
  return rows
}

export interface TradeVerdict { a: number; b: number; fair: boolean; winner: 'a' | 'b' | null; margin: number }

/** Sum each side (a player below replacement adds nothing); fair within 10% of the bigger side. */
export function tradeVerdict(a: number[], b: number[]): TradeVerdict {
  const sum = (xs: number[]) => round(xs.reduce((t, v) => t + Math.max(v, 0), 0), 1)
  const [sa, sb] = [sum(a), sum(b)]
  const margin = round(Math.abs(sa - sb), 1)
  const fair = margin <= 0.1 * Math.max(sa, sb)
  return { a: sa, b: sb, fair, winner: fair ? null : sa > sb ? 'a' : 'b', margin }
}

export interface Move { player_id: string; rank: number; from: number; change: number }

/** Biggest climbs and drops between two snapshots, among the top `top` now, with at least `minGames` played. */
export function movers(now: Pick<MarketRow, 'player_id' | 'rank' | 'games'>[], before: Pick<MarketRow, 'player_id' | 'rank'>[], n = 5, top = 300, minGames = 0): { up: Move[]; down: Move[] } {
  const was = new Map(before.map((r) => [r.player_id, r.rank]))
  const moves = now
    .filter((r) => r.rank <= top && r.games >= minGames && was.has(r.player_id))
    .map((r) => ({ player_id: r.player_id, rank: r.rank, from: was.get(r.player_id)!, change: was.get(r.player_id)! - r.rank }))
  return {
    up: moves.filter((m) => m.change > 0).sort((a, b) => b.change - a.change || a.rank - b.rank).slice(0, n),
    down: moves.filter((m) => m.change < 0).sort((a, b) => a.change - b.change || a.rank - b.rank).slice(0, n),
  }
}
