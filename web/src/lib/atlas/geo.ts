export interface Coordinates { lat: number; lon: number }
export interface AtlasClub extends Coordinates {
  id: number
  slug: string
  name: string
  fullName: string
  league: 'besta' | 'lengju'
  city: string
  stadium: string
  founded: number | null
  color: string
  badge: string
  fact: string
  sources: string[]
}
export interface AtlasMatch {
  id: number
  home_team: number
  away_team: number
  date: string | null
  league: string
  venue?: string | null
  status?: string
}

const radians = (degrees: number) => degrees * Math.PI / 180

/** Same projection and metre scale as assets/atlas/build_higgsfield.py.
 * glTF is Y-up; north therefore points toward negative Z. */
export function project({ lat, lon }: Coordinates): { x: number; z: number } {
  return { x: (lon + 19) * Math.cos(radians(65)) * 0.21, z: -(lat - 65) * 0.21 }
}

/** Great-circle distance using the IUGG mean Earth radius, kilometres.
 * This is a straight-line ground-to-ground measurement, not road travel. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = radians(b.lat - a.lat), dLon = radians(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}

/** Great-circle interpolation projected onto the map, with a small decorative
 * lift. Endpoints are the actual ground coordinates, never offset pin heads. */
export function routePoints(a: Coordinates, b: Coordinates, segments = 96) {
  const vector = (p: Coordinates) => {
    const lat = radians(p.lat), lon = radians(p.lon)
    return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
  }
  const av = vector(a), bv = vector(b)
  const angle = Math.acos(Math.max(-1, Math.min(1, av.reduce((s, v, i) => s + v * bv[i], 0))))
  const count = Math.max(2, Math.floor(segments))
  const lift = Math.min(0.055, distanceKm(a, b) / 4500 + 0.009)
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count
    let p: Coordinates
    if (i === 0) p = a
    else if (i === count) p = b
    else if (angle < 1e-6) p = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t }
    else {
      const u = Math.sin((1 - t) * angle) / Math.sin(angle), v = Math.sin(t * angle) / Math.sin(angle)
      const [x, y, z] = av.map((value, k) => value * u + bv[k] * v)
      p = { lat: Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI, lon: Math.atan2(y, x) * 180 / Math.PI }
    }
    return { ...project(p), y: 0.019 + Math.sin(Math.PI * t) * lift }
  })
}

export function atlasFixtures<T extends AtlasMatch>(rows: T[], clubIds: number[]): T[] {
  const ids = new Set(clubIds)
  return rows.filter(m => ids.has(m.home_team) && ids.has(m.away_team) && m.home_team !== m.away_team)
}
