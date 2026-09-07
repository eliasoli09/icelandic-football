import { describe, it, expect } from 'vitest'
import { splitGroups, applySplit } from '../src/lib/split'

const fx = (phase: string, home: number, away: number) => ({
  phase, home_team: home, away_team: away,
})

// Besta deild 2026: after 22 rounds the league locks into a top 6 and a
// bottom 6. Points carry over, but the groups do not mix again — 7th place
// is the ceiling for the lower group no matter how many points it wins.
const splitFixtures = [
  ...[[1, 2], [3, 4], [5, 6]].map(([h, a]) => fx('efri', h, a)),
  ...[[7, 8], [9, 10], [11, 12]].map(([h, a]) => fx('nedri', h, a)),
]

describe('splitGroups', () => {
  it('reads group membership off the published split fixtures', () => {
    const g = splitGroups(splitFixtures)!
    expect(g.get(1)).toBe('efri')
    expect(g.get(6)).toBe('efri')
    expect(g.get(7)).toBe('nedri')
    expect(g.get(12)).toBe('nedri')
    expect(g.size).toBe(12)
  })

  it('returns null before the split is published', () => {
    expect(splitGroups([fx('main', 1, 2), fx('main', 3, 4)])).toBeNull()
  })

  it('ignores a knockout playoff (lengjudeild umspil is not a 6/6 split)', () => {
    expect(splitGroups([fx('main', 1, 2), fx('umspil', 3, 4)])).toBeNull()
  })
})

describe('applySplit', () => {
  const table = [
    { teamId: 1, points: 53 }, { teamId: 2, points: 45 }, { teamId: 3, points: 44 },
    { teamId: 4, points: 30 }, { teamId: 5, points: 30 }, { teamId: 6, points: 28 },
    { teamId: 7, points: 28 }, { teamId: 8, points: 27 }, { teamId: 9, points: 21 },
    { teamId: 10, points: 21 }, { teamId: 11, points: 20 }, { teamId: 12, points: 18 },
  ]

  it('keeps the lower group below the upper group even on more points', () => {
    // team 7 has run up 60 points in the lower group — still 7th
    const hot = table.map((r) => (r.teamId === 7 ? { ...r, points: 60 } : r))
    const out = applySplit(hot, splitGroups(splitFixtures))
    expect(out.map((r) => r.teamId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(out[6].group).toBe('nedri')
  })

  it('tags every row with its group', () => {
    const out = applySplit(table, splitGroups(splitFixtures))
    expect(out.slice(0, 6).every((r) => r.group === 'efri')).toBe(true)
    expect(out.slice(6).every((r) => r.group === 'nedri')).toBe(true)
  })

  it('leaves the table untouched when there is no split', () => {
    const out = applySplit(table, null)
    expect(out.map((r) => r.teamId)).toEqual(table.map((r) => r.teamId))
    expect(out.every((r) => r.group === null)).toBe(true)
  })
})
