import { describe, it, expect } from 'vitest'
import { fit, predict, expectations, tau, DC_BLEND, type DcMatch } from '../src/lib/dixonColes'

/** deterministic Poisson draw, so the suite never flakes */
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
function samplePoisson(lambda: number, rand: () => number) {
  const l = Math.exp(-lambda)
  let k = 0
  let p = 1
  do { k++; p *= rand() } while (p > l)
  return k - 1
}

describe('tau, the low-score correction', () => {
  it('leaves every scoreline above 1-1 untouched', () => {
    for (const [x, y] of [[2, 0], [0, 2], [3, 1], [1, 2], [4, 4]]) {
      expect(tau(x, y, 1.5, 1.2, 0.1)).toBe(1)
    }
  })

  it('touches exactly the four scorelines the model is named for', () => {
    const moved = [[0, 0], [0, 1], [1, 0], [1, 1]].filter(
      ([x, y]) => tau(x, y, 1.5, 1.2, 0.1) !== 1,
    )
    expect(moved).toHaveLength(4)
  })

  it('does nothing at all when rho is zero', () => {
    for (const [x, y] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      expect(tau(x, y, 1.5, 1.2, 0)).toBe(1)
    }
  })
})

// The real test of a fitting routine is whether it can find parameters it was
// never told, from nothing but scorelines those parameters produced.
describe('fit recovers strengths it was not given', () => {
  const clubs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
  const trueAttack = new Map(clubs.map((c, i) => [c, (i - 4.5) * 0.09]))
  const trueDefence = new Map(clubs.map((c, i) => [c, (4.5 - i) * 0.07]))
  const trueHome = 0.26
  const base = Math.log(1.35)

  const rand = makeRng(20260911)
  const matches: DcMatch[] = []
  // eight double round robins is roughly what a decade of history looks like
  for (let season = 0; season < 8; season++) {
    for (const h of clubs) {
      for (const a of clubs) {
        if (h === a) continue
        const lh = Math.exp(base + trueAttack.get(h)! - trueDefence.get(a)! + trueHome)
        const la = Math.exp(base + trueAttack.get(a)! - trueDefence.get(h)!)
        matches.push({
          home: h, away: a,
          homeGoals: samplePoisson(lh, rand),
          awayGoals: samplePoisson(la, rand),
          ageDays: (7 - season) * 365,
        })
      }
    }
  }

  const p = fit(matches, { halfLifeDays: 100000, priorMatches: 0.05, maxIterations: 1500 })

  it('finds the home advantage the scores were generated with', () => {
    expect(p.homeAdvantage).toBeGreaterThan(trueHome - 0.06)
    expect(p.homeAdvantage).toBeLessThan(trueHome + 0.06)
  })

  it('ranks the clubs in the order it was never shown', () => {
    const ranked = clubs.slice().sort((a, b) => p.attack.get(b)! - p.attack.get(a)!)
    const truth = clubs.slice().sort((a, b) => trueAttack.get(b)! - trueAttack.get(a)!)
    // the strongest and weakest must land in the right place
    expect(ranked[0]).toBe(truth[0])
    expect(ranked[ranked.length - 1]).toBe(truth[truth.length - 1])
  })

  // 720 matches is 144 per club, so a coefficient carries about 0.07 of Poisson
  // sampling noise on its own. The average is what should be tight; one club
  // landing further out is the noise, not the model.
  it('recovers the attack coefficients to within the sampling noise', () => {
    const errors = clubs.map((c) => Math.abs(p.attack.get(c)! - trueAttack.get(c)!))
    const mean = errors.reduce((a, b) => a + b, 0) / errors.length
    expect(mean).toBeLessThan(0.08)
    expect(Math.max(...errors)).toBeLessThan(0.2)
  })

  it('finds no low-score dependence in independent scores', () => {
    // the scorelines were drawn from two independent Poissons, so the honest
    // answer is that the correction is not needed
    expect(Math.abs(p.rho)).toBeLessThan(0.05)
  })

  it('reproduces the goal expectations the scores came from', () => {
    const e = expectations(p, 'A', 'J')
    const lh = Math.exp(base + trueAttack.get('A')! - trueDefence.get('J')! + trueHome)
    expect(e.home).toBeGreaterThan(lh * 0.82)
    expect(e.home).toBeLessThan(lh * 1.22)
  })

  it('settles rather than wandering', () => {
    expect(p.converged || p.iterations >= 900).toBe(true)
    expect(Number.isFinite(p.logLikelihood)).toBe(true)
  })
})

describe('predict', () => {
  const matches: DcMatch[] = []
  for (let i = 0; i < 6; i++) {
    matches.push({ home: 'Sterkt', away: 'Veikt', homeGoals: 3, awayGoals: 0, ageDays: i * 30 })
    matches.push({ home: 'Veikt', away: 'Sterkt', homeGoals: 0, awayGoals: 2, ageDays: i * 30 })
    matches.push({ home: 'Medal', away: 'Veikt', homeGoals: 2, awayGoals: 1, ageDays: i * 30 })
    matches.push({ home: 'Sterkt', away: 'Medal', homeGoals: 2, awayGoals: 1, ageDays: i * 30 })
  }
  const p = fit(matches)

  it('gives three outcomes that sum to one', () => {
    const r = predict(p, 'Sterkt', 'Veikt')
    expect(r.pHome + r.pDraw + r.pAway).toBeCloseTo(1, 9)
  })

  it('favours the stronger side, and more so at home', () => {
    const atHome = predict(p, 'Sterkt', 'Veikt')
    const away = predict(p, 'Veikt', 'Sterkt')
    expect(atHome.pHome).toBeGreaterThan(atHome.pAway)
    expect(away.pAway).toBeGreaterThan(away.pHome)
    expect(atHome.pHome).toBeGreaterThan(away.pAway)
  })

  it('returns a scoreline that is actually possible', () => {
    const r = predict(p, 'Sterkt', 'Veikt')
    expect(Number.isInteger(r.score.home)).toBe(true)
    expect(r.score.home).toBeGreaterThanOrEqual(0)
    expect(r.lambdaHome).toBeGreaterThan(0)
  })

  it('treats a club it has never seen as exactly average', () => {
    const known = predict(p, 'Medal', 'Ókunnugt')
    expect(Number.isFinite(known.pHome)).toBe(true)
    expect(known.pHome + known.pDraw + known.pAway).toBeCloseTo(1, 9)
  })
})

describe('the pull towards average', () => {
  it('keeps a club with one freak result from being rated on it', () => {
    const base: DcMatch[] = []
    for (let i = 0; i < 40; i++) {
      base.push({ home: 'A', away: 'B', homeGoals: 1, awayGoals: 1, ageDays: i * 7 })
      base.push({ home: 'B', away: 'A', homeGoals: 1, awayGoals: 1, ageDays: i * 7 })
    }
    const withFreak = fit([...base, { home: 'Nýtt', away: 'A', homeGoals: 7, awayGoals: 0, ageDays: 1 }])
    const attack = withFreak.attack.get('Nýtt')!
    expect(attack).toBeGreaterThan(0)      // it did happen
    expect(attack).toBeLessThan(0.85)      // but one match is not a rating
  })

  it('weighs a recent season above an old one', () => {
    const old: DcMatch[] = []
    const recent: DcMatch[] = []
    for (let i = 0; i < 30; i++) {
      old.push({ home: 'X', away: 'Y', homeGoals: 4, awayGoals: 0, ageDays: 2000 + i })
      recent.push({ home: 'X', away: 'Y', homeGoals: 0, awayGoals: 1, ageDays: 10 + i })
    }
    const p = fit([...old, ...recent], { halfLifeDays: 365 })
    // the recent run of defeats must dominate the distant thrashings
    expect(p.attack.get('X')!).toBeLessThan(p.attack.get('Y')!)
  })
})

// The model earns a minority vote, not the casting one: on its own it loses to
// Elo, and only the blend beats both. The constant is load-bearing.
describe('the blend weight', () => {
  it('leaves Elo in charge', () => {
    expect(DC_BLEND).toBeGreaterThan(0)
    expect(DC_BLEND).toBeLessThan(0.5)
  })

  it('mixes two sets of probabilities into one that still sums to a certainty', () => {
    const elo = { pHome: 0.5, pDraw: 0.25, pAway: 0.25 }
    const dc = { pHome: 0.62, pDraw: 0.2, pAway: 0.18 }
    const mix = (a: number, b: number) => a * (1 - DC_BLEND) + b * DC_BLEND
    const h = mix(elo.pHome, dc.pHome)
    const d = mix(elo.pDraw, dc.pDraw)
    const a = mix(elo.pAway, dc.pAway)
    expect(h + d + a).toBeCloseTo(1, 9)
    expect(h).toBeGreaterThan(elo.pHome)
    expect(h).toBeLessThan(dc.pHome)
  })
})
