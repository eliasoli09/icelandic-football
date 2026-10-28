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

/** One board row as the page's client part gets it: only what it shows, numbers to 1 decimal. */
export interface ClientRow {
  player_id: string
  name: string
  /** Only for #1-#300 (the board shows photos for those alone). */
  headshot: string | null
  position: StoredMarketRow['position']
  team: string
  rank: number
  pos_rank: number
  value: number
  proj: number
  games_left: number
  change: number | null
  /** First stored round the player has any row in is the newest one (and there were rounds before it). */
  isNew?: true
}
export interface ClientMarket {
  weeks: number[]
  board: ClientRow[]
  /** Rank after each of `weeks` (capped at MARKET_TOP + 1), null where the player has no row. */
  ranks: Record<string, (number | null)[]>
  week: { up: Move[]; down: Move[] }
  season: { up: Move[]; down: Move[] }
}

const r1 = (x: number) => Math.round(x * 10) / 10

/** Shrink the view for the browser: by season end the raw rows are ~13k, this is a small part of that. */
export function forClient(v: MarketView): ClientMarket {
  const at = new Map(v.weeks.map((w, i) => [w, i]))
  const ranks: Record<string, (number | null)[]> = {}
  for (const [id, pts] of Object.entries(v.series)) {
    const a: (number | null)[] = v.weeks.map(() => null)
    for (const [w, r] of pts) a[at.get(w)!] = r
    ranks[id] = a
  }
  const board = v.board.map((r): ClientRow => {
    const row: ClientRow = {
      player_id: r.player_id, name: r.name, headshot: r.rank <= TOP ? r.headshot : null, position: r.position, team: r.team,
      rank: r.rank, pos_rank: r.pos_rank, value: r1(r.value), proj: r1(r.proj), games_left: r.games_left, change: r.change,
    }
    if (r.change === null && v.weeks.length > 1 && v.series[r.player_id]?.length === 1) row.isNew = true
    return row
  })
  return { weeks: v.weeks, board, ranks, week: v.week, season: v.season }
}
