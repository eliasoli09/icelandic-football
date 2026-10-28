import { franchiseOf } from './elo'
import { enoughForWeek, offenceScore, type FantasyLine } from './stars'
import type { InjuryStatus } from './injuries'
import { isPlayed, type NflGame } from './types'

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
/**
 * Chosen by scripts/nfl-market-backtest.mts on 2016-2021, tested on 2022-2025:
 * MAE 2.308 against 2.595 over all samples; mean difference per player-season -0.2583
 * [-0.3264, -0.1902] over 1,895 player-seasons (QB alone -0.275 [-0.709, 0.159]).
 * Measured on rounds 3-14 for players with a game this season.
 */
export const NFL_MARKET: MarketParams = {
  QB: { prev: 0.5, k: 3, prior: 12 },
  RB: { prev: 0.25, k: 1, prior: 4 },
  WR: { prev: 0.25, k: 1, prior: 2 },
  TE: { prev: 0.25, k: 2, prior: 2 },
}

export interface Tally { games: number; total: number }

/** Expected points a game: this season and last (weighted `prev`), pulled towards `prior` by `k` games; with no weight at all, last season's average (0 if none). */
export function projection(cur: Tally, prev: Tally, p: PosParams): number {
  const w = cur.games + p.prev * prev.games + p.k
  if (w > 0) return (cur.total + p.prev * prev.total + p.k * p.prior) / w
  return prev.games > 0 ? prev.total / prev.games : 0
}

type Sched = Pick<NflGame, 'season' | 'game_type' | 'week' | 'home' | 'away'>
/** Games an injury status takes off; Questionable takes none, Cut takes all. */
const OUT_GAMES: Partial<Record<InjuryStatus, number>> = { Out: 1, Doubtful: 1, IR: 4, PUP: 4, Reserve: 4 }

/** The club's regular-season games after `afterWeek`, less what the player's status keeps him out of. */
export function gamesLeft(team: string, season: number, afterWeek: number, games: Sched[], status: InjuryStatus | null = null): number {
  if (status === 'Cut') return 0
  const me = franchiseOf(team)
  const left = games.filter((g) => g.season === season && g.game_type === 'REG' && g.week > afterWeek && (franchiseOf(g.home) === me || franchiseOf(g.away) === me)).length
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
  /**
   * This is the newest completed round: a player whose register club is another franchise
   * than the one he last played for (traded, signed elsewhere) is priced with the new club's
   * games. Older rounds keep the club he played for then, since the register only knows today.
   */
  newest?: boolean
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
    const team = c && !(x.newest && franchiseOf(p.team) !== franchiseOf(c.team)) ? c.team : p.team
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
  // a player with no games left (Cut, IR for the rest) is worth 0 but goes below every player who can still
  // play, even one below replacement: otherwise he sits around #90 for a round and makes the movers noise
  const rows: MarketRow[] = cands
    .map((c) => ({ ...c, value: round((c.proj - repl[c.position]) * c.games_left, 1) + 0, rank: 0, pos_rank: 0 }))
    .sort((a, b) => Number(b.games_left > 0) - Number(a.games_left > 0) || b.value - a.value
      || (b.proj - repl[b.position]) - (a.proj - repl[a.position]) || a.player_id.localeCompare(b.player_id))
  const n: Partial<Record<MarketPos, number>> = {}
  rows.forEach((r, i) => { r.rank = i + 1; r.pos_rank = n[r.position] = (n[r.position] ?? 0) + 1 })
  return rows
}

/** Days after a round's last kickoff when 60% of its games with lines is enough (nflverse may never fill the rest). */
export const LINES_GRACE_DAYS = 3

/**
 * Regular-season rounds that are done: every game played and every game with
 * player lines, or, LINES_GRACE_DAYS after the round's last kickoff, at least
 * 60% of them with lines. `lineGames` is games with lines by week.
 */
export function completeRounds(reg: Pick<NflGame, 'week' | 'kickoff' | 'home_score' | 'away_score'>[], lineGames: Map<number, number>, now: Date): number[] {
  const out: number[] = []
  for (const w of [...new Set(reg.map((g) => g.week))].sort((a, b) => a - b)) {
    const wk = reg.filter((g) => g.week === w)
    if (!wk.every(isPlayed)) continue
    const lined = lineGames.get(w) ?? 0
    const last = Math.max(...wk.map((g) => new Date(g.kickoff).getTime()))
    if (lined >= wk.length || (enoughForWeek(lined, wk.length) && now.getTime() - last > LINES_GRACE_DAYS * 86_400_000)) out.push(w)
  }
  return out
}

/**
 * Rounds to write: every completed round with no snapshot, and the newest
 * completed round again (its injury report keeps changing until the next
 * round is done); with `all`, every completed round. Oldest first.
 */
export function marketRounds(complete: number[], have: Iterable<number>, opts: { all?: boolean } = {}): number[] {
  const done = [...new Set(complete)].sort((a, b) => a - b)
  if (opts.all) return done
  const got = new Set(have)
  const latest = done.at(-1)
  return done.filter((w) => !got.has(w) || w === latest)
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

/** The page shows ranks up to this; anything lower counts as `MARKET_TOP + 1` in changes and charts. */
export const MARKET_TOP = 300

/**
 * `rank` is the real rank now, `from` the real rank before; `from` is null only
 * for season movers (`absentAsOutside`) of a player with no row in the first
 * round, who counts as coming from outside the top (`MARKET_TOP + 1`). The page
 * labels a null `from`, and any rank past `MARKET_TOP`, "utan topp 300".
 * `change` is places gained, with ranks clamped to `top + 1`.
 */
export interface Move { player_id: string; rank: number; from: number | null; change: number }

/**
 * Biggest climbs and drops between two snapshots, for players in the top `top` in either, with at least `minGames` played; ranks past `top` count as `top + 1`.
 * With `absentAsOutside`, a player missing from `before` counts as rank `top + 1` there (from null) instead of being left out.
 */
export function movers(now: Pick<MarketRow, 'player_id' | 'rank' | 'games'>[], before: Pick<MarketRow, 'player_id' | 'rank'>[], n = 5, top = MARKET_TOP, minGames = 0, opts: { absentAsOutside?: boolean } = {}): { up: Move[]; down: Move[] } {
  const was = new Map(before.map((r) => [r.player_id, r.rank]))
  const c = (r: number) => Math.min(r, top + 1)
  const moves: Move[] = []
  for (const r of now) {
    if (r.games < minGames) continue
    const from = was.get(r.player_id) ?? null
    if (from === null && !opts.absentAsOutside) continue
    if (r.rank > top && (from === null || from > top)) continue
    moves.push({ player_id: r.player_id, rank: r.rank, from, change: c(from ?? top + 1) - c(r.rank) })
  }
  return {
    up: moves.filter((m) => m.change > 0).sort((a, b) => b.change - a.change || a.rank - b.rank).slice(0, n),
    down: moves.filter((m) => m.change < 0).sort((a, b) => a.change - b.change || a.rank - b.rank).slice(0, n),
  }
}
