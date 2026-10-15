import { describe, it, expect } from 'vitest'
import { changeAdjuster, epaKey, ratingAdjuster, type QbParams } from '../src/lib/nfl/qbElo'
import type { EloGame } from '../src/lib/nfl/elo'

let n = 0
const g = (week: number, home: string, homeQb: string | null, away: string, awayQb: string | null, season = 2020): EloGame => ({
  game_id: `${season}_${week}_${away}_${home}_${n++}`, season, week, game_type: 'REG',
  kickoff: `${season}-09-${String(week).padStart(2, '0')}T17:00:00.000Z`,
  home, away, home_score: 20, away_score: 10, neutral: false, home_qb_id: homeQb, away_qb_id: awayQb,
})
/** Feed games through an adjuster as runElo would, returning each game's adjustment. */
const play = (adj: { before: (x: EloGame) => { home: number; away: number }; after: (x: EloGame) => void }, games: EloGame[]) =>
  games.map((x) => { const a = adj.before(x); adj.after(x); return a })

describe('A: föst refsing', () => {
  it('refsar aðeins þegar byrjunarmaðurinn er ekki sá venjulegi', () => {
    const out = play(changeAdjuster(40), [g(1, 'A', 'x', 'B', 'b'), g(2, 'A', 'x', 'B', 'b'), g(3, 'A', 'y', 'B', 'b'), g(4, 'A', 'x', 'B', 'b')])
    expect(out.map((a) => a.home)).toEqual([0, 0, -40, 0])
    expect(out.every((a) => a.away === 0)).toBe(true)
  })
  it('þarf minnst tvo fyrri leiki', () => {
    expect(play(changeAdjuster(40), [g(1, 'A', 'x', 'B', 'b'), g(2, 'A', 'y', 'B', 'b')])[1].home).toBe(0)
  })
  it('jafnt í fjölda: sá nýjasti er venjulegur', () => {
    const out = play(changeAdjuster(40), [g(1, 'A', 'x', 'B', 'b'), g(2, 'A', 'y', 'B', 'b'), g(3, 'A', 'y', 'B', 'b'), g(4, 'A', 'x', 'B', 'b')])
    // last three before week 4 are x, y, y: y is usual, so x is a change
    expect(out[3].home).toBe(-40)
  })
  it('gildir yfir tímabilaskil og eftir félagi (OAK = LV)', () => {
    const out = play(changeAdjuster(40), [g(16, 'OAK', 'x', 'B', 'b', 2019), g(17, 'OAK', 'x', 'B', 'b', 2019), g(1, 'LV', 'y', 'B', 'b', 2020)])
    expect(out[2].home).toBe(-40)
  })
  it('vantar auðkenni: engin refsing og ekkert skráð', () => {
    const out = play(changeAdjuster(40), [g(1, 'A', 'x', 'B', 'b'), g(2, 'A', null, 'B', 'b'), g(3, 'A', 'x', 'B', 'b'), g(4, 'A', 'y', 'B', 'b')])
    expect(out.map((a) => a.home)).toEqual([0, 0, 0, -40])
  })
})

describe('B: EPA-einkunn', () => {
  const P: QbParams = { c: 10, a: 0.5, t: 0.5, n0: 1, prior: 0 }
  const epa = (rows: [string, EloGame, number][]) => new Map(rows.map(([qb, x, v]) => [epaKey(qb, x.season, x.week, x.game_type), v]))

  it('óþekktur leikmaður og óþekkt lið eru í forgildinu', () => {
    const adj = ratingAdjuster({ ...P, prior: -3 }, new Map())
    expect(adj.player('x')).toBe(-3)
    expect(adj.team('A')).toBe(-3)
    expect(adj.before(g(1, 'A', 'x', 'B', 'b'))).toEqual({ home: 0, away: 0 })
  })
  it('einkunn færist í átt að nýjum leik, með forgildinu sem n0 leikjum', () => {
    const x = g(1, 'A', 'x', 'B', 'b')
    const adj = ratingAdjuster(P, epa([['x', x, 10]]))
    adj.before(x); adj.after(x)
    // S = 10, W = 1, rating = (10 + 1·0) / (1 + 1)
    expect(adj.player('x')).toBeCloseTo(5, 12)
    // team: 0·(1 − 0.5) + 0.5·10
    expect(adj.team('A')).toBeCloseTo(5, 12)
    expect(adj.player('b')).toBe(0)
  })
  it('leikur notar ekki eigin EPA: leiðréttingin er reiknuð á undan', () => {
    const w1 = g(1, 'A', 'x', 'B', 'b')
    const w2 = g(2, 'A', 'y', 'B', 'b')
    const adj = ratingAdjuster(P, epa([['x', w1, 10], ['y', w2, -20]]))
    const out = play(adj, [w1, w2])
    expect(out[0].home).toBe(0)
    // y unknown (0) against the team's 5: c × (0 − 5)
    expect(out[1].home).toBeCloseTo(-50, 12)
  })
  it('c = 0 gefur enga leiðréttingu', () => {
    const w1 = g(1, 'A', 'x', 'B', 'b')
    const adj = ratingAdjuster({ ...P, c: 0 }, epa([['x', w1, 10]]))
    expect(play(adj, [w1, g(2, 'A', 'y', 'B', 'b')])[1].home).toBeCloseTo(0, 12)
  })
  it('vantar EPA-línu: ekkert uppfært', () => {
    const adj = ratingAdjuster(P, new Map())
    play(adj, [g(1, 'A', 'x', 'B', 'b')])
    expect(adj.player('x')).toBe(0)
    expect(adj.team('A')).toBe(0)
  })
  it('úrslitaleikir lesa POST-línuna', () => {
    expect(epaKey('x', 2020, 19, 'WC')).toBe('x:2020:19:POST')
    expect(epaKey('x', 2020, 3, 'REG')).toBe('x:2020:3:REG')
  })
})

describe('gameQbRows', () => {
  it('spilaðir leikir úr keyrslunni, óspilaðir úr stöðunni eftir hana, aðeins hliðar með byrjunarmann', async () => {
    const { runElo, NFL_ELO } = await import('../src/lib/nfl/elo')
    const { gameQbRows } = await import('../src/lib/nfl/qbElo')
    const w1 = { ...g(1, 'A', 'x', 'B', 'b'), home_qb: 'X Man', away_qb: 'B Man' }
    const w2 = { ...g(2, 'A', 'y', 'B', null), home_score: null, away_score: null, home_qb: 'Y Man', away_qb: null }
    const adj = ratingAdjuster({ c: 10, a: 0.5, t: 0.5, n0: 1, prior: 0 }, new Map([[epaKey('x', 2020, 1, 'REG'), 10]]))
    const run = runElo([w1, w2], NFL_ELO, adj)
    const rows = gameQbRows([w1, w2], run.records, adj)
    expect(rows).toEqual([
      { game_id: w1.game_id, team: 'A', qb_id: 'x', qb: 'X Man', adj: 0 },
      { game_id: w1.game_id, team: 'B', qb_id: 'b', qb: 'B Man', adj: 0 },
      { game_id: w2.game_id, team: 'A', qb_id: 'y', qb: 'Y Man', adj: -50 },
    ])
  })
})
