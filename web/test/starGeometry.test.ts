import { describe, expect, it } from 'vitest'
import { createStarPatches, projectStarBall, roundedStarContour } from '../src/components/Uefa/starGeometry'

describe('Champions League spherical star geometry', () => {
  it('places twelve five-point star patches on a unit sphere', () => {
    const patches = createStarPatches()
    expect(patches).toHaveLength(12)
    for (const patch of patches) {
      expect(patch.points.length).toBeGreaterThanOrEqual(60)
      for (const point of patch.points) expect(Math.hypot(...point)).toBeCloseTo(1, 10)
    }
  })

  it('keeps every projected path inside the ball throughout a full rotation', () => {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      for (const patch of projectStarBall(angle)) {
        expect(patch.opacity).toBeGreaterThanOrEqual(0)
        expect(patch.opacity).toBeLessThanOrEqual(1)
        const coordinates = patch.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
        for (let i = 0; i < coordinates.length; i += 2) {
          expect(Math.hypot(coordinates[i] - 250, coordinates[i + 1] - 250)).toBeLessThanOrEqual(221.01)
        }
      }
    }
  })

  it('rotates in three dimensions and returns to the same pose without a seam', () => {
    const initial = projectStarBall(0)
    expect(projectStarBall(Math.PI * 2)).toEqual(initial)
    expect(projectStarBall(0.5)[0].path).not.toEqual(initial[0].path)
    expect(projectStarBall(0.5).map(patch => patch.opacity)).not.toEqual(initial.map(patch => patch.opacity))
  })

  it('keeps contour morphs finite, rounded, closed and periodic', () => {
    expect(roundedStarContour(1, 0)).toContain('Q')
    expect(roundedStarContour(1, 0)).toMatch(/Z$/)
    expect(roundedStarContour(1, Math.PI * 2)).toEqual(roundedStarContour(1, 0))
    expect(roundedStarContour(1, 0.7)).not.toEqual(roundedStarContour(1, 0))
    expect(roundedStarContour(1, 0.7)).not.toMatch(/NaN|Infinity/)
  })
})
