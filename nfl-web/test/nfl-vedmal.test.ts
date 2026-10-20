import { describe, expect, it } from 'vitest'
import { bestSlip, decimalOdds, estimatedOdds, gameLegs, impliedPoints, lineFor, probOver, rushProjection, sidePoints, tdChance, tdRate, teamFactor, totalLegs, type Leg } from '../src/lib/nfl/vedmal'

const leg = (id: string, odds: number, p: number): Leg => ({ kind: 'win', game_id: id, team: id, opp: 'X', home: true, kickoff: '', odds, p, market: 1 / odds })

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
  it('handles a Sunday with player picks too: 14 games, 16 picks each', () => {
    const games = Array.from({ length: 14 }, (_, g) => Array.from({ length: 16 }, (_, i) => {
      const p = 0.3 + ((g * 7 + i * 13) % 60) / 100
      return leg(`g${g}p${i}`, 1 / (p * 1.06), p)
    }).map((l, i) => ({ ...l, game_id: `g${Math.floor(i / 99)}${l.game_id.split('p')[0]}` })))
    const t = Date.now()
    for (const target of [2, 3.5, 5]) expect(bestSlip(games, target, 1.15, 2, 6)).not.toBeNull()
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

describe('totals and player picks', () => {
  it('over and under at the bookmaker prices', () => {
    const [o, u] = totalLegs({ game_id: 'g', home: 'KC', away: 'LV', kickoff: 'k', total_line: 47.5, over_odds: -110, under_odds: -110 })
    expect(o).toMatchObject({ kind: 'over', line: 47.5 })
    expect(o.p).toBeCloseTo(0.5)
    expect(o.odds).toBeCloseTo(1.909, 2)
    expect(u.kind).toBe('under')
    expect(totalLegs({ game_id: 'g', home: 'KC', away: 'LV', kickoff: 'k', total_line: 47.5, over_odds: null, under_odds: -110 })).toEqual([])
  })
  // quantiles of actual ÷ projected: half the time under 1, a tenth under 0.5
  const q = Array.from({ length: 9 }, (_, i) => [0.5, 0.65, 0.8, 0.9, 1, 1.1, 1.25, 1.45, 1.8][i])
  it('reads the chance of going over a line', () => {
    expect(probOver(80, 80, q)).toBeCloseTo(0.5)
    expect(probOver(40, 80, q)).toBeCloseTo(0.9)
    expect(probOver(10, 80, q)).toBeGreaterThan(0.9)
    expect(probOver(200, 80, q)).toBeLessThan(0.1)
    expect(probOver(10, 0, q)).toBe(0)
  })
  it('finds the highest x.5 line a player clears with the asked chance', () => {
    const l = lineFor(0.8, 80, q)!
    expect(l % 1).toBe(0.5)
    expect(probOver(l, 80, q)).toBeGreaterThanOrEqual(0.8)
    expect(probOver(l + 1, 80, q)).toBeLessThan(0.8)
    expect(lineFor(0.8, 0, q)).toBeNull()
  })
  it('estimates a price with the margin on top', () => {
    expect(estimatedOdds(0.5, 0.08)).toBeCloseTo(1 / 0.54)
    expect(estimatedOdds(0.999, 0.2)).toBe(1.01)
  })
  it('marks a slip with an estimated price', () => {
    const real = leg('a', 1.5, 0.66), est = { ...leg('b', 1.5, 0.66), kind: 'td' as const, estimated: true }
    expect(bestSlip([[real], [est]], 2)?.estimated).toBe(true)
    expect(bestSlip([[real], [leg('c', 1.5, 0.66)]], 2)?.estimated).toBe(false)
  })
})

describe('slips with a player pick', () => {
  const l = (id: string, odds: number, p: number, kind: Leg['kind'] = 'win'): Leg => ({ kind, game_id: id, team: id, opp: 'X', home: true, kickoff: '', odds, p, market: p })
  it('keeps the likeliest slip unless asked for a player pick', () => {
    const games = [[l('a', 1.45, 0.66), l('a', 1.5, 0.6, 'td')], [l('b', 1.45, 0.66)], [l('c', 1.5, 0.6, 'yards')]]
    expect(bestSlip(games, 2)!.legs.every((x) => x.kind === 'win')).toBe(true)
    const withPlayer = bestSlip(games, 2, 1.15, 2, 6, true)!
    expect(withPlayer.legs.some((x) => x.kind === 'td' || x.kind === 'yards')).toBe(true)
    expect(withPlayer.p).toBeLessThan(bestSlip(games, 2)!.p)
  })
})

describe('oddsLabel', () => {
  it('shows the European price with a comma, nothing without a line', async () => {
    const { oddsLabel } = await import('../src/lib/nfl/odds')
    expect(oddsLabel(-200)).toBe('1,50')
    expect(oddsLabel(130)).toBe('2,30')
    expect(oddsLabel(null)).toBeNull()
  })
})
