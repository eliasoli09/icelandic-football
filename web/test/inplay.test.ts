import { describe, expect, it } from 'vitest'
import { prob1X2, probBtts, probOver, probUnder, probScorer, remainingShare, slipProbability } from '../src/lib/inplay'

describe('remainingShare', () => {
  it('runs 1 → 0 over the match', () => {
    expect(remainingShare(0)).toBe(1)
    expect(remainingShare(93)).toBe(0)
    expect(remainingShare(120)).toBe(0)
    expect(remainingShare(46)).toBeGreaterThan(0.4)
  })
})

describe('probOver / probUnder', () => {
  it('settles once the line is passed', () => {
    expect(probOver(3, 2.5, 1)).toBe(1)
    expect(probUnder(3, 2.5, 1)).toBe(0)
  })
  it('moves with remaining rate', () => {
    const early = probOver(0, 2.5, 2.8)
    const late = probOver(0, 2.5, 0.3)
    expect(early).toBeGreaterThan(late)
    expect(early).toBeGreaterThan(0.3)
    expect(late).toBeLessThan(0.01 + 0.05)
  })
  it('over + under = 1 for half lines', () => {
    const over = probOver(1, 2.5, 1.7)
    const under = probUnder(1, 2.5, 1.7)
    expect(over + under).toBeCloseTo(1, 10)
  })
})

describe('prob1X2', () => {
  it('sums to 1 and favours the leader late', () => {
    const { p1, px, p2 } = prob1X2(1, 0, 0.2, 0.2)
    expect(p1 + px + p2).toBeCloseTo(1, 6)
    expect(p1).toBeGreaterThan(0.8)
    expect(p2).toBeLessThan(0.05)
  })
  it('level game pre-match favours higher lambda', () => {
    const { p1, p2 } = prob1X2(0, 0, 1.8, 1.1)
    expect(p1).toBeGreaterThan(p2)
  })
})

describe('probBtts', () => {
  it('is 1 when both have scored, team-dependent otherwise', () => {
    expect(probBtts(1, 1, 0.5, 0.5)).toBe(1)
    expect(probBtts(1, 0, 0.5, 0.9)).toBeCloseTo(1 - Math.exp(-0.9), 10)
    expect(probBtts(0, 0, 0.9, 0.9)).toBeCloseTo((1 - Math.exp(-0.9)) ** 2, 10)
  })
})

describe('probScorer + slipProbability', () => {
  it('scorer probability shrinks with time', () => {
    expect(probScorer(2)).toBeGreaterThan(probScorer(0.2))
  })
  it('slip probability is the product; nulls excluded; lost leg zeroes it', () => {
    expect(slipProbability([0.5, 0.4])).toBeCloseTo(0.2, 10)
    expect(slipProbability([0.5, null, 0.4])).toBeCloseTo(0.2, 10)
    expect(slipProbability([1, 0, 0.9])).toBe(0)
    expect(slipProbability([null])).toBeNull()
  })
})
