import { ribbonY, seed } from '../LightWaves/field'

export interface Rect { x: number; y: number; width: number; height: number }
export const ENTRANCE_DURATION = 4.5
export const ENTRANCE_TIMING = {
  launchStart: .30, launchEnd: 1.10,
  morphStart: 1, morphEnd: 2.6,
  settleStart: 2, settleEnd: 3.5,
  heroStart: 2.8, heroEnd: 3.6,
  handoffStart: 3.52, handoffEnd: 4.15,
} as const
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
    charge: smooth(0, .36, t),
    balls: smooth(.32, .94, t) * (1 - smooth(1.65, 2.95, t)),
    hero: smooth(ENTRANCE_TIMING.heroStart, ENTRANCE_TIMING.heroEnd, t),
    content: smooth(3.55, ENTRANCE_DURATION, t),
    complete: t >= ENTRANCE_DURATION,
  }
}

export const introQuality = (width: number, dpr: number) => ({
  balls: width < 768 ? 96 : 240,
  dpr: Math.max(1, Math.min(dpr || 1, width < 768 ? 1.5 : 1.75)),
})

export function waveRect(viewport: Rect, hero: Rect, t: number): Rect {
  const p = smooth(ENTRANCE_TIMING.settleStart, ENTRANCE_TIMING.settleEnd, t)
  return {
    x: lerp(viewport.x, hero.x, p), y: lerp(viewport.y, hero.y, p),
    width: lerp(viewport.width, hero.width, p), height: lerp(viewport.height, hero.height, p),
  }
}

/** Both the spheres and the Canvas filaments use this deformation. By 2.6s
 * it is exactly the existing ribbon field, including its fine strand offsets. */
export function deformY(x: number, strand: number, layer: number, waveY: number, t: number) {
  const launchY = .86 - .67 * x + strand * .16 + (layer - 1) * .065
  return lerp(launchY, waveY, smooth(ENTRANCE_TIMING.morphStart, ENTRANCE_TIMING.morphEnd, t))
}

export function flowPoint(x: number, strand: number, layer: number, t: number, waveTime: number, rect: Rect) {
  return {
    x: rect.x + x * rect.width,
    y: rect.y + deformY(x, strand, layer, ribbonY(x, strand, layer, waveTime), t) * rect.height,
  }
}

export function followerX(index: number, t: number) {
  // No wrapping: arrivals and departures fade at the viewport boundary.
  const p = Math.max(0, (t - 1.15) / 1.65)
  // Integral of quintic easing: slow into the final traveling-light speed
  // without snapping position or changing speed at a phase boundary.
  const integral = p >= 1 ? p - .5 : p ** 6 - 3 * p ** 5 + 2.5 * p ** 4
  const travel = Math.max(0, t - .30) * .32 - (.32 - .052) * 1.65 * integral
  return seed(index + 45) * 1.75 - .85 + travel
}

export function trailOpacity(x: number, index: number, layer: number, threads: number, balls: number, t: number) {
  const lane = index * 3 + layer
  const length = lerp(.045, 1.9, smooth(1, 2.75, t))
  let alpha = 0
  for (let i = lane; i < balls; i += threads) {
    const head = followerX(i, t)
    alpha = Math.max(alpha, smooth(head - length, head - length * .4, x) * (1 - smooth(head, head + .045, x)))
  }
  return lerp(alpha, 1, smooth(2.2, 2.95, t)) * smooth(.32, .85, t)
}

export function mainBall(t: number, idle: number, viewport: Rect) {
  const r = Math.max(104, Math.min(viewport.width * .235, viewport.height * .235, 190))
  const charge = smooth(0, .36, t)
  const launch = smooth(ENTRANCE_TIMING.launchStart, ENTRANCE_TIMING.launchEnd, t)
  const x = viewport.width * .5 - 9 * charge * (1 - launch) + launch * (viewport.width * .68 + r)
  const arc = launch * (.4 + .6 * launch)
  const y = viewport.height * .46 + Math.sin(idle * .8) * 4 * (1 - launch) + 8 * charge * (1 - launch) - viewport.height * .32 * arc
  return {
    x, y, radius: r * (1 - .055 * charge) * (1 - .55 * launch),
    rotationX: launch * .72, rotationY: launch * 2.5, rotationZ: -launch * .52,
    alpha: 1 - smooth(.97, 1.14, t), logo: true,
  }
}
