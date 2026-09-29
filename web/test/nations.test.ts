import { describe, expect, it } from 'vitest'
import { nationsPredict, parseFixtures, parseResults } from '../src/lib/nations'

const teams = new Map([['IS', 'Iceland'], ['EE', 'Estonia'], ['LU', 'Luxembourg'], ['AR', 'Argentina']])
const tourn = new Map([['ENC', 'European Nations League C'], ['F', 'Friendly']])

describe('eloratings parsing', () => {
  it('turns post-match ratings back into pre-match ones', () => {
    const [r] = parseResults('2026\t09\t26\tIS\tEE\t1\t1\tENC\t\t-14\t1554\t1374\t−4\t+7\t72\t112', teams, tourn)
    expect(r.key).toBe('2026-09-26:IS:EE')
    expect(r.elo_home).toBe(1568)
    expect(r.elo_away).toBe(1360)
    expect(r.neutral).toBe(false)
    expect([r.home_goals, r.away_goals]).toEqual([1, 1])
  })

  it('marks a venue outside the home country as neutral', () => {
    const [r] = parseResults('2026\t06\t09\tAR\tIS\t3\t0\tF\tUS\t1\t2115\t1568\t0\t−1\t2\t71', teams, tourn)
    expect(r.neutral).toBe(true)
    expect(r.venue_code).toBe('US')
  })

  it('reads fixtures and skips unscheduled days', () => {
    const rows = parseFixtures(
      '2026\t09\t29\tLU\tIS\tENC\tLU\t87\t74\t1476\t1554\t53\n2027\t03\t00\tIS\tEE\tF\t\t74\t110\t1554\t1374\t70',
      teams, tourn,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].home_goals).toBeNull()
    expect(rows[0].p_home! + rows[0].p_draw! + rows[0].p_away!).toBeCloseTo(1, 6)
  })
})

describe('nationsPredict', () => {
  it('gives the home side the edge between equal teams, and none on a neutral ground', () => {
    const home = nationsPredict(1500, 1500, false)
    expect(home.pHome).toBeGreaterThan(home.pAway)
    const neutral = nationsPredict(1500, 1500, true)
    expect(neutral.pHome).toBeCloseTo(neutral.pAway, 6)
  })
})
