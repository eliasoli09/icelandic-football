import { MARKET_TOP, movers, type Move } from './market'
import type { StoredMarketRow } from './queries'

export type BoardRow = StoredMarketRow & { change: number | null }
export interface MarketView {
  weeks: number[]
  /**
   * ALL players of the newest round by rank (not just #1-#300: the trade calculator and the
   * movers need the rest; the page filters to <= MARKET_TOP). `change` is places gained since
   * the round before with ranks clamped to MARKET_TOP + 1, the same rule as the movers
   * (640 -> 150 is +151); null if the player has no row in the round before.
   */
  board: BoardRow[]
  /**
   * Rank after each round for every player who has been in the top 300, capped at
   * MARKET_TOP + 1 so a player who fell out does not stretch the chart. A round the player
   * has no row in is a gap, not a point.
   */
  series: Record<string, [number, number][]>
  /** Since the round before. */
  week: { up: Move[]; down: Move[] }
  /** Since the first stored round; a player absent from it counts as coming from outside the top (from null). */
  season: { up: Move[]; down: Move[] }
}

const TOP = MARKET_TOP

export function buildMarketView(rows: StoredMarketRow[]): MarketView {
  const weeks = [...new Set(rows.map((r) => r.week))].sort((a, b) => a - b)
  const at = (w: number | undefined) => rows.filter((r) => r.week === w)
  const last = at(weeks[weeks.length - 1])
  const before = at(weeks[weeks.length - 2])
  const first = at(weeks[0])
  const was = new Map(before.map((r) => [r.player_id, r.rank]))
  const board = last.sort((a, b) => a.rank - b.rank).map((r) => ({ ...r, change: was.has(r.player_id) ? Math.min(was.get(r.player_id)!, TOP + 1) - Math.min(r.rank, TOP + 1) : null }))
  const ever = new Set(rows.filter((r) => r.rank <= TOP).map((r) => r.player_id))
  const series: Record<string, [number, number][]> = {}
  for (const r of [...rows].sort((a, b) => a.week - b.week)) if (ever.has(r.player_id)) (series[r.player_id] ??= []).push([r.week, Math.min(r.rank, TOP + 1)])
  return {
    weeks, board, series,
    week: weeks.length > 1 ? movers(last, before, 5, TOP) : { up: [], down: [] },
    season: weeks.length > 1 ? movers(last, first, 10, TOP, 3, { absentAsOutside: true }) : { up: [], down: [] },
  }
}
