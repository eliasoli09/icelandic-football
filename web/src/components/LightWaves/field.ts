export interface WaveSettings {
  /** Multiplier; 1 gives the main swell a roughly 16 second period. */
  speed: number
  amplitude: number
  /** Total across all three depth layers, before the mobile reduction. */
  threadCount: number
  brightness: number
  particleCount: number
  /** Maximum pointer displacement as a fraction of the region's height. */
  mouseInfluence: number
}

export const DEFAULT_WAVE_SETTINGS: Readonly<WaveSettings> = {
  speed: 1,
  amplitude: 1,
  threadCount: 144,
  brightness: 1,
  particleCount: 64,
  mouseInfluence: 0.018,
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const finite = (n: number | undefined, fallback: number, max: number) =>
  clamp(n !== undefined && Number.isFinite(n) ? n : fallback, 0, max)

export function waveSettings(input: Partial<WaveSettings> = {}): WaveSettings {
  return {
    speed: finite(input.speed, DEFAULT_WAVE_SETTINGS.speed, 3),
    amplitude: finite(input.amplitude, DEFAULT_WAVE_SETTINGS.amplitude, 1.6),
    threadCount: Math.round(finite(input.threadCount, DEFAULT_WAVE_SETTINGS.threadCount, 180)),
    brightness: finite(input.brightness, DEFAULT_WAVE_SETTINGS.brightness, 2),
    particleCount: Math.round(finite(input.particleCount, DEFAULT_WAVE_SETTINGS.particleCount, 100)),
    mouseInfluence: finite(input.mouseInfluence, DEFAULT_WAVE_SETTINGS.mouseInfluence, 0.05),
  }
}

export function waveQuality(width: number, pixelRatio: number, settings: WaveSettings) {
  const mobile = width < 768
  return {
    mobile,
    dpr: clamp(pixelRatio, 1, mobile ? 1.5 : 1.75),
    threads: Math.round(settings.threadCount * (mobile ? 0.5 : 1)),
    particles: Math.round(settings.particleCount * (mobile ? 0.4 : 1)),
    samples: Math.round(clamp(width / (mobile ? 7 : 8), 56, 180)),
  }
}

/** Cubic reconstruction of the actual Bezier guides sampled in Blender.
 * Shared tangents keep the sampled guide joints invisible in motion. */
function guideAt(x: number, layer: number) {
  const points = guides.layers[layer].points
  const scaled = clamp(x, 0, 1) * (points.length - 1)
  const index = Math.min(points.length - 2, Math.floor(scaled))
  const t = scaled - index
  const a = points[Math.max(0, index - 1)], b = points[index]
  const c = points[index + 1], d = points[Math.min(points.length - 1, index + 2)]
  const cubic = (key: 'y' | 'spread') => .5 * (
    2 * b[key] + (-a[key] + c[key]) * t
    + (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t * t
    + (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t * t * t
  )
  return { y: cubic('y'), spread: cubic('spread') }
}

/** One shared center and twist per layer keeps the filaments woven together.
 * All traveling phases have x*k - time*w: the flow travels left to right.
 * Incommensurate rates deform the curve, rather than translate a rigid shape. */
export function ribbonBasis(x: number, layer: number, time: number, amplitude = 1) {
  const phase = [.35, 0, -.45][layer]
  const t = time * [0.76, 1, 0.87][layer]
  const guide = guideAt(x + amplitude * .025 * Math.sin(x * Math.PI) * Math.sin(t * .17 + phase), layer)
  const envelope = .35 + .65 * Math.sin(clamp(x, 0, 1) * Math.PI * .5)
  const swell = Math.sin(x * 7.4 - t * .39 + phase)
  const undertow = Math.sin(x * 12.4 - t * .23 + phase * .7)
  const drift = Math.sin(x * 3.6 - t * .11)
  return {
    center: guide.y + amplitude * envelope * (.080 * swell + .032 * undertow + .025 * drift),
    spread: .024 + guide.spread * (1 + amplitude * (-.22 + .43 * Math.cos(x * 6.8 - t * .27 + phase))),
  }
}

/** Periodic light packets without a modulo seam. Two incommensurate speeds
 * keep the illumination moving along the thread instead of flashing a layer. */
export function travelingLight(x: number, time: number, strand: number, layer: number) {
  const phase = (x - time * (.042 + layer * .006)) * Math.PI * 2 / 1.7 + strand * 1.1 + layer * 1.6
  const packet = Math.exp((Math.cos(phase) - 1) * 8)
  const wake = Math.exp((Math.cos(x * 5.4 - time * .19 + strand * .8 + layer) - 1) * 2)
  return .24 + .65 * packet + .22 * wake
}

/** strand is -0.5..0.5; output is a fraction of the canvas height. */
export function ribbonY(x: number, strand: number, layer: number, time: number, amplitude = 1) {
  const { center, spread } = ribbonBasis(x, layer, time, amplitude)
  return center + strand * spread
    + amplitude * 0.006 * Math.sin(x * 18 - time * 0.31 + strand * 2 + layer) * strand
}

/** Stable particle seeds: no random changes between frames or on resize. */
export function seed(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}
import guides from './ribbon-guides.json'
