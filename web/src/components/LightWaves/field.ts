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
  threadCount: 108,
  brightness: 1,
  particleCount: 38,
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

/** One shared center and twist per layer keeps the filaments woven together.
 * All traveling phases have x*k - time*w: the flow travels left to right.
 * Incommensurate rates deform the curve, rather than translate a rigid shape. */
export function ribbonBasis(x: number, layer: number, time: number, amplitude = 1) {
  const phase = [1.8, 0.2, -1.1][layer]
  const t = time * [0.76, 1, 0.87][layer]
  const envelope = 0.55 + 0.45 * Math.sin(clamp(x, 0, 1) * Math.PI * 0.5)
  const swell = Math.sin(x * 8.6 - t * 0.39 + phase)
  const undertow = Math.sin(x * 13.4 - t * 0.23 + phase * 1.7)
  const drift = Math.sin(x * 3.7 - t * 0.17 + phase * 0.6)
  return {
    center: 0.47 + (layer - 1) * 0.06
      + amplitude * envelope * (0.205 * swell + 0.073 * undertow + 0.048 * drift),
    spread: 0.035 + amplitude * (0.13 + 0.12 * Math.cos(x * 7.1 - t * 0.27 + phase)),
  }
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
