/**
 * Cuts the countries around Europe out of world-atlas (Natural Earth 1:50m)
 * into public/vallarleit/europe.json, a plain GeoJSON the globe draws.
 * Coordinates are rounded to 0.02° (~2 km), which is invisible at any zoom the
 * game allows and keeps the file small.
 *
 * Usage: cd web && npx tsx scripts/vallarleit/map.mts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { feature } from 'topojson-client'
import { geoCentroid } from 'd3-geo'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
const topo = JSON.parse(readFileSync(join(webDir, 'node_modules/world-atlas/countries-50m.json'), 'utf-8'))
const all = feature(topo, topo.objects.countries) as any

const STEP = 50 // 1/STEP degrees
const r = (v: number) => Math.round(v * STEP) / STEP
function ring(coords: number[][]) {
  const out: number[][] = []
  for (const [x, y] of coords) {
    const p = [r(x), r(y)]
    const last = out[out.length - 1]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p)
  }
  return out.length >= 4 ? out : null
}

const features = []
for (const f of all.features) {
  const [lon, lat] = geoCentroid(f)
  // Europe, the rim of Africa and Asia it borders, and the Atlantic islands
  if (lon < -32 || lon > 70 || lat < 18 || lat > 82) continue
  const g = f.geometry
  if (!g) continue
  const polys: number[][][][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const kept = polys.map((p) => p.map(ring).filter(Boolean) as number[][][]).filter((p) => p.length)
  if (!kept.length) continue
  features.push({ type: 'Feature', id: f.id, properties: { n: f.properties.name }, geometry: { type: 'MultiPolygon', coordinates: kept } })
}
mkdirSync(join(webDir, 'public/vallarleit'), { recursive: true })
const json = JSON.stringify({ type: 'FeatureCollection', features })
writeFileSync(join(webDir, 'public/vallarleit/europe.json'), json)
console.log(`${features.length} countries, ${(json.length / 1024).toFixed(0)} KB`)
