import { describe, it, expect } from 'vitest'
import { runBelt, computeH2H, computeAllTime, type BeltMatch } from '../src/lib/belt'

const m = (
  order: number, home: number, away: number, hg: number, ag: number, season = 1912,
): BeltMatch => ({
  matchId: order, season, date: `${season}-06-${String(order % 28 + 1).padStart(2, '0')}T14:00:00Z`,
  order, homeTeam: home, awayTeam: away, homeGoals: hg, awayGoals: ag,
})

describe('runBelt', () => {
  it('first winner takes the belt; a drawn opener leaves it unclaimed', () => {
    const res = runBelt([m(1, 1, 2, 0, 0), m(2, 2, 3, 2, 0)])
    expect(res.history).toHaveLength(1)
    expect(res.currentHolder).toBe(2)
  })

  it('holder keeps on draw, loses on defeat — even in matches not involving others', () => {
    const res = runBelt([
      m(1, 1, 2, 1, 0), // 1 takes belt
      m(2, 3, 4, 5, 0), // no holder involved → ignored
      m(3, 1, 3, 2, 2), // draw → 1 keeps
      m(4, 3, 1, 1, 0), // 3 beats holder → belt moves
    ])
    expect(res.currentHolder).toBe(3)
    expect(res.history.filter((h) => h.taken)).toHaveLength(2) // initial claim + steal
    expect(res.defenses.get(1)).toBe(1)
  })

  it('counts reigns, title wins and tracks the longest reign', () => {
    const res = runBelt([
      m(1, 1, 2, 1, 0), // 1 claims
      m(2, 1, 3, 1, 1), // defense
      m(3, 1, 4, 2, 1), // defense
      m(4, 2, 1, 3, 0), // 2 steals
      m(5, 2, 3, 0, 1), // 3 steals
    ])
    expect(res.reigns.get(1)).toBe(1)
    expect(res.reigns.get(2)).toBe(1)
    expect(res.reigns.get(3)).toBe(1)
    expect(res.titleWins.get(1)).toBe(2) // initial claim + the won defense (draw defense is no win)
    expect(res.longestReign?.holder).toBe(1)
    expect(res.longestReign?.matches).toBe(3)
  })
})

describe('computeH2H', () => {
  it('aggregates a pair symmetrically regardless of venue', () => {
    const res = computeH2H([m(1, 1, 2, 3, 1), m(2, 2, 1, 2, 2), m(3, 1, 2, 0, 5)])
    expect(res).toHaveLength(1)
    const p = res[0]
    expect(p.teamA).toBe(1)
    expect(p.aWins).toBe(1)
    expect(p.bWins).toBe(1)
    expect(p.draws).toBe(1)
    expect(p.aGoals).toBe(5)
    expect(p.bGoals).toBe(8)
    expect(p.biggest?.ag).toBe(5)
  })
})

describe('computeAllTime', () => {
  it('uniform 3-point table with season spans', () => {
    const res = computeAllTime([m(1, 1, 2, 2, 0, 1912), m(2, 2, 1, 1, 1, 1913)])
    const t1 = res.find((r) => r.teamId === 1)!
    expect(t1.points3).toBe(4)
    expect(t1.seasons).toBe(2)
    expect(t1.firstSeason).toBe(1912)
    expect(t1.lastSeason).toBe(1913)
    expect(res[0].teamId).toBe(1) // sorted by points
  })
})
