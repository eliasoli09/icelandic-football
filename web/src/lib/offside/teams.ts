/**
 * Team assignment from shirt colour. For each player we average the torso
 * pixels (grass removed) in CIE Lab, then split players into two clusters with
 * k-means. Players far from both centres (referees, goalkeepers) are flagged
 * as outliers.
 */

export type Lab = [number, number, number]

function srgbToLinear(c: number) {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = srgbToLinear(r)
  const G = srgbToLinear(g)
  const B = srgbToLinear(b)
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}

export function labToCss([L, a, b]: Lab): string {
  const fy = (L + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787)
  const X = inv(fx) * 0.95047
  const Y = inv(fy)
  const Z = inv(fz) * 1.08883
  const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z]
  const [r, g, bb] = lin.map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, v)) * 255)
  })
  return `rgb(${r}, ${g}, ${bb})`
}

const isGrass = (r: number, g: number, b: number) => g > r * 1.08 && g > b * 1.05

/**
 * Mean Lab colour of a player's shirt from RGBA pixels of their bounding box
 * (row-major, w×h). Uses the torso band (15–50 % of height, middle 60 %).
 */
export function shirtColour(rgba: Uint8ClampedArray, w: number, h: number): Lab | null {
  const x0 = Math.floor(w * 0.2)
  const x1 = Math.ceil(w * 0.8)
  const y0 = Math.floor(h * 0.15)
  const y1 = Math.ceil(h * 0.5)
  let n = 0
  const acc: Lab = [0, 0, 0]
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4
      const r = rgba[i]
      const g = rgba[i + 1]
      const b = rgba[i + 2]
      if (isGrass(r, g, b)) continue
      const lab = rgbToLab(r, g, b)
      acc[0] += lab[0]
      acc[1] += lab[1]
      acc[2] += lab[2]
      n++
    }
  if (n < 4) return null
  return [acc[0] / n, acc[1] / n, acc[2] / n]
}

const d2 = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

export interface Clustering {
  /** 0 or 1 per input, or -1 for missing colour / outlier. */
  labels: number[]
  centres: [Lab, Lab]
}

/** Deterministic 2-means (farthest-point init) with outlier rejection. */
export function clusterTeams(colours: (Lab | null)[], iterations = 20): Clustering | null {
  const idx = colours.map((c, i) => (c ? i : -1)).filter((i) => i >= 0)
  if (idx.length < 2) return null
  const pts = idx.map((i) => colours[i]!)
  const mean: Lab = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length) as Lab
  let c0 = pts.reduce((best, p) => (d2(p, mean) > d2(best, mean) ? p : best), pts[0])
  let c1 = pts.reduce((best, p) => (d2(p, c0) > d2(best, c0) ? p : best), pts[0])
  let assign = pts.map(() => 0)
  for (let it = 0; it < iterations; it++) {
    assign = pts.map((p) => (d2(p, c0) <= d2(p, c1) ? 0 : 1))
    const avg = (k: number): Lab | null => {
      const m = pts.filter((_, i) => assign[i] === k)
      if (!m.length) return null
      return [0, 1, 2].map((j) => m.reduce((s, p) => s + p[j], 0) / m.length) as Lab
    }
    const n0 = avg(0) ?? c0
    const n1 = avg(1) ?? c1
    if (d2(n0, c0) < 1e-6 && d2(n1, c1) < 1e-6) break
    c0 = n0
    c1 = n1
  }
  const centres: [Lab, Lab] = [c0, c1]
  const dists = pts.map((p, i) => Math.sqrt(d2(p, centres[assign[i]])))
  const sorted = [...dists].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  // Referees/keepers wear colours far from both teams.
  const cutoff = Math.max(18, median * 2.5)
  const labels = colours.map(() => -1)
  idx.forEach((ci, i) => {
    labels[ci] = dists[i] > cutoff ? -1 : assign[i]
  })
  return { labels, centres }
}
