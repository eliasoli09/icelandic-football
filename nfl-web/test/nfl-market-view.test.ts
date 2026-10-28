import { describe, it, expect } from 'vitest'
import { buildMarketView } from '../src/lib/nfl/marketView'
import type { StoredMarketRow } from '../src/lib/nfl/queries'

const R = (week: number, player_id: string, rank: number, games = week): StoredMarketRow => ({
  week, player_id, rank, games, position: 'WR', team: 'KC', proj: 10, games_left: 10, value: 100 - rank, pos_rank: rank, name: player_id.toUpperCase(), headshot: null,
})

describe('útlit markaðarins', () => {
  const rows = [R(1, 'a', 1), R(1, 'b', 2), R(1, 'c', 3), R(2, 'a', 2), R(2, 'b', 3), R(2, 'c', 1), R(3, 'a', 3), R(3, 'b', 1), R(3, 'c', 2), R(3, 'd', 4, 1)]
  const v = buildMarketView(rows)
  it('umferðir og tafla nýjustu umferðar með breytingu', () => {
    expect(v.weeks).toEqual([1, 2, 3])
    expect(v.board.map((r) => [r.player_id, r.change])).toEqual([['b', 2], ['c', -1], ['a', -1], ['d', null]])
  })
  it('ferill hvers leikmanns', () => {
    expect(v.series.a).toEqual([[1, 1], [2, 2], [3, 3]])
    expect(v.series.d).toEqual([[3, 4]])
  })
  it('hreyfingar vikunnar og frá umferð 1 (minnst 3 leikir)', () => {
    expect(v.week.up.map((m) => m.player_id)).toEqual(['b'])
    // since round 1: b 2 → 1 and c 3 → 2 (both +1, b ranks higher); d has only 1 game
    expect(v.season.up.map((m) => m.player_id)).toEqual(['b', 'c'])
    expect(v.season.down.map((m) => m.player_id)).toEqual(['a'])
  })
  it('tómt', () => expect(buildMarketView([]).board).toEqual([]))
})
