import { describe, it, expect } from 'vitest'
import { easternDate, fractionLeft, liveWindow, liveWinProb, parseEvents, parseGames, teamAbbr } from '../src/lib/nfl/live'

// the shape api-sports documents for /games (nested game, teams, per-quarter scores)
const reply = {
  get: 'games', results: 2, response: [
    { game: { id: 7001, week: 'Week 7', date: { date: '2026-10-22', time: '20:15' }, status: { short: 'Q3', long: 'Third Quarter', timer: '08:12' } },
      league: { id: 1, season: '2026' }, teams: { home: { id: 1, name: 'Chicago Bears' }, away: { id: 2, name: 'New England Patriots' } },
      scores: { home: { quarter_1: 7, quarter_2: 3, quarter_3: 0, quarter_4: null, overtime: null, total: 10 }, away: { quarter_1: 0, quarter_2: 14, quarter_3: 3, quarter_4: null, overtime: null, total: 17 } } },
    { game: { id: 7002, status: { short: 'NS', long: 'Not Started', timer: null } },
      teams: { home: { name: 'Las Vegas Raiders' }, away: { name: 'Kansas City Chiefs' } }, scores: { home: { total: null }, away: { total: null } } },
    { junk: true },
  ],
}

describe('parseGames', () => {
  const games = parseGames(reply)
  it('les staðu, leikhluta og klukku; sleppir rusli', () => {
    expect(games).toHaveLength(2)
    expect(games[0]).toMatchObject({ apiId: 7001, home: 'Chicago Bears', away: 'New England Patriots', homeScore: 10, awayScore: 17, quarter: 3, clock: '08:12', live: true, final: false })
    expect(games[1]).toMatchObject({ homeScore: null, quarter: null, clock: null, live: false })
  })
  it('tómt eða villa frá veitunni gefur ekkert', () => {
    expect(parseGames({ errors: { token: 'Missing application key' }, response: [] })).toEqual([])
    expect(parseGames(null)).toEqual([])
  })
})

describe('parseEvents', () => {
  it('atvik með stöðu', () => {
    const e = parseEvents({ response: [{ quarter: 'Q2', minute: '04:31', team: { name: 'New England Patriots' }, player: { name: 'Drake Maye' }, type: 'TD', comment: 'Drake Maye 12 yd run', score: { home: 10, away: 14 } }] })
    expect(e[0]).toEqual({ quarter: 'Q2', minute: '04:31', team: 'New England Patriots', player: 'Drake Maye', type: 'TD', comment: 'Drake Maye 12 yd run', homeScore: 10, awayScore: 14 })
  })
})

describe('teamAbbr', () => {
  const teams = [{ abbr: 'CHI', name: 'Chicago Bears' }, { abbr: 'NE', name: 'New England Patriots' }]
  it('fullt nafn, óháð hástöfum', () => {
    expect(teamAbbr('Chicago Bears', teams)).toBe('CHI')
    expect(teamAbbr('new england patriots', teams)).toBe('NE')
    expect(teamAbbr('Springfield Atoms', teams)).toBeNull()
  })
})

describe('liveWindow og easternDate', () => {
  const g = (kickoff: string, played = false) => ({ kickoff, home_score: played ? 20 : null, away_score: played ? 17 : null })
  it('frá upphafi til 4,5 klst eftir, ekki spilaðir leikir', () => {
    const now = new Date('2026-10-18T20:00:00Z')
    expect(liveWindow([g('2026-10-18T17:00:00Z'), g('2026-10-18T13:00:00Z'), g('2026-10-18T21:00:00Z'), g('2026-10-18T19:00:00Z', true)], now)).toHaveLength(1)
  })
  it('sunnudagskvöldsleikur kl. 00:20 að UTC er sunnudagur að austurtíma', () => {
    expect(easternDate('2026-10-19T00:20:00Z')).toBe('2026-10-18')
    expect(easternDate('2026-10-18T17:00:00Z')).toBe('2026-10-18')
  })
})

describe('líkur í beinni', () => {
  it('í byrjun eins og fyrir leik, í lok 1 / ½ / 0', () => {
    expect(liveWinProb(0, 0, 0, 1)).toBeCloseTo(0.5, 9)
    expect(liveWinProb(3, 0, 0, 1)).toBeCloseTo(0.588, 2)
    expect(liveWinProb(-3, 24, 21, 0)).toBe(1)
    expect(liveWinProb(10, 17, 17, 0)).toBe(0.5)
  })
  it('forysta vegur meira eftir því sem minna er eftir', () => {
    const early = liveWinProb(0, 7, 0, 0.9), late = liveWinProb(0, 7, 0, 0.1)
    expect(early).toBeGreaterThan(0.5)
    expect(late).toBeGreaterThan(early)
  })
  it('hlutfall leiktíma eftir', () => {
    expect(fractionLeft(null, null, 'NS')).toBe(1)
    expect(fractionLeft(null, null, 'HT')).toBe(0.5)
    expect(fractionLeft(3, '07:30', 'Q3')).toBeCloseTo(22.5 / 60, 9)
    expect(fractionLeft(null, null, 'FT')).toBe(0)
  })
})
