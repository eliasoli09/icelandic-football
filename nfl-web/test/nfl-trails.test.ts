import { describe, expect, it } from 'vitest'
import { trailPoint } from '../src/components/Nfl/footballTrails'
import { footballRadius } from '../src/components/Nfl/footballSurface'

describe('football light trails', () => {
  for (const kind of ['red', 'blue', 'sweep'] as const) {
    it(`${kind} forms a closed orbit outside the leather, visiting front and back`, () => {
      const points = Array.from({length: 257}, (_, i) => trailPoint(i / 256, kind))
      expect(points[0].x).toBeCloseTo(points[256].x)
      expect(points[0].y).toBeCloseTo(points[256].y)
      expect(points[0].z).toBeCloseTo(points[256].z)
      expect(Math.min(...points.map(p => p.z))).toBeLessThan(-.3)
      expect(Math.max(...points.map(p => p.z))).toBeGreaterThan(.3)
      for (const p of points) {
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true)
        if (Math.abs(p.y) < 1.65) expect(Math.hypot(p.x, p.z)).toBeGreaterThan(footballRadius(p.y))
      }
    })
  }
})
