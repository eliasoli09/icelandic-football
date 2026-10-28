import { describe, it, expect } from 'vitest'
import { gamesLeft, MARKET_NAIVE, marketWeek, movers, projection, tradeVerdict, type MarketLine, type MarketPlayer } from '../src/lib/nfl/market'

const Z = { passing_yards: 0, passing_tds: 0, interceptions: 0, rushing_yards: 0, rushing_tds: 0, receptions: 0, receiving_yards: 0, receiving_tds: 0, fumbles_lost: 0 }
// receiving yards / 10 = points, so 200 yards is 20 points
const line = (player_id: string, week: number, team: string, yards: number): MarketLine => ({ ...Z, player_id, week, team, game_id: `g${week}${team}`, receiving_yards: yards })
const G = (week: number, home: string, away: string, game_type: 'REG' | 'WC' = 'REG') => ({ season: 2026, game_type, week, home, away })

describe('spá í leik', () => {
  it('blandar tímabilunum og dregur að forgildi', () => {
    expect(projection({ games: 2, total: 30 }, { games: 10, total: 100 }, { prev: 0.5, k: 2, prior: 6 })).toBeCloseTo(92 / 9)
  })
  it('einfalda meðaltalið', () => {
    expect(projection({ games: 2, total: 30 }, { games: 10, total: 100 }, MARKET_NAIVE.WR)).toBe(15)
    expect(projection({ games: 0, total: 0 }, { games: 0, total: 0 }, MARKET_NAIVE.WR)).toBe(0)
  })
})

describe('leikir eftir', () => {
  // KC: weeks 1, 2, 4, 5 and a play-off game; week 3 is the bye
  const games = [G(1, 'KC', 'LV'), G(2, 'DEN', 'KC'), G(4, 'KC', 'LAC'), G(5, 'BUF', 'KC'), G(19, 'KC', 'HOU', 'WC')]
  it('frí og úrslitakeppni teljast ekki', () => expect(gamesLeft('KC', 2026, 1, games)).toBe(3))
  it('meiðsli draga frá', () => {
    expect(gamesLeft('KC', 2026, 1, games, 'Out')).toBe(2)
    expect(gamesLeft('KC', 2026, 1, games, 'Doubtful')).toBe(2)
    expect(gamesLeft('KC', 2026, 1, games, 'Questionable')).toBe(3)
    expect(gamesLeft('KC', 2026, 1, games, 'IR')).toBe(0)
    expect(gamesLeft('KC', 2026, 1, games, 'Cut')).toBe(0)
  })
})

describe('markaðurinn í einni umferð', () => {
  const games = [G(1, 'T1', 'T2'), G(1, 'T3', 'T4'), G(2, 'T1', 'T3'), G(2, 'T2', 'T4'), G(3, 'T1', 'T4'), G(3, 'T2', 'T3')]
  const players: MarketPlayer[] = [
    { player_id: 'A', position: 'WR', team: 'T1' }, { player_id: 'B', position: 'WR', team: 'T2' },
    { player_id: 'C', position: 'WR', team: 'T3' }, { player_id: 'D', position: 'RB', team: 'T4' },
    { player_id: 'E', position: 'WR', team: null }, { player_id: 'F', position: 'K', team: 'T1' },
  ]
  const lines = [line('A', 1, 'T1', 200), line('B', 1, 'T2', 150), line('C', 1, 'T3', 100), line('D', 1, 'T4', 120),
    line('E', 1, 'T1', 300), line('F', 1, 'T1', 90), line('A', 2, 'T1', 0)]
  const base = { season: 2026, week: 1, lines, prev: new Map(), players, games, injuries: new Map(), params: MARKET_NAIVE }

  it('verðmæti = (spá − varamannsstig) × leikir eftir, raðað', () => {
    const rows = marketWeek(base)
    // fewer than 36 WRs: the last one listed is the replacement (C, 10); the only RB is its own replacement
    expect(rows.map((r) => [r.player_id, r.value, r.rank, r.pos_rank])).toEqual([
      ['A', 20, 1, 1], ['B', 10, 2, 2], ['D', 0, 3, 1], ['C', 0, 4, 3],
    ])
    expect(rows[0]).toMatchObject({ position: 'WR', team: 'T1', games: 1, proj: 20, games_left: 2 })
  })
  it('meiddur leikmaður á færri leiki eftir', () => {
    const rows = marketWeek({ ...base, injuries: new Map([['A', 'Out' as const]]) })
    expect(rows.find((r) => r.player_id === 'A')).toMatchObject({ games_left: 1, value: 10 })
  })
  it('leikmaður með leik í fyrra en ekki í ár er með', () => {
    const rows = marketWeek({ ...base, players: [...players, { player_id: 'G', position: 'TE', team: 'T2' }], prev: new Map([['G', { games: 10, total: 80 }]]), params: { ...MARKET_NAIVE, TE: { prev: 1, k: 0, prior: 0 } } })
    expect(rows.find((r) => r.player_id === 'G')).toMatchObject({ games: 0, proj: 8, games_left: 2 })
  })
})

describe('skiptireiknir', () => {
  it('sanngjarnt innan 10%', () => expect(tradeVerdict([50], [46])).toEqual({ a: 50, b: 46, fair: true, winner: null, margin: 4 }))
  it('neikvætt verðmæti telst 0', () => expect(tradeVerdict([50], [30, -5])).toEqual({ a: 50, b: 30, fair: false, winner: 'a', margin: 20 }))
  it('tómt er sanngjarnt', () => expect(tradeVerdict([], []).fair).toBe(true))
})

describe('hreyfingar', () => {
  const now = [{ player_id: 'p1', rank: 1, games: 3 }, { player_id: 'p2', rank: 2, games: 3 }, { player_id: 'p3', rank: 3, games: 1 }, { player_id: 'p4', rank: 4, games: 3 }]
  const before = [{ player_id: 'p1', rank: 3 }, { player_id: 'p2', rank: 1 }, { player_id: 'p3', rank: 2 }]
  it('upp og niður, nýir leikmenn ekki með', () => {
    const m = movers(now, before)
    expect(m.up).toEqual([{ player_id: 'p1', rank: 1, from: 3, change: 2 }])
    expect(m.down.map((x) => x.player_id)).toEqual(['p2', 'p3'])
  })
  it('lágmarksfjöldi leikja', () => expect(movers(now, before, 5, 300, 3).down.map((x) => x.player_id)).toEqual(['p2']))
})
