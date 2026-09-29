import { describe, expect, it } from 'vitest'
import { pickPoints, simulateRest, type Pick, type WhatIfFixture, type WhatIfTeam } from '../src/lib/whatif/simulate'

const team = (id: number, points: number, group: 'efri' | 'nedri' | null = null): WhatIfTeam =>
  ({ id, points, gf: 20, ga: 20, played: 20, group })
const fixture = (id: number, home: number, away: number, lh = 1.5, la = 1.2): WhatIfFixture =>
  ({ id, home, away, lambdaHome: lh, lambdaAway: la })

describe('the reader’s own season', () => {
  it('keeps a score the reader gave, in every run', () => {
    const teams = [team(1, 30), team(2, 30), team(3, 30), team(4, 30)]
    const picks = new Map<number, Pick>([[10, { kind: 'score', home: 5, away: 0 }]])
    const out = simulateRest(teams, [fixture(10, 1, 2)], picks, { runs: 200 })
    // three points every time, and nothing left to chance for those two
    expect(out.find((r) => r.id === 1)!.projectedPoints).toBe(33)
    expect(out.find((r) => r.id === 2)!.projectedPoints).toBe(30)
  })

  it('draws the goals itself when only the winner is named', () => {
    const teams = [team(1, 0), team(2, 0)]
    const picks = new Map<number, Pick>([[10, { kind: 'outcome', pick: 'away' }]])
    const out = simulateRest(teams, [fixture(10, 1, 2)], picks, { runs: 400 })
    expect(out.find((r) => r.id === 2)!.projectedPoints).toBe(3)
    expect(out.find((r) => r.id === 1)!.projectedPoints).toBe(0)
  })

  it('leaves an unpicked match to the model', () => {
    const teams = [team(1, 0), team(2, 0)]
    const out = simulateRest(teams, [fixture(10, 1, 2, 2.0, 0.5)], new Map(), { runs: 3000 })
    const home = out.find((r) => r.id === 1)!.projectedPoints
    // the stronger side takes most but not all of the points on offer
    expect(home).toBeGreaterThan(1.5)
    expect(home).toBeLessThan(3)
  })

  it('settles everything once every match is given a score', () => {
    const teams = [team(1, 10), team(2, 10), team(3, 10), team(4, 10)]
    const fixtures = [fixture(1, 1, 2), fixture(2, 3, 4)]
    const picks = new Map<number, Pick>([
      [1, { kind: 'score', home: 2, away: 1 }],
      [2, { kind: 'score', home: 0, away: 3 }],
    ])
    const out = simulateRest(teams, fixtures, picks, { runs: 50 })
    const title = out.filter((r) => r.pTitle > 0)
    expect(title).toHaveLength(1)
    expect([1, 4]).toContain(title[0].id)
    expect(title[0].pTitle).toBe(1)
  })

  it('never lets the lower half climb into the upper half', () => {
    const teams = [
      team(1, 10, 'efri'), team(2, 10, 'efri'), team(3, 60, 'nedri'), team(4, 60, 'nedri'),
    ]
    const out = simulateRest(teams, [fixture(1, 3, 4)], new Map(), { runs: 300 })
    // a hundred points would not lift them: the halves never meet again
    for (const id of [3, 4]) expect(out.find((r) => r.id === id)!.pTitle).toBe(0)
    expect(out.find((r) => r.id === 1)!.pTitle + out.find((r) => r.id === 2)!.pTitle).toBeCloseTo(1, 5)
  })

  it('gives the same answer twice with the same seed', () => {
    const teams = [team(1, 20), team(2, 18), team(3, 15), team(4, 12)]
    const fixtures = [fixture(1, 1, 2), fixture(2, 3, 4), fixture(3, 1, 3)]
    const run = () => simulateRest(teams, fixtures, new Map(), { runs: 500, seed: 7 }).map((r) => r.projectedPoints)
    expect(run()).toEqual(run())
  })

  it('counts what a chosen result is worth', () => {
    expect(pickPoints({ kind: 'score', home: 2, away: 2 })).toEqual([1, 1])
    expect(pickPoints({ kind: 'outcome', pick: 'home' })).toEqual([3, 0])
    expect(pickPoints(undefined)).toEqual([0, 0])
  })
})
