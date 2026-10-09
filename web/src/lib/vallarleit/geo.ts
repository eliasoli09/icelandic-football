export interface LatLon { lat: number; lon: number }

const R = 6_371_008.8
const rad = (d: number) => (d * Math.PI) / 180

/** great-circle distance in metres */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 1234567 -> "1.234.567 m", the Icelandic way */
export function formatM(m: number): string {
  return Math.round(m).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' m'
}

/** "1.235 km" for the small print */
export function formatKm(m: number): string {
  const km = m / 1000
  return (km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')) + ' km'
}

/**
 * Heat from 0 (as far as Europe goes) to 1 (the same ground). Logarithmic, so
 * the colour still moves when you are 30 km away and not only at 3000.
 */
export function heat(m: number): number {
  const km = m / 1000
  if (km <= 0.05) return 1
  const t = 1 - Math.log10(1 + km) / Math.log10(1 + 3500)
  return Math.max(0, Math.min(1, t))
}

/** pale cream -> yellow -> orange -> red -> dark crimson, like Globle */
const STOPS: [number, [number, number, number]][] = [
  [0, [255, 232, 176]],
  [0.25, [255, 208, 106]],
  [0.45, [255, 160, 60]],
  [0.62, [240, 96, 40]],
  [0.78, [208, 38, 38]],
  [0.9, [150, 12, 30]],
  [1, [96, 0, 24]],
]
export function heatRgb(t: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i]
    const [t0, c0] = STOPS[i - 1]
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0)
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k)) as [number, number, number]
    }
  }
  return STOPS[STOPS.length - 1][1]
}
export const heatColor = (t: number) => `rgb(${heatRgb(t).join(',')})`

/** a word for how warm a guess is */
export function heatWord(m: number): string {
  const km = m / 1000
  if (km < 0.05) return 'Sami völlur!'
  if (km < 25) return 'Sjóðheitt'
  if (km < 100) return 'Brennandi heitt'
  if (km < 250) return 'Heitt'
  if (km < 600) return 'Volgt'
  if (km < 1200) return 'Kalt'
  return 'Ískalt'
}
