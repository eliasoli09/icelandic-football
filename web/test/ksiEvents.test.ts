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

// Fixture: Fram 1-2 KR, 10 Oct 2026. Since Oct 2026 KSÍ pads the minute with
// whitespace (`> 8 <span>’`), which the old regex read as minute 0, and marks
// an own goal with a red ball (`text-red-other`) in the BENEFITING team's column.
describe('parseEvents on the Oct 2026 markup', () => {
  const events = parseEvents(
    readFileSync(join(__dirname, 'fixtures', 'match_7100156.html'), 'utf8'),
  )
  const goals = events.filter((e) => ['goal', 'penalty', 'owngoal'].includes(e.type))

  it('reads every minute (no event at minute 0)', () => {
    expect(events.length).toBeGreaterThan(10)
    expect(events.filter((e) => e.minute === 0)).toHaveLength(0)
    expect(goals.map((e) => e.minute)).toEqual([8, 20, 57])
  })

  it('stores stoppage time (90 ’ 5) as minute 90', () => {
    expect(events.some((e) => e.minute === 90)).toBe(true)
    expect(Math.max(...events.map((e) => e.minute))).toBe(90)
  })

  it('stores the own goal on the scorer side, so the score still adds up', () => {
    expect(goals[0]).toMatchObject({
      type: 'owngoal',
      playerName: 'Kennie Knak Chopart',
      side: 'home',
    })
    expect(validateEvents(events, { homeGoals: 1, awayGoals: 2 })).toHaveLength(0)
  })
})
