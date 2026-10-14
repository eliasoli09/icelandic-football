import { describe, it, expect } from 'vitest'
import { score, tune, TEST_FROM } from '../src/lib/nfl/backtest'

describe('score', () => {
  it('log loss, Brier, hittni og forgjafarskekkja', () => {
    const s = score([
      { p: 0.8, s: 1, spread: 7, margin: 3 },
      { p: 0.4, s: 0, spread: -2, margin: -10 },
      { p: 0.5, s: 0.5, spread: 0, margin: 0 },
    ])
    expect(s.n).toBe(3)
    expect(s.logLoss).toBeCloseTo((-Math.log(0.8) - Math.log(0.6) - Math.log(0.5)) / 3, 12)
    expect(s.brier).toBeCloseTo((0.04 + 0.16 + 0) / 3, 12)
    expect(s.acc).toBe(1) // ties do not count
    expect(s.spreadMae).toBeCloseTo((4 + 8 + 0) / 3, 12)
  })
})

describe('tune', () => {
  it('neitar að velja stillingar á prófunarárunum', () => {
    expect(() => tune([], 2002, TEST_FROM)).toThrow(/2015/)
    expect(() => tune([], 2010, 2020, 2020)).toThrow(/2020/)
    expect(() => tune([], 2010, 2019, 2020, { K: [20], HFA: [48], R: [0.3], BYE: [0] })).not.toThrow()
  })
})
