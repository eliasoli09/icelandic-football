import { movers, type Move } from './market'
import type { StoredMarketRow } from './queries'

export type BoardRow = StoredMarketRow & { change: number | null }
export interface MarketView {
  weeks: number[]
  /** The newest round, by rank, with places gained since the round before (null if new). */
  board: BoardRow[]
  /** Rank after each round, for every player who has been in the top 300. */
  series: Record<string, [number, number][]>
  week: { up: Move[]; down: Move[] }
  season: { up: Move[]; down: Move[] }
}

const TOP = 300

export function buildMarketView(rows: StoredMarketRow[]): MarketView {
  const weeks = [...new Set(rows.map((r) => r.week))].sort((a, b) => a - b)
  const at = (w: number | undefined) => rows.filter((r) => r.week === w)
  const last = at(weeks[weeks.length - 1])
  const before = at(weeks[weeks.length - 2])
  const first = at(weeks[0])
  const was = new Map(before.map((r) => [r.player_id, r.rank]))
  const board = last.sort((a, b) => a.rank - b.rank).map((r) => ({ ...r, change: was.has(r.player_id) ? was.get(r.player_id)! - r.rank : null }))
  const ever = new Set(rows.filter((r) => r.rank <= TOP).map((r) => r.player_id))
  const series: Record<string, [number, number][]> = {}
  for (const r of [...rows].sort((a, b) => a.week - b.week)) if (ever.has(r.player_id)) (series[r.player_id] ??= []).push([r.week, r.rank])
  return {
    weeks, board, series,
    week: weeks.length > 1 ? movers(last, before, 5, TOP) : { up: [], down: [] },
    season: weeks.length > 1 ? movers(last, first, 10, TOP, 3) : { up: [], down: [] },
  }
}
