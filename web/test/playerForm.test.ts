import { describe, it, expect } from 'vitest'
import {
  XgForm, PlayerWeights, missingShare, availability, adjustLambda,
  XG_MIN_MATCHES, XG_WEIGHT, leagueScale,
} from '../src/lib/playerForm'

const AVG = 1.41

describe('XgForm', () => {
  it('says nothing until a club has enough matches to judge', () => {
    const f = new XgForm(AVG)
    for (let i = 1; i < XG_MIN_MATCHES; i++) {
      f.record('A', 2.2, 0.6)
      expect(f.get('A')).toBeNull()
    }
    f.record('A', 2.2, 0.6)
    expect(f.get('A')).not.toBeNull()
  })

  it('reports form against the league, not in raw goals', () => {
    const f = new XgForm(AVG)
    for (let i = 0; i < 40; i++) f.record('A', AVG, AVG)
    const t = f.get('A')!
    expect(t.attack).toBeCloseTo(1, 2)
    expect(t.defence).toBeCloseTo(1, 2)
  })

  it('separates a side that creates a lot from one that concedes a lot', () => {
    const f = new XgForm(AVG)
    for (let i = 0; i < 30; i++) {
      f.record('Sokn', 2.6, 1.4)
      f.record('Vorn', 1.4, 0.5)
    }
    expect(f.get('Sokn')!.attack).toBeGreaterThan(f.get('Vorn')!.attack)
    expect(f.get('Vorn')!.defence).toBeLessThan(f.get('Sokn')!.defence)
  })

  it('moves form back towards the league over a summer, without erasing it', () => {
    const f = new XgForm(AVG)
    for (let i = 0; i < 30; i++) f.record('A', 2.6, 1.0)
    const before = f.get('A')!.attack
    f.newSeason()
    const after = f.get('A')!.attack
    expect(after).toBeLessThan(before)
    expect(after).toBeGreaterThan(1)
  })
})

describe('missingShare', () => {
  it('is the share of output that will not take the field', () => {
    expect(missingShare([{ weight: 3, absent: 1 }, { weight: 1, absent: 0 }])).toBeCloseTo(0.75, 6)
    expect(missingShare([{ weight: 3, absent: 0 }, { weight: 1, absent: 0 }])).toBe(0)
  })

  it('counts a doubt as part of a player', () => {
    expect(missingShare([{ weight: 2, absent: 0.5 }, { weight: 2, absent: 0 }])).toBeCloseTo(0.25, 6)
  })

  it('is zero for a squad nobody has a reading on', () => {
    expect(missingShare([])).toBe(0)
    expect(missingShare([{ weight: 0, absent: 1 }])).toBe(0)
  })
})

describe('availability and adjustLambda', () => {
  // replacements do most of the job, so a full share missing is not a full loss
  it('discounts far less than the share missing', () => {
    expect(availability(0)).toBe(1)
    expect(availability(0.2)).toBeCloseTo(0.96, 6)
    expect(availability(1)).toBeGreaterThan(0.7)
  })

  it('leaves the Elo expectation alone when there is no form and nobody is out', () => {
    expect(adjustLambda(1.8, null, 0)).toBeCloseTo(1.8, 6)
  })

  it('pulls towards the form reading by exactly the fitted weight', () => {
    expect(adjustLambda(2, 1, 0)).toBeCloseTo(2 * (1 - XG_WEIGHT) + 1 * XG_WEIGHT, 6)
  })

  it('never returns a negative or absurd goal expectation', () => {
    for (const share of [0, 0.5, 1, 2, -1]) {
      const v = adjustLambda(1.6, 0.2, share)
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThan(1.7)
    }
  })
})

describe('PlayerWeights', () => {
  it('gives an unknown player no weight at all', () => {
    expect(new PlayerWeights().get('A', 'nobody')).toBe(0)
  })

  it('ranks a regular creator above an occasional one', () => {
    const w = new PlayerWeights()
    for (let i = 0; i < 20; i++) {
      w.record('A', 'Fastamadur', 0.6)
      w.record('A', 'Varamadur', 0.05)
    }
    expect(w.get('A', 'Fastamadur')).toBeGreaterThan(w.get('A', 'Varamadur') * 5)
  })

  it('lets a player fade once he stops contributing', () => {
    const w = new PlayerWeights()
    for (let i = 0; i < 20; i++) w.record('A', 'X', 0.8)
    const peak = w.get('A', 'X')
    for (let i = 0; i < 20; i++) w.record('A', 'X', 0)
    expect(w.get('A', 'X')).toBeLessThan(peak * 0.3)
  })
})

describe('leagueScale', () => {
  it('puts an inflated division back on its own scoring rate', () => {
    const predicted = [3.2, 3.0, 3.4, 3.0] // mean 3.15
    const k = leagueScale(predicted, 2.945)
    expect(k).toBeLessThan(1)
    const after = predicted.map((p) => p * k).reduce((a, b) => a + b, 0) / predicted.length
    expect(after).toBeCloseTo(2.945, 6)
  })

  it('leaves a division that already matches alone', () => {
    expect(leagueScale([2.8, 2.8, 2.8], 2.8)).toBeCloseTo(1, 9)
  })

  it('has nothing to say without input', () => {
    expect(leagueScale([], 2.8)).toBe(1)
    expect(leagueScale([2.8], 0)).toBe(1)
    expect(leagueScale([0, NaN, -1], 2.8)).toBe(1)
  })

  it('refuses to rescale a division out of all recognition', () => {
    expect(leagueScale([10, 10], 2.8)).toBe(0.8)
    expect(leagueScale([0.5, 0.5], 2.8)).toBe(1.25)
  })
})
