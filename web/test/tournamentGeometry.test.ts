import { expect, test } from 'vitest'
import { chevronContour, conferenceRibbon } from '../src/components/Uefa/tournamentGeometry'

const coordinates = (path: string) => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)

test('Europa contours keep sharp corners and parallel arms throughout motion', () => {
  for (const time of [0, 2.1, 7.8, 15, 28]) {
    for (const group of [0, 1, 2]) {
      const first = chevronContour(0, time, group)
      const next = chevronContour(1, time, group)
      expect(first.match(/[ML]/g)).toEqual(['M', 'L', 'L'])
      const a = coordinates(first), b = coordinates(next)
      expect(a).toHaveLength(6)
      expect(a.every(Number.isFinite)).toBe(true)
      for (const i of [0, 2]) {
        expect((a[i + 3] - a[i + 1]) / (a[i + 2] - a[i])).toBeCloseTo((b[i + 3] - b[i + 1]) / (b[i + 2] - b[i]), 3)
      }
      expect(b[3]).toBeGreaterThan(a[3])
    }
  }
  expect(chevronContour(0, 0, 0)).not.toEqual(chevronContour(0, 4, 0))
})

test('Conference ribbons are connected cubic curves with a continuous join', () => {
  for (const time of [0, 3.2, 10.5, 27]) {
    for (const group of [0, 1, 2]) {
      const path = conferenceRibbon(3, time, group)
      expect(path.match(/[MC]/g)).toEqual(['M', 'C', 'C'])
      const n = coordinates(path)
      expect(n).toHaveLength(14)
      expect(n.every(Number.isFinite)).toBe(true)
      expect(n[8] - n[6]).toBeCloseTo(n[6] - n[4], 1)
      expect(n[9] - n[7]).toBeCloseTo(n[7] - n[5], 1)
    }
  }
})

test('Conference deformation changes shape without independent strand jitter', () => {
  const a = coordinates(conferenceRibbon(0, 0, 0))
  const b = coordinates(conferenceRibbon(0, 4, 0))
  const c = coordinates(conferenceRibbon(1, 4, 0))
  // A shape change affects control points differently; translating an SVG would fail this.
  const dx = b.filter((_, i) => i % 2 === 0).map((x, i) => x - a[i * 2])
  expect(Math.max(...dx) - Math.min(...dx)).toBeGreaterThan(5)
  const strandOffsets = c.map((v, i) => v - b[i])
  expect(Math.max(...strandOffsets.filter((_, i) => i % 2 === 0)) - Math.min(...strandOffsets.filter((_, i) => i % 2 === 0))).toBeLessThan(.02)
  expect(conferenceRibbon(0, 10, 0, 0)).toEqual(conferenceRibbon(0, 0, 0, 0))
})
