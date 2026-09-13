import { describe, expect, it } from 'vitest'
import { distanceKm, project, routePoints, atlasFixtures } from './geo'

describe('atlas geography', () => {
  it('puts north above south and east to the right, centred on Iceland', () => {
    expect(project({ lat: 65, lon: -19 })).toEqual({ x: 0, z: -0 })
    expect(project({ lat: 66, lon: -18 }).x).toBeGreaterThan(0)
    expect(project({ lat: 66, lon: -18 }).z).toBeLessThan(0)
  })
  it('measures a degree at the equator and handles identical/antipodal points', () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.195, 2)
    expect(distanceKm({ lat: 65, lon: -19 }, { lat: 65, lon: -19 })).toBe(0)
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(20015.114, 2)
  })
  it('gives symmetric realistic Reykjavík–Akureyri straight-line distances', () => {
    const r = { lat: 64.14, lon: -21.94 }, a = { lat: 65.68, lon: -18.10 }
    expect(distanceKm(r, a)).toBeGreaterThan(240)
    expect(distanceKm(r, a)).toBeLessThan(255)
    expect(distanceKm(r, a)).toBe(distanceKm(a, r))
  })
  it('anchors the dotted arc at the actual two grounds', () => {
    const a = { lat: 64.14, lon: -21.94 }, b = { lat: 65.68, lon: -18.10 }
    const p = routePoints(a, b, 32)
    expect(p).toHaveLength(33)
    expect(p[0]).toEqual({ ...project(a), y: 0.019 })
    expect(p[32].x).toBeCloseTo(project(b).x, 8)
    expect(p[32].z).toBeCloseTo(project(b).z, 8)
    expect(p[16].y).toBeGreaterThan(p[0].y)
  })
  it('keeps every real scheduled/played pair and excludes teams outside this atlas', () => {
    const rows = [
      { id: 1, home_team: 4, away_team: 12, date: '2026-09-13', league: 'besta' },
      { id: 2, home_team: 4, away_team: 999, date: null, league: 'besta' },
      { id: 3, home_team: 4, away_team: 12, date: null, league: 'besta' },
    ]
    expect(atlasFixtures(rows, [4, 12]).map(m => m.id)).toEqual([1, 3])
  })
})
