import { describe, it, expect } from 'vitest'
import { buildMarketView, forClient, rankTicks } from '../src/lib/nfl/marketView'
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
  it('tómt', () => {
    expect(buildMarketView([])).toEqual({ weeks: [], board: [], series: {}, week: { up: [], down: [] }, season: { up: [], down: [] } })
  })
})

describe('utan topp 300', () => {
  it('fellur 250 -> 320: niður í viku, ferill klipptur við 301, tafla -51', () => {
    const v = buildMarketView([R(1, 'x', 250, 5), R(2, 'x', 320, 6)])
    expect(v.week.down).toEqual([{ player_id: 'x', rank: 320, from: 250, change: -51 }])
    expect(v.series.x).toEqual([[1, 250], [2, 301]])
    expect(v.board[0].change).toBe(-51)
  })
  it('640 -> 150: taflan sýnir sömu breytingu og hreyfingarnar (+151)', () => {
    const v = buildMarketView([R(1, 'y', 640, 5), R(2, 'y', 150, 6)])
    expect(v.board[0].change).toBe(151)
    expect(v.week.up).toEqual([{ player_id: 'y', rank: 150, from: 640, change: 151 }])
    expect(v.series.y).toEqual([[1, 301], [2, 150]])
  })
  it('leikmaður sem var aldrei í topp 300 fær engan feril', () => {
    const v = buildMarketView([R(1, 'z', 500), R(2, 'z', 450), R(1, 'a', 1), R(2, 'a', 1)])
    expect(v.series).not.toHaveProperty('z')
    expect(v.board.map((r) => r.player_id)).toContain('z')
  })
  it('vantar í umferð 1 en er #40 núna með 3 leiki: efst í hreyfingum tímabilsins, from null', () => {
    const v = buildMarketView([R(1, 'a', 1, 1), R(2, 'a', 1, 2), R(3, 'a', 1, 3), R(3, 'n', 40, 3)])
    expect(v.season.up).toEqual([{ player_id: 'n', rank: 40, from: null, change: 261 }])
    // week movers unchanged: a player with no row in the round before is not in them
    expect(v.week.up).toEqual([])
  })
})

describe('jaðartilvik', () => {
  it('ein umferð: engin breyting, engar hreyfingar, einn punktur á leikmann', () => {
    const v = buildMarketView([R(1, 'a', 1), R(1, 'b', 2)])
    expect(v.weeks).toEqual([1])
    expect(v.board.map((r) => r.change)).toEqual([null, null])
    expect(v.week).toEqual({ up: [], down: [] })
    expect(v.season).toEqual({ up: [], down: [] })
    expect(v.series).toEqual({ a: [[1, 1]], b: [[1, 2]] })
  })
  it('minnst 3 leikir: 3 með, 2 ekki', () => {
    const v = buildMarketView([R(1, 'a', 5, 3), R(1, 'b', 6, 2), R(2, 'a', 1, 3), R(2, 'b', 2, 2)])
    expect(v.season.up.map((m) => m.player_id)).toEqual(['a'])
  })
  it('vantar í miðjuumferð: gat í ferli og breyting null', () => {
    const v = buildMarketView([R(1, 'a', 4), R(3, 'a', 2), R(1, 'b', 1), R(2, 'b', 1), R(3, 'b', 1)])
    expect(v.series.a).toEqual([[1, 4], [3, 2]])
    expect(v.board.find((r) => r.player_id === 'a')!.change).toBeNull()
  })
})

describe('fyrir vafrann', () => {
  it('sæti í röð umferða með götum, tölur á 1 aukastaf, nýr aðeins í fyrsta sinn', () => {
    const rows = [R(1, 'a', 4), R(3, 'a', 2), R(1, 'b', 1), R(2, 'b', 1), R(3, 'b', 1), R(3, 'n', 3)]
    rows[1].value = 12.345
    rows[1].proj = 7.06
    const c = forClient(buildMarketView(rows))
    expect(c.weeks).toEqual([1, 2, 3])
    expect(c.ranks.a).toEqual([4, null, 2])
    const a = c.board.find((r) => r.player_id === 'a')!
    expect([a.value, a.proj, a.change, a.isNew]).toEqual([12.3, 7.1, null, undefined])
    expect(c.board.find((r) => r.player_id === 'n')!.isNew).toBe(true)
    expect(c.board[0]).not.toHaveProperty('week')
    expect(c.board[0]).not.toHaveProperty('games')
  })
  it('engin mynd fyrir utan topp 300', () => {
    const rows = [R(1, 'x', 320), R(1, 'y', 10)]
    rows[0].headshot = 'h1'
    rows[1].headshot = 'h2'
    const c = forClient(buildMarketView(rows))
    expect(c.board.map((r) => r.headshot)).toEqual(['h2', null])
  })
  it('ein umferð: enginn nýr', () => {
    expect(forClient(buildMarketView([R(1, 'a', 1)])).board[0].isNew).toBeUndefined()
  })
})

describe('ásinn', () => {
  it('allt bilið: #1, #100, #200, 300+', () => expect(rankTicks(301)).toEqual([1, 100, 200, 301]))
  it('minni bil byrja alltaf á #1', () => {
    expect(rankTicks(1)).toEqual([1])
    expect(rankTicks(3)).toEqual([1, 2, 3])
    expect(rankTicks(12)).toEqual([1, 5, 10])
    expect(rankTicks(87)).toEqual([1, 25, 50, 75])
    expect(rankTicks(250)).toEqual([1, 100, 200])
  })
})
