import { describe, it, expect } from 'vitest'
import { excitement, progressOf, wpRows } from '../src/lib/nfl/winChart'

describe('win chart helpers', () => {
  it('places a game in regulation from 0 to 1', () => {
    expect(progressOf(1, '15:00', 'Q1')).toBeCloseTo(0)
    expect(progressOf(null, null, 'HT')).toBeCloseTo(0.5)
    expect(progressOf(4, '00:00', 'Q4')).toBeCloseTo(1)
    expect(progressOf(null, null, 'FT')).toBe(1)
  })
  it('keeps only games with a chance that are on or over', () => {
    const base = { quarter: 2, clock: '07:30', status: 'Q2', homeScore: 7, awayScore: 3 }
    const rows = wpRows([{ ...base, game_id: 'a', live: true, final: false, pHome: 0.61 }, { ...base, game_id: 'b', live: false, final: false, pHome: 0.5 }, { ...base, game_id: 'c', live: true, final: false, pHome: null }])
    expect(rows.map((r) => r.game_id)).toEqual(['a'])
    expect(rows[0].progress).toBeCloseTo(0.375)
  })
  it('scores a seesaw above a blowout', () => {
    expect(excitement([{ p_home: 0.5 }, { p_home: 0.8 }, { p_home: 0.3 }, { p_home: 0.7 }])).toBeGreaterThan(excitement([{ p_home: 0.5 }, { p_home: 0.7 }, { p_home: 0.9 }, { p_home: 0.99 }]))
  })
})
