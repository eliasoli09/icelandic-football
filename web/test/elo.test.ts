import { describe, it, expect } from 'vitest'
import { runElo, currentRatings, BASE, type EloMatch } from '../src/lib/elo'

const m = (
  home: string,
  away: string,
  hg: number,
  ag: number,
  order: number,
  league: 'besta' | 'lengjudeild' = 'besta',
): EloMatch => ({
  matchId: order,
  order,
  date: null,
  league,
  home,
  away,
  homeGoals: hg,
  awayGoals: ag,
})

describe('runElo', () => {
  it('home win between equal teams moves points from away to home', () => {
    const recs = runElo([m('A', 'B', 2, 1, 1)])
    const a = recs.find((r) => r.team === 'A')!
    const b = recs.find((r) => r.team === 'B')!
    expect(a.eloBefore).toBe(BASE.besta)
    expect(a.eloAfter).toBeGreaterThan(a.eloBefore)
    expect(b.eloAfter).toBeLessThan(b.eloBefore)
    // zero-sum
    expect(a.eloAfter - a.eloBefore).toBeCloseTo(-(b.eloAfter - b.eloBefore), 6)
  })

  it('an away draw at a much stronger team gains points', () => {
    // strengthen A first with several wins
    const warmup = [1, 2, 3, 4, 5].map((i) => m('A', 'C', 3, 0, i))
    const recs = runElo([...warmup, m('A', 'B', 1, 1, 6)])
    const last = recs.filter((r) => r.team === 'B').pop()!
    expect(last.eloAfter).toBeGreaterThan(last.eloBefore)
  })

  it('a 4-goal win moves more Elo than a 1-goal win', () => {
    const big = runElo([m('A', 'B', 4, 0, 1)])
    const small = runElo([m('A', 'B', 1, 0, 1)])
    const gain = (rs: typeof big) =>
      rs.find((r) => r.team === 'A')!.eloAfter - BASE.besta
    expect(gain(big)).toBeGreaterThan(gain(small))
  })

  it('teams first seen in lengjudeild start at the lower baseline', () => {
    const recs = runElo([m('X', 'Y', 1, 0, 1, 'lengjudeild')])
    expect(recs.find((r) => r.team === 'X')!.eloBefore).toBe(BASE.lengjudeild)
  })

  it('currentRatings returns the latest rating per team', () => {
    const recs = runElo([m('A', 'B', 2, 0, 1), m('B', 'A', 2, 0, 2)])
    const cur = currentRatings(recs)
    expect(cur.size).toBe(2)
    // A won then lost by same margin vs same opponent — near-symmetric
    expect(Math.abs(cur.get('A')! - cur.get('B')!)).toBeLessThan(10)
  })
})
