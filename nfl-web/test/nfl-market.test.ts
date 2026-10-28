import { describe, it, expect } from 'vitest'
import { completeRounds, gamesLeft, MARKET_NAIVE, marketRounds, marketWeek, movers, projection, tradeVerdict, type MarketLine, type MarketPlayer } from '../src/lib/nfl/market'

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
  it('án leikja í ár og með naive stillingar: meðaltal síðasta tímabils', () => {
    expect(projection({ games: 0, total: 0 }, { games: 10, total: 100 }, MARKET_NAIVE.WR)).toBe(10)
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
  it('PUP og Reserve taka fjóra leiki', () => {
    expect(gamesLeft('KC', 2026, 1, games, 'PUP')).toBe(0)
    expect(gamesLeft('KC', 2026, 1, games, 'Reserve')).toBe(0)
    expect(gamesLeft('KC', 2026, 0, games, 'PUP')).toBe(0)
    expect(gamesLeft('KC', 2026, 0, [...games, G(6, 'KC', 'NE'), G(7, 'KC', 'NYJ'), G(8, 'KC', 'MIA')], 'Reserve')).toBe(3)
  })
  it('leikir úr öðru tímabili teljast ekki', () => {
    expect(gamesLeft('KC', 2026, 1, [...games, { season: 2025, game_type: 'REG', week: 9, home: 'KC', away: 'NE' }])).toBe(3)
  })
  it('gömul skammstöfun á sama félagi', () => {
    const g = [G(2, 'LA', 'SEA'), G(3, 'OAK', 'LA')]
    expect(gamesLeft('LAR', 2026, 1, g)).toBe(2)
    expect(gamesLeft('LV', 2026, 1, g)).toBe(1)
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
      ['A', 20, 1, 1], ['B', 10, 2, 2], ['C', 0, 3, 3], ['D', 0, 4, 1],
    ])
    expect(rows[0]).toMatchObject({ position: 'WR', team: 'T1', games: 1, proj: 20, games_left: 2 })
  })
  it('þegar enginn á leiki eftir raðast eftir spá umfram varamann, ekki hrárri spá', () => {
    const g = [G(1, 'T1', 'T2'), G(1, 'T3', 'T4')]
    const ps: MarketPlayer[] = [
      { player_id: 'Q1', position: 'QB', team: 'T1' }, { player_id: 'Q2', position: 'QB', team: 'T2' },
      { player_id: 'W1', position: 'WR', team: 'T3' }, { player_id: 'W2', position: 'WR', team: 'T4' },
    ]
    // QB replacement is Q2 (15.0 vs 15.1), WR replacement is W2 (2): W1 is 8 over, Q1 only 0.1 over, both replacements tie on 0 (id order)
    const ls = [line('Q1', 1, 'T1', 151), line('Q2', 1, 'T2', 150), line('W1', 1, 'T3', 100), line('W2', 1, 'T4', 20)]
    const rows = marketWeek({ ...base, games: g, players: ps, lines: ls })
    expect(rows.map((r) => r.player_id)).toEqual(['W1', 'Q1', 'Q2', 'W2'])
    expect(rows.every((r) => r.games_left === 0 && Object.is(r.value, 0))).toBe(true)
  })
  it('varamaður er sá tólfti í QB: gildi 0, sá þrettándi neikvæður', () => {
    const g = [G(1, 'T1', 'T2'), G(2, 'T1', 'T2')]
    const ps: MarketPlayer[] = Array.from({ length: 13 }, (_, i) => ({ player_id: `Q${i + 1}`, position: 'QB', team: 'T1' }))
    const ls = ps.map((p, i) => line(p.player_id, 1, 'T1', (13 - i) * 10))
    const rows = marketWeek({ ...base, games: g, players: ps, lines: ls })
    expect(rows.find((r) => r.player_id === 'Q12')!.value).toBe(0)
    expect(rows.find((r) => r.player_id === 'Q13')!.value).toBeLessThan(0)
    expect(rows.find((r) => r.player_id === 'Q11')!.value).toBeGreaterThan(0)
  })
  it('varamaður er sá 36. í WR', () => {
    const g = [G(1, 'T1', 'T2'), G(2, 'T1', 'T2')]
    const ps: MarketPlayer[] = Array.from({ length: 37 }, (_, i) => ({ player_id: `W${i + 1}`, position: 'WR', team: 'T1' }))
    const ls = ps.map((p, i) => line(p.player_id, 1, 'T1', (40 - i) * 10))
    const rows = marketWeek({ ...base, games: g, players: ps, lines: ls })
    expect(rows.find((r) => r.player_id === 'W36')!.value).toBe(0)
    expect(rows.find((r) => r.player_id === 'W37')!.value).toBeLessThan(0)
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
  it('mörkin: 50 á móti 45 er sanngjarnt, 50 á móti 44.9 ekki', () => {
    expect(tradeVerdict([50], [45]).fair).toBe(true)
    expect(tradeVerdict([50], [44.9])).toMatchObject({ fair: false, winner: 'a' })
  })
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
  it('utan topp 300 telst bara sem topp 300 + 1', () => {
    const n = [{ player_id: 'a', rank: 290, games: 5 }, { player_id: 'b', rank: 320, games: 5 }, { player_id: 'c', rank: 350, games: 5 }]
    const b = [{ player_id: 'a', rank: 700 }, { player_id: 'b', rank: 40 }, { player_id: 'c', rank: 400 }]
    const m = movers(n, b)
    expect(m.up).toEqual([{ player_id: 'a', rank: 290, from: 700, change: 11 }])
    expect(m.down).toEqual([{ player_id: 'b', rank: 320, from: 40, change: -261 }])
  })
  it('lágmarksfjöldi leikja', () => expect(movers(now, before, 5, 300, 3).down.map((x) => x.player_id)).toEqual(['p2']))
})

describe('umferðir sem eru skrifaðar', () => {
  it('vantar 5 og 6, nýjasta 7 alltaf endurreiknuð', () => {
    expect(marketRounds([1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 7])).toEqual([5, 6, 7])
  })
  it('ekkert vantar: bara nýjasta umferðin', () => {
    expect(marketRounds([1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])).toEqual([7])
  })
  it('engin lokin umferð: ekkert', () => {
    expect(marketRounds([], [])).toEqual([])
    expect(marketRounds([], [], { all: true })).toEqual([])
  })
  it('all skrifar allar loknar umferðir', () => {
    expect(marketRounds([3, 1, 2], [1, 2, 3], { all: true })).toEqual([1, 2, 3])
  })
})

describe('loknar umferðir', () => {
  const now = new Date('2026-10-28T12:00:00Z')
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()
  /** `n` games in round `week`, the last kicking off `ago` days before now, the first `played` of them played. */
  const round = (week: number, n: number, ago: number, played = n) =>
    Array.from({ length: n }, (_, i) => ({ week, kickoff: daysAgo(ago + (n - 1 - i) / 24), home_score: i < played ? 20 : null, away_score: i < played ? 17 : null }))
  it('allar línur komnar: lokin', () => {
    expect(completeRounds(round(7, 14, 1), new Map([[7, 14]]), now)).toEqual([7])
  })
  it('13 af 14 með línur og síðasti leikur í gær: ekki lokin', () => {
    expect(completeRounds(round(7, 14, 1), new Map([[7, 13]]), now)).toEqual([])
  })
  it('13 af 14 með línur og síðasti leikur fyrir 4 dögum: lokin', () => {
    expect(completeRounds(round(7, 14, 4), new Map([[7, 13]]), now)).toEqual([7])
  })
  it('helmingur með línur fyrir 4 dögum: ekki lokin', () => {
    expect(completeRounds(round(7, 14, 4), new Map([[7, 7]]), now)).toEqual([])
  })
  it('umferð með óspilaðan leik er ekki lokin', () => {
    expect(completeRounds(round(7, 14, 4, 13), new Map([[7, 13]]), now)).toEqual([])
  })
  it('umferð getur klárast á undan þeirri á undan (frestaður leikur)', () => {
    const games = [...round(3, 5, 9), ...round(1, 5, 23), ...round(2, 5, 16, 4)]
    expect(completeRounds(games, new Map([[1, 5], [2, 4], [3, 5]]), now)).toEqual([1, 3])
  })
})
