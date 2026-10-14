import { describe, it, expect } from 'vitest'
import { defaultWeek, weekLabel, weekTypes } from '../src/lib/nfl/week'
import type { NflGame } from '../src/lib/nfl/types'

const g = (week: number, kickoff: string, played: boolean, game_type: NflGame['game_type'] = 'REG') =>
  ({ week, kickoff, game_type, home_score: played ? 20 : null, away_score: played ? 17 : null }) as NflGame

const season = [
  g(1, '2026-09-10T00:20:00.000Z', true),
  g(1, '2026-09-13T17:00:00.000Z', true),
  g(2, '2026-09-17T00:15:00.000Z', true),
  g(2, '2026-09-20T17:00:00.000Z', false),
  g(3, '2026-09-27T17:00:00.000Z', false),
]

describe('defaultWeek', () => {
  it('fyrir tímabil: vika 1', () => {
    expect(defaultWeek(season.map((x) => ({ ...x, home_score: null, away_score: null })), new Date('2026-08-01'))).toBe(1)
  })
  it('í miðri viku: vikan með næsta óspilaða leik', () => {
    expect(defaultWeek(season, new Date('2026-09-18T12:00:00Z'))).toBe(2)
  })
  it('gamall leikur án úrslita festir ekki vikuna', () => {
    expect(defaultWeek(season, new Date('2026-09-25T12:00:00Z'))).toBe(3)
  })
  it('eftir síðasta leik: síðasta spilaða vikan', () => {
    const done = season.map((x) => ({ ...x, home_score: 1, away_score: 0 }))
    expect(defaultWeek(done, new Date('2026-12-01'))).toBe(3)
  })
  it('tómt tímabil: vika 1', () => {
    expect(defaultWeek([], new Date())).toBe(1)
  })
})

describe('weekLabel', () => {
  it('nefnir umferðir úrslitakeppninnar eftir tegund, ekki númeri', () => {
    expect(weekLabel('REG', 6)).toBe('Vika 6')
    expect(weekLabel('WC', 19)).toBe('Umspil')
    expect(weekLabel('DIV', 20)).toBe('8 liða úrslit')
    expect(weekLabel('CON', 21)).toBe('Undanúrslit')
    expect(weekLabel('SB', 22)).toBe('Super Bowl')
  })
  it('weekTypes raðar vikum og les tegundina úr leikjunum', () => {
    expect(weekTypes([g(19, 'x', true, 'WC'), g(1, 'y', true)])).toEqual([[1, 'REG'], [19, 'WC']])
  })
})
