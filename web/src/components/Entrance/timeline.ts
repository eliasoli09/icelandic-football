import { ribbonY, seed } from '../LightWaves/field'

export interface Rect { x: number; y: number; width: number; height: number }
export const ENTRANCE_DURATION = 3.3
export const WAVE_START = 7.5
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
export const smooth = (a: number, b: number, t: number) => {
  const p = clamp01((t - a) / (b - a))
  // Quintic easing joins position, velocity AND acceleration at phase edges.
  return p * p * p * (p * (p * 6 - 15) + 10)
}
const lerp = (a: number, b: number, p: number) => a + (b - a) * p

export function entranceFrame(t: number) {
  return {
    charge: smooth(0, .25, t),
    balls: smooth(.24, .65, t) * (1 - smooth(1.25, 2.2, t)),
    hero: smooth(2.2, 2.8, t),
    content: smooth(2.8, ENTRANCE_DURATION, t),
    complete: t >= ENTRANCE_DURATION,
  }
}

export const introQuality = (width: number, dpr: number) => ({
  balls: width < 768 ? 96 : 240,
  dpr: Math.max(1, Math.min(dpr || 1, width < 768 ? 1.5 : 1.75)),
})

export function waveRect(viewport: Rect, hero: Rect, t: number): Rect {
  const p = smooth(1.5, 2.7, t)
  return {
    x: lerp(viewport.x, hero.x, p), y: lerp(viewport.y, hero.y, p),
    width: lerp(viewport.width, hero.width, p), height: lerp(viewport.height, hero.height, p),
  }
}

/** Both the spheres and the Canvas filaments use this deformation. By 1.85s
 * it is exactly the existing ribbon field, including its fine strand offsets. */
export function deformY(x: number, strand: number, layer: number, waveY: number, t: number) {
  const launchY = .86 - .67 * x + strand * .16 + (layer - 1) * .065
  return lerp(launchY, waveY, smooth(.65, 1.85, t))
}

export function flowPoint(x: number, strand: number, layer: number, t: number, waveTime: number, rect: Rect) {
  return {
    x: rect.x + x * rect.width,
    y: rect.y + deformY(x, strand, layer, ribbonY(x, strand, layer, waveTime), t) * rect.height,
  }
}

export function followerX(index: number, t: number) {
  // No wrapping: arrivals and departures fade at the viewport boundary.
  const p = Math.max(0, (t - 1) / 1.2)
  // Integral of quintic easing: slow into the final traveling-light speed
  // without snapping position or changing speed at a phase boundary.
  const integral = p >= 1 ? p - .5 : p ** 6 - 3 * p ** 5 + 2.5 * p ** 4
  const travel = Math.max(0, t - .22) * .39 - (.39 - .052) * 1.2 * integral
  return seed(index + 45) * 1.75 - .85 + travel
}

export function trailOpacity(x: number, index: number, layer: number, threads: number, balls: number, t: number) {
  const lane = index * 3 + layer
  const length = lerp(.045, 1.9, smooth(.7, 2.05, t))
  let alpha = 0
  for (let i = lane; i < balls; i += threads) {
    const head = followerX(i, t)
    alpha = Math.max(alpha, smooth(head - length, head - length * .4, x) * (1 - smooth(head, head + .045, x)))
  }
  return lerp(alpha, 1, smooth(1.65, 2.2, t)) * smooth(.24, .55, t)
}

export function mainBall(t: number, idle: number, viewport: Rect) {
  const r = Math.max(104, Math.min(viewport.width * .235, viewport.height * .235, 190))
  const charge = smooth(0, .25, t)
  const launch = smooth(.25, .65, t)
  const x = viewport.width * .5 - 9 * charge * (1 - launch) + launch * (viewport.width * .68 + r)
  const arc = launch * (.4 + .6 * launch)
  const y = viewport.height * .46 + Math.sin(idle * .8) * 4 * (1 - launch) + 8 * charge * (1 - launch) - viewport.height * .32 * arc
  return {
    x, y, radius: r * (1 - .055 * charge) * (1 - .55 * launch),
    rotationX: launch * .72, rotationY: launch * 2.5, rotationZ: -launch * .52,
    alpha: t < .7 ? 1 : 0, logo: true,
  }
}
