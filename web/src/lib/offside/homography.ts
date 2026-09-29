/**
 * Planar homography (image pixels ↔ pitch metres).
 *
 * The pitch is a plane, so a single 3×3 homography maps every ground point in a
 * video frame to pitch coordinates. We estimate it with the normalised DLT
 * (Hartley) from ≥4 point correspondences, solving the 8 unknowns (h33 = 1) by
 * least squares, which also lets extra points average out click error.
 */

export interface Pt {
  x: number
  y: number
}

/** Row-major 3×3 matrix. */
export type Mat3 = [number, number, number, number, number, number, number, number, number]

function mul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0) as Mat3
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]
  return r
}

export function invert(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  if (!Number.isFinite(det) || Math.abs(det) < 1e-14) return null
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ]
}

/** Projects p through m. Returns null for points on/over the horizon (w ≈ 0). */
export function apply(m: Mat3, p: Pt): (Pt & { w: number }) | null {
  const w = m[6] * p.x + m[7] * p.y + m[8]
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return null
  return { x: (m[0] * p.x + m[1] * p.y + m[2]) / w, y: (m[3] * p.x + m[4] * p.y + m[5]) / w, w }
}

/** Similarity transform that centres points and scales mean distance to √2. */
function normaliser(pts: Pt[]): Mat3 {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const md = pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length || 1
  const s = Math.SQRT2 / md
  return [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1]
}

/** Gaussian elimination with partial pivoting; returns null when singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    if (Math.abs(M[piv][col]) < 1e-10) return null
    ;[M[col], M[piv]] = [M[piv], M[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col] / M[col][col]
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

/**
 * Homography mapping src[i] → dst[i]. Needs ≥4 pairs with no three of the
 * first four collinear; returns null for degenerate input.
 */
export function computeHomography(src: Pt[], dst: Pt[]): Mat3 | null {
  if (src.length !== dst.length || src.length < 4) return null
  const Ts = normaliser(src)
  const Td = normaliser(dst)
  const s = src.map((p) => apply(Ts, p)!)
  const d = dst.map((p) => apply(Td, p)!)

  // Normal equations AᵀA h = Aᵀb for the 8 unknowns.
  const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0))
  const Atb = new Array(8).fill(0)
  const addRow = (row: number[], rhs: number) => {
    for (let i = 0; i < 8; i++) {
      Atb[i] += row[i] * rhs
      for (let j = 0; j < 8; j++) AtA[i][j] += row[i] * row[j]
    }
  }
  for (let i = 0; i < s.length; i++) {
    const { x, y } = s[i]
    const { x: u, y: v } = d[i]
    addRow([x, y, 1, 0, 0, 0, -u * x, -u * y], u)
    addRow([0, 0, 0, x, y, 1, -v * x, -v * y], v)
  }
  const h = solve(AtA, Atb)
  if (!h) return null
  const Hn: Mat3 = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
  const TdInv = invert(Td)
  if (!TdInv) return null
  const H = mul(TdInv, mul(Hn, Ts))
  if (!H.every(Number.isFinite) || Math.abs(H[8]) < 1e-14) return null
  const k = 1 / H[8]
  const out = H.map((x) => x * k) as Mat3
  // Reject near-degenerate fits (e.g. all points on one line).
  return invert(out) ? out : null
}

/** Root-mean-square reprojection error, measured in dst units. */
export function rmsError(m: Mat3, src: Pt[], dst: Pt[]): number {
  let sum = 0
  for (let i = 0; i < src.length; i++) {
    const p = apply(m, src[i])
    if (!p) return Infinity
    sum += (p.x - dst[i].x) ** 2 + (p.y - dst[i].y) ** 2
  }
  return Math.sqrt(sum / src.length)
}

/** Twice the signed area of triangle abc; ~0 means collinear. */
const cross = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

/**
 * True when the points span a real 2-D area (not all on one line). Area is
 * compared against the squared spread so it is scale-independent.
 */
export function spansArea(pts: Pt[], minRatio = 0.02): boolean {
  if (pts.length < 4) return false
  let best = 0
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      for (let k = j + 1; k < pts.length; k++) best = Math.max(best, Math.abs(cross(pts[i], pts[j], pts[k])))
  let spread = 0
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      spread = Math.max(spread, (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2)
  return spread > 0 && best / spread > minRatio
}
