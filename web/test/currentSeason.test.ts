import { describe, it, expect } from 'vitest'
import { seasonForDate, DIVISIONS } from '../src/lib/currentSeason'
import { feedMatchId, FEED_ID_OFFSET } from '../src/lib/leagues'

// A European season is named for the year it started and runs into May, so
// half of it falls in the following calendar year. Getting this wrong is what
// left the site showing 2025/26 tables in September 2026.
describe('seasonForDate', () => {
  it('names a season for the year it kicked off', () => {
    expect(seasonForDate(new Date('2026-08-21'))).toBe(2026)
    expect(seasonForDate(new Date('2026-09-10'))).toBe(2026)
    expect(seasonForDate(new Date('2026-12-26'))).toBe(2026)
  })

  it('keeps the spring half with the season that started the year before', () => {
    expect(seasonForDate(new Date('2027-01-02'))).toBe(2026)
    expect(seasonForDate(new Date('2027-05-24'))).toBe(2026)
  })

  it('turns over in July, between the last match and the first', () => {
    expect(seasonForDate(new Date('2027-06-30'))).toBe(2026)
    expect(seasonForDate(new Date('2027-07-01'))).toBe(2027)
  })
})

describe('feed ids for the live season', () => {
  const idx = DIVISIONS.map((d) => d.idx)

  it('gives every league its own slot', () => {
    expect(new Set(idx).size).toBe(DIVISIONS.length)
  })

  // Ids are built from the pairing, not the row, so an update mid-season
  // rewrites the same row instead of adding a second copy of the match.
  it('keeps a 24-club league inside its own 100k band', () => {
    const pair = (h: number, a: number) => feedMatchId(2026, 5, h * 1000 + a)
    const lowest = feedMatchId(2026, 5, 0)
    const highest = pair(23, 23)
    expect(highest - lowest).toBeLessThan(100_000)
    expect(highest).toBeLessThan(feedMatchId(2026, 6, 0))
    expect(lowest).toBeGreaterThan(FEED_ID_OFFSET)
  })

  it('gives each pairing in a league its own id', () => {
    const seen = new Set<number>()
    for (let h = 0; h < 24; h++)
      for (let a = 0; a < 24; a++) if (h !== a) seen.add(feedMatchId(2026, 5, h * 1000 + a))
    expect(seen.size).toBe(24 * 23)
  })
})
