import { describe, it, expect } from 'vitest'
import { seasonCalendar } from '../src/lib/nfl/calendar'
import type { NflGame } from '../src/lib/nfl/types'

const game = (id: string, kickoff: string, scores: [number | null, number | null] = [null, null]): NflGame => ({
  game_id: id, season: 2026, game_type: 'REG', week: 7, kickoff, time_tbd: false, away: 'NE', home: 'CHI',
  away_score: scores[0], home_score: scores[1], overtime: false, neutral: false, spread_line: 3, total_line: 50.5,
  away_ml: 130, home_ml: -150, div_game: false, stadium: 'Soldier Field', roof: 'outdoors', away_qb: null, home_qb: null,
} as NflGame)

describe('seasonCalendar', () => {
  const ics = seasonCalendar('Snertimark - CHI', [game('2026_07_NE_CHI', '2026-10-23T00:15:00Z'), game('2026_06_X', '2026-10-16T17:00:00Z', [21, 24])], 'https://www.snertimark.net',
    { '2026_07_NE_CHI': { channel: 'Sýn Sport 2', odds: 'NE 2,30 · CHI 1,65', model: 'CHI 52%' } }, new Date('2026-10-20T10:00:00Z'))

  it('is a calendar with one event per game in kickoff order, times in UTC', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics.indexOf('2026_06_X')).toBeLessThan(ics.indexOf('2026_07_NE_CHI'))
    expect(ics).toContain('DTSTART:20261023T001500Z')
    expect(ics).toContain('DTEND:20261023T034500Z')
  })
  it('shows the score once played and the channel and prices before', () => {
    expect(ics).toContain('SUMMARY:NE 21-24 CHI')
    expect(ics).toContain('SUMMARY:NE @ CHI')
    expect(ics.replace(/\r\n /g, '')).toContain('Í sjónvarpinu: Sýn Sport 2\\nStuðlar: NE 2\\,30 · CHI 1\\,65')
  })
  it('folds every line to at most 75 bytes', () => {
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })
})
