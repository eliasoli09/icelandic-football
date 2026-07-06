import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEvents, validateEvents } from '../src/lib/ksiEvents'

const html = readFileSync(
  join(__dirname, 'fixtures', 'match_7041400.html'),
  'utf8',
)

// Fixture: ÍBV 1–0 Valur, 4 July 2026
describe('parseEvents', () => {
  const events = parseEvents(html)

  it('finds exactly one goal, and it belongs to the home side (ÍBV won 1-0)', () => {
    const goals = events.filter((e) =>
      ['goal', 'penalty'].includes(e.type),
    )
    expect(goals).toHaveLength(1)
    expect(goals[0].side).toBe('home')
  })

  it('finds 6 yellow cards and 1 red card', () => {
    expect(events.filter((e) => e.type === 'yellow')).toHaveLength(6)
    const reds = events.filter((e) => e.type === 'red')
    expect(reds).toHaveLength(1)
    expect(reds[0].playerName).toBe('Hólmar Örn Eyjólfsson')
  })

  it('parses substitutions as paired in/out events with player ids', () => {
    const subs = events.filter((e) => e.type.startsWith('sub'))
    expect(subs.length).toBe(16) // 8 sub blocks × (in + out)
    expect(subs.every((e) => e.playerName.length > 1)).toBe(true)
  })

  it('attaches minutes and player KSÍ ids', () => {
    const veldman = events.find((e) => e.playerName === 'Myles A Veldman')!
    expect(veldman.minute).toBe(13)
    expect(veldman.playerKsiId).toBe(89450)
  })
})

describe('validateEvents', () => {
  it('accepts when parsed goals match the final score', () => {
    const events = parseEvents(html)
    const warnings = validateEvents(events, { homeGoals: 1, awayGoals: 0 })
    expect(warnings).toHaveLength(0)
  })

  it('warns when goal counts disagree with the score', () => {
    const events = parseEvents(html)
    const warnings = validateEvents(events, { homeGoals: 2, awayGoals: 0 })
    expect(warnings.length).toBeGreaterThan(0)
  })
})
