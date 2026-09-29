import { describe, it, expect } from 'vitest'
import { parseCalendar, checkMapping, clubName, CLUB_NAMES } from '../src/lib/fixtureCalendar'

const SAMPLE = `= English Championship 2026/27

# Date       Fri Aug 14 2026 - Sat May 1 2027 (260d)
# Teams      24
# Matches    552


▪ Matchday 1
  Fri Aug 14 2026
    20:00  Wolverhampton Wanderers FC v Blackburn Rovers FC      2-2 (1-1)
  Sat Aug 15
    12:30  Bolton Wanderers FC     v Preston North End FC     2-1 (2-0)
           Bristol City FC         v Millwall FC              0-2 (0-1)
    17:30  Sheffield United FC     v Birmingham City FC       0-0

▪ Matchday 2
  Sat Jan 9 2027
    15:00  Millwall FC             v Bolton Wanderers FC
           Norwich City FC         v Stoke City FC            [postponed]
`

describe('parseCalendar', () => {
  const ms = parseCalendar(SAMPLE)

  it('reads every match and no headings', () => {
    expect(ms).toHaveLength(6)
  })

  it('carries the year forward to dates that omit it', () => {
    expect(ms[0].date).toBe('2026-08-14')
    expect(ms[1].date).toBe('2026-08-15')
    expect(ms[3].date).toBe('2026-08-15')
  })

  it('picks up a new year when one is written', () => {
    expect(ms[4].date).toBe('2027-01-09')
  })

  it('carries the kick-off time down to matches that leave it blank', () => {
    expect(ms[1].time).toBe('12:30')
    expect(ms[2].time).toBe('12:30')
    expect(ms[3].time).toBe('17:30')
  })

  it('knows which matches already have a result', () => {
    expect(ms.slice(0, 4).every((m) => m.played)).toBe(true)
    expect(ms[4].played).toBe(false)
  })

  it('keeps the score out of the away club’s name', () => {
    expect(ms[0].away).toBe('Blackburn Rovers FC')
    expect(ms[3].away).toBe('Birmingham City FC')
  })

  // A postponed match will be played, but nobody knows when yet.
  it('leaves a postponed match without a date rather than the wrong one', () => {
    const p = ms[5]
    expect(p.home).toBe('Norwich City FC')
    expect(p.away).toBe('Stoke City FC')
    expect(p.date).toBeNull()
    expect(p.time).toBeNull()
  })

  it('tracks the matchday', () => {
    expect(ms[0].matchday).toBe(1)
    expect(ms[4].matchday).toBe(2)
  })
})

describe('clubName', () => {
  it('uses the written mapping before anything else', () => {
    expect(clubName('Paris Saint-Germain FC')).toBe('Paris SG')
    expect(clubName('FC Internazionale Milano')).toBe('Inter')
    expect(clubName('Borussia Mönchengladbach')).toBe("M'gladbach")
  })

  it('leaves a club that already matches alone', () => {
    expect(clubName('Millwall FC', new Set(['Millwall FC']))).toBe('Millwall FC')
  })

  it('never maps two clubs onto one', () => {
    const targets = Object.values(CLUB_NAMES)
    expect(new Set(targets).size).toBe(targets.length)
  })
})

// The first attempt matched on normalised substrings and put Paris
// Saint-Germain on Paris FC. checkMapping exists so that cannot ship.
describe('checkMapping', () => {
  const ours = ['Paris SG', 'Paris FC', 'Lyon']

  it('accepts a mapping that pairs every club exactly once', () => {
    const r = checkMapping(['Paris Saint-Germain FC', 'Paris FC', 'Olympique Lyonnais'], ours)
    expect(r.ok).toBe(true)
    expect(r.mapped.get('Paris Saint-Germain FC')).toBe('Paris SG')
  })

  it('refuses a calendar that leaves one of our clubs unaccounted for', () => {
    const r = checkMapping(['Paris Saint-Germain FC', 'Paris FC'], ours)
    expect(r.ok).toBe(false)
    expect(r.unused).toContain('Lyon')
  })

  it('refuses a club it cannot place', () => {
    const r = checkMapping(['Paris Saint-Germain FC', 'Paris FC', 'Olympique Lyonnais', 'Nýtt FC'], ours)
    expect(r.ok).toBe(false)
    expect(r.unmapped).toContain('Nýtt FC')
  })

  it('names the two clubs when it catches a collision', () => {
    const r = checkMapping(['Paris FC', 'Paris FC '], ['Paris FC', 'Paris SG'])
    expect(r.ok).toBe(false)
    expect(r.collisions.join(' ')).toContain('Paris FC')
  })
})
