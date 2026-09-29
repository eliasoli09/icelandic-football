import { describe, it, expect } from 'vitest'
import { divisionQuantile, seededRating, TRUST_AFTER } from '../src/lib/newcomers'

describe('divisionQuantile', () => {
  it('picks a rating from the lower end of the division', () => {
    const league = [1200, 1300, 1400, 1500, 1600, 1700]
    const q = divisionQuantile(league, 0.2)!
    expect(q).toBeGreaterThanOrEqual(1200)
    expect(q).toBeLessThan(1450)
  })

  it('has no opinion about an empty division', () => {
    expect(divisionQuantile([])).toBeNull()
    expect(divisionQuantile([NaN, Infinity])).toBeNull()
  })

  it('does not care what order the division arrives in', () => {
    const a = divisionQuantile([1700, 1200, 1500, 1300])
    const b = divisionQuantile([1200, 1300, 1500, 1700])
    expect(a).toBe(b)
  })
})

describe('seededRating', () => {
  const prior = 1330

  it('leaves a club with a full record exactly as it is', () => {
    expect(seededRating(1311, TRUST_AFTER, prior)).toBe(1311)
    expect(seededRating(1311, 500, prior)).toBe(1311)
  })

  // Lincoln arrived on 1467 with five rated matches, above a Preston side that
  // had earned 1311 over 512. The prior is what stops that.
  it('pulls a newcomer most of the way to the prior', () => {
    const seeded = seededRating(1467, 5, prior)
    const toPrior = Math.abs(seeded - prior)
    const toRaw = Math.abs(seeded - 1467)
    expect(toPrior).toBeLessThan(toRaw) // closer to where it belongs
    expect(toPrior / (toPrior + toRaw)).toBeLessThan(0.3) // three quarters of the way
    expect(seeded).toBeGreaterThan(prior)
  })

  it('hands the club back its own rating as it plays', () => {
    const early = seededRating(1467, 2, prior)
    const later = seededRating(1467, 15, prior)
    expect(later).toBeGreaterThan(early)
    expect(later).toBeLessThan(1467)
  })

  it('does nothing at all when the division gives no prior', () => {
    expect(seededRating(1467, 1, null)).toBe(1467)
  })

  it('never invents a rating outside the two it was given', () => {
    for (const n of [0, 1, 7, 19, 20]) {
      const v = seededRating(1467, n, prior)
      expect(v).toBeGreaterThanOrEqual(Math.min(1467, prior))
      expect(v).toBeLessThanOrEqual(Math.max(1467, prior))
    }
  })
})
