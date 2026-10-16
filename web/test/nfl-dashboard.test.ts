import { describe, expect, it } from 'vitest'
import { dashboardRows, divisionStrength, selectDashboardRows } from '../src/lib/nfl/dashboard'
import type { NflGame, NflTeam } from '../src/lib/nfl/types'
import type { Forecast } from '../src/lib/nfl/forecast'
const teams = [
  { abbr: 'A', franchise: 'A', name: 'Alpha', conference: 'AFC', division: 'West' },
  { abbr: 'B', franchise: 'B', name: 'Beta', conference: 'NFC', division: 'East' },
  { abbr: 'C', franchise: 'C', name: 'Gamma', conference: 'AFC', division: 'West' },
] as NflTeam[]
const game = (id: string, home: number | null, away: number | null, type = 'REG') => ({ game_id: id, home: 'A', away: 'B', home_score: home, away_score: away, game_type: type }) as NflGame
const forecast = { future: { pHome: .7 } as Forecast }
describe('NFL dashboard', () => {
  it('adds actual wins to expected remaining regular-season wins, excluding ties and postseason', () => {
    const rows = dashboardRows(teams, [game('won', 20, 7), game('tie', 7, 7), game('future', null, null), game('post', 28, 7, 'WC')], new Map([['A', 1600], ['B', 1400]]), forecast, {})
    expect(rows.find(r => r.abbr === 'A')?.wins).toBeCloseTo(1.7)
    expect(rows.find(r => r.abbr === 'B')?.wins).toBeCloseTo(.3)
    expect(rows.find(r => r.abbr === 'A')?.playoffs).toBeNull()
    expect(rows.find(r => r.abbr === 'C')?.wins).toBeNull()
  })
  it('does not silently count an unforecast remaining game as zero wins', () => {
    expect(dashboardRows(teams, [game('future', null, null)], new Map(), {}, {})[0].wins).toBeNull()
  })
  it('filters conferences, sorts title odds, and calculates mean division Elo', () => {
    const rows = dashboardRows(teams, [], new Map([['A', 1600], ['B', 1700], ['C', 1400]]), {}, {})
    rows[0].title = .1
    rows[1].title = .3
    expect(selectDashboardRows(rows, 'AFC', 'elo', true).map(r => r.abbr)).toEqual(['A', 'C'])
    expect(selectDashboardRows(rows, 'Super Bowl', 'title', true)[0].abbr).toBe('A')
    expect(divisionStrength(rows).find(d => d.name === 'AFC West')?.elo).toBe(1500)
    expect(rows.map(r => r.abbr)).toEqual(['B', 'A', 'C'])
  })
})
