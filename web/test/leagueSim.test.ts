import { describe, expect, it } from 'vitest'
import { ratesFrom, simulateWithUncertainty, tableFrom, XG_WEIGHT, type PlayedMatch } from '../src/lib/leagueSim'
import { simulateSeason, type SimTeamState } from '../src/lib/simulate'

const match = (home: number, away: number, hg: number, ag: number, hxg: number | null = null, axg: number | null = null): PlayedMatch =>
  ({ home_team: home, away_team: away, home_goals: hg, away_goals: ag, home_xg: hxg, away_xg: axg, date: '2026-05-01' })

describe('what a club is judged on', () => {
  it('leans on expected goals but keeps some weight on the goals themselves', () => {
    // scored one, deserved three: the rate should sit nearer the three
    const rates = ratesFrom([match(1, 2, 1, 0, 3, 0.5)])
    const home = rates.get(1)!
    expect(home.gfPerGame).toBeCloseTo(XG_WEIGHT * 3 + (1 - XG_WEIGHT) * 1, 6)
    expect(home.gaPerGame).toBeCloseTo(XG_WEIGHT * 0.5, 6)
    expect(home.games).toBe(1)
    expect(home.form).toBe('W')
  })

  it('falls back to goals where a match carries no expected goals', () => {
    const rates = ratesFrom([match(1, 2, 2, 1)])
    expect(rates.get(1)!.gfPerGame).toBe(2)
    expect(rates.get(2)!.gfPerGame).toBe(1)
  })

  it('reads the table from the results alone, not from what was deserved', () => {
    const table = tableFrom([match(1, 2, 1, 0, 0.2, 2.9), match(2, 1, 1, 1)])
    expect(table.get(1)).toEqual({ points: 4, gf: 2, ga: 1, played: 2 })
    expect(table.get(2)).toEqual({ points: 1, gf: 1, ga: 2, played: 2 })
  })

  it('keeps the newest five results first, as the form string is read', () => {
    const played = [match(1, 2, 3, 0), match(2, 1, 2, 0), match(1, 2, 0, 0)]
    expect(ratesFrom(played).get(1)!.form).toBe('DLW')
  })
})

describe('how many go down', () => {
  const league = (n: number, downSlots: number) => {
    const teams: SimTeamState[] = Array.from({ length: n }, (_, i) => ({
      team: `t${i}`, elo: 1500 + (n - i) * 40, rates: null,
      points: (n - i) * 3, goalsFor: 10, goalsAgainst: 10, played: 10,
    }))
    return simulateSeason(teams, [], 400, 7, { split: false, upSlots: 4, downSlots })
  }

  it('counts the bottom three where three are relegated, not the bottom two', () => {
    const two = league(20, 2), three = league(20, 3)
    const risk = (rows: ReturnType<typeof league>) => rows.reduce((sum, r) => sum + r.pRelegation, 0)
    // every run relegates exactly that many clubs, so the risk adds up to it
    expect(risk(two)).toBeCloseTo(2, 6)
    expect(risk(three)).toBeCloseTo(3, 6)
    // and it is the clubs at the foot who carry it
    expect(three.at(-1)!.pRelegation).toBe(1)
    expect(three[0].pRelegation).toBe(0)
  })

  it('still sends two down when nobody says otherwise', () => {
    const rows = simulateSeason(
      Array.from({ length: 12 }, (_, i) => ({ team: `t${i}`, elo: 1500, rates: null, points: 20 - i, goalsFor: 5, goalsAgainst: 5, played: 22 })),
      [], 300, 3, { split: false },
    )
    expect(rows.reduce((sum, r) => sum + r.pRelegation, 0)).toBeCloseTo(2, 6)
  })
})

describe('how sure the season may sound', () => {
  const field = (games: number) => {
    const teams: SimTeamState[] = Array.from({ length: 6 }, (_, i) => ({
      team: `t${i}`,
      elo: 1500,
      // the leader scores twice what the rest do, on the same number of games
      rates: { gfPerGame: i === 0 ? 3 : 1.5, gaPerGame: 1, games, form: '' },
      points: i === 0 ? 3 * games : games, goalsFor: 10, goalsAgainst: 10, played: games,
    }))
    const fixtures = teams.flatMap((h) => teams.filter((a) => a.team !== h.team).map((a) => ({ home: h.team, away: a.team })))
    return simulateWithUncertainty(teams, fixtures, { split: false, upSlots: 2, downSlots: 2 }, 10, 200)
  }

  it('is less certain off seven games than off twenty-five', () => {
    const early = field(7)[0].pTitle
    const late = field(25)[0].pTitle
    expect(late).toBeGreaterThan(early)
    expect(early).toBeGreaterThan(0.3)
  })

  it('still adds up to one title, and to the places that go down', () => {
    const rows = field(12)
    expect(rows.reduce((sum, r) => sum + r.pTitle, 0)).toBeCloseTo(1, 4)
    expect(rows.reduce((sum, r) => sum + r.pRelegation, 0)).toBeCloseTo(2, 4)
  })

  it('gives the same answer twice', () => {
    expect(field(9).map((r) => r.pTitle)).toEqual(field(9).map((r) => r.pTitle))
  })
})
