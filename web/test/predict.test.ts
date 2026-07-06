import { describe, it, expect } from 'vitest'
import { predictMatch, samplePoisson } from '../src/lib/predict'

describe('predictMatch', () => {
  it('probabilities sum to 1', () => {
    const p = predictMatch({ eloHome: 1500, eloAway: 1500, home: null, away: null })
    expect(p.pHome + p.pDraw + p.pAway).toBeCloseTo(1, 6)
  })

  it('equal teams: home is favourite (home advantage)', () => {
    const p = predictMatch({ eloHome: 1500, eloAway: 1500, home: null, away: null })
    expect(p.pHome).toBeGreaterThan(p.pAway)
    expect(p.pDraw).toBeGreaterThan(0.15)
  })

  it('a much stronger away side overcomes home advantage', () => {
    const p = predictMatch({ eloHome: 1400, eloAway: 1650, home: null, away: null })
    expect(p.pAway).toBeGreaterThan(p.pHome)
  })

  it('Keflavík–Fram regression: away favourite around 50%', () => {
    // 2026 rates as of 6 July: Kef 1.42/1.92 in 12, Fram 2.58/2.00 in 12.
    // Elo gap modelled from table positions (Fram 3rd, Kef 8th).
    const p = predictMatch({
      eloHome: 1480,
      eloAway: 1560,
      home: { gfPerGame: 1.42, gaPerGame: 1.92, games: 12, form: 'WDLLW' },
      away: { gfPerGame: 2.58, gaPerGame: 2.0, games: 12, form: 'WLWWW' },
    })
    expect(p.pAway).toBeGreaterThan(0.42)
    expect(p.pAway).toBeLessThan(0.62)
    expect(p.pHome).toBeLessThan(0.35)
  })

  it('exposes transparent factors', () => {
    const p = predictMatch({
      eloHome: 1520,
      eloAway: 1480,
      home: { gfPerGame: 2, gaPerGame: 1, games: 10, form: 'WWWWW' },
      away: { gfPerGame: 1, gaPerGame: 2, games: 10, form: 'LLLLL' },
      h2h: { homeWins: 3, draws: 1, awayWins: 0 },
    })
    expect(p.factors.eloDiff).toBe(40)
    expect(p.factors.formHome).toBe('WWWWW')
    expect(p.factors.h2h.homeWins).toBe(3)
    expect(p.topScorelines[0].p).toBeGreaterThan(0)
  })
})

describe('samplePoisson', () => {
  it('sample mean approximates lambda', () => {
    let seed = 42
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const n = 20000
    let sum = 0
    for (let i = 0; i < n; i++) sum += samplePoisson(1.8, rand)
    expect(sum / n).toBeGreaterThan(1.7)
    expect(sum / n).toBeLessThan(1.9)
  })
})
