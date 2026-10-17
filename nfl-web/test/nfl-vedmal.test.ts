import { describe, expect, it } from 'vitest'
import { bestSlip, decimalOdds, gameLegs, impliedPoints, rushProjection, sidePoints, tdChance, tdRate, teamFactor, type Leg } from '../src/lib/nfl/vedmal'

const leg = (id: string, odds: number, p: number): Leg => ({ game_id: id, team: id, opp: 'X', home: true, kickoff: '', odds, p, market: 1 / odds })

describe('decimalOdds', () => {
  it('turns American lines into European prices', () => {
    expect(decimalOdds(-200)).toBeCloseTo(1.5)
    expect(decimalOdds(150)).toBeCloseTo(2.5)
    expect(decimalOdds(100)).toBeCloseTo(2)
  })
})

describe('gameLegs', () => {
  it('gives both sides with the model and the margin-free market', () => {
    const [h, a] = gameLegs({ game_id: 'g', home: 'KC', away: 'LV', kickoff: 'k', home_ml: -300, away_ml: 250 }, 0.7)
    expect(h).toMatchObject({ team: 'KC', opp: 'LV', home: true, p: 0.7 })
    expect(a).toMatchObject({ team: 'LV', home: false })
    expect(a.p).toBeCloseTo(0.3)
    expect(h.market + a.market).toBeCloseTo(1)
    expect(h.odds).toBeCloseTo(4 / 3)
  })
  it('is empty without a moneyline or a model chance', () => {
    expect(gameLegs({ game_id: 'g', home: 'KC', away: 'LV', kickoff: 'k', home_ml: null, away_ml: 250 }, 0.7)).toEqual([])
    expect(gameLegs({ game_id: 'g', home: 'KC', away: 'LV', kickoff: 'k', home_ml: -300, away_ml: 250 }, undefined)).toEqual([])
  })
})

describe('bestSlip', () => {
  it('picks the likeliest slip within the price band, one leg a game', () => {
    const games = [
      [leg('a', 1.4, 0.75), leg('a2', 3, 0.25)],
      [leg('b', 1.45, 0.72), leg('b2', 2.9, 0.28)],
      [leg('c', 2.05, 0.5)],
    ]
    const s = bestSlip(games, 2)!
    expect(s.legs.map((l) => l.game_id)).toEqual(['a', 'b'])
    expect(s.odds).toBeCloseTo(2.03)
    expect(s.p).toBeCloseTo(0.54)
  })
  it('needs two legs, stays under the ceiling and gives up when nothing fits', () => {
    expect(bestSlip([[leg('a', 2.1, 0.5)]], 2)).toBeNull()
    expect(bestSlip([[leg('a', 1.9, 0.5)], [leg('b', 1.9, 0.5)]], 2)).toBeNull()
    const s = bestSlip([[leg('a', 1.5, 0.6)], [leg('b', 1.5, 0.6)], [leg('c', 1.6, 0.65)]], 3.5)!
    expect(s.legs).toHaveLength(3)
    expect(s.odds).toBeLessThanOrEqual(3.5 * 1.15)
  })
  it('handles a full Sunday quickly', () => {
    const games = Array.from({ length: 16 }, (_, i) => [leg(`h${i}`, 1.15 + i * 0.05, 0.8 - i * 0.02), leg(`a${i}`, 4 - i * 0.1, 0.2 + i * 0.02)])
    const t = Date.now()
    for (const target of [2, 3.5, 5]) expect(bestSlip(games, target)).not.toBeNull()
    expect(Date.now() - t).toBeLessThan(2000)
  })
})

describe('player and game projections', () => {
  const P = { rCarry: 0.03, rTarget: 0.05, k: 4, prev: 0.5 }
  it('pulls a touchdown rate towards what the usage would score', () => {
    const cur = { games: 4, carries: 80, targets: 12, tds: 0, rushYards: 300 }
    const none = { games: 0, carries: 0, targets: 0, tds: 0, rushYards: 0 }
    const r = tdRate(cur, none, P)
    // usage alone says (20 × 0.03 + 3 × 0.05) = 0.75 a game; no scores so far halves it
    expect(r).toBeCloseTo((0 + 4 * 0.75) / 8)
    expect(tdRate(none, none, P)).toBe(0)
  })
  it('implied points and the team factor', () => {
    expect(impliedPoints({ spread_line: 7, total_line: 45 }, true)).toBe(26)
    expect(impliedPoints({ spread_line: 7, total_line: 45 }, false)).toBe(19)
    expect(impliedPoints({ spread_line: null, total_line: 45 }, true)).toBeNull()
    expect(teamFactor(26, 100, 4, 22, 4)).toBeCloseTo(26 / ((100 + 88) / 8))
    expect(teamFactor(null, 100, 4, 22, 4)).toBe(1)
  })
  it('a touchdown chance from the expected count', () => {
    expect(tdChance(0)).toBe(0)
    expect(tdChance(Math.log(2))).toBeCloseTo(0.5)
  })
  it('rushing yards scale with what the opponent gives up', () => {
    const cur = { games: 5, carries: 90, targets: 10, tds: 3, rushYards: 450 }
    const none = { games: 0, carries: 0, targets: 0, tds: 0, rushYards: 0 }
    expect(rushProjection(cur, none, 600, 5, 110, { prev: 0.5, kDef: 0 })).toBeCloseTo(90 * (120 / 110))
    expect(rushProjection(cur, none, 600, 5, 110, { prev: 0.5, kDef: 1e9 })).toBeCloseTo(90)
  })
  it('side points from attack and defence', () => {
    expect(sidePoints(150, 5, 150, 5, 22, 0)).toBeCloseTo(30 * 30 / 22)
    expect(sidePoints(150, 5, 150, 5, 22, 1e9)).toBeCloseTo(22)
  })
})
