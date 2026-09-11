import { ribbonBasis, ribbonY, seed, type WaveSettings, type waveQuality } from './field'

export type RGB = [number, number, number]
type Quality = ReturnType<typeof waveQuality>
type Pointer = { x: number; y: number }

/** Optional entrance deformation. The settled hero uses the same renderer. */
export interface WaveFlow {
  deform: (x: number, strand: number, layer: number, y: number) => number
  opacity: (x: number, index: number, layer: number) => number
  particles: number
}

const rgba = (c: RGB, opacity: number) => `rgba(${c[0]},${c[1]},${c[2]},${opacity})`
const mix = (c: RGB, white: number): RGB => c.map(v => Math.round(v + (255 - v) * white)) as RGB

/** Canvas accepts any CSS colour; resolve it once, never read pixels per frame. */
export function resolveColor(color: string): RGB {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return [232, 185, 60]
  ctx.fillStyle = '#e8b93c'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const pixel = ctx.getImageData(0, 0, 1, 1).data
  return [pixel[0], pixel[1], pixel[2]]
}

export function drawWaves(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  color: RGB,
  pointer: Pointer,
  settings: WaveSettings,
  quality: Quality,
  flow?: WaveFlow,
) {
  ctx.clearRect(0, 0, width, height)
  const light = mix(color, 0.62)
  const deep = color.map(v => Math.round(v * 0.57)) as RGB
  const { threads, particles, samples, mobile } = quality
  const brightness = settings.brightness
  // Use the interpolated palette for the atmosphere as well as the threads.
  const atmosphere = ctx.createRadialGradient(width * 0.79, height * 0.44, 0, width * 0.79, height * 0.44, width * 0.48)
  atmosphere.addColorStop(0, rgba(color, 0.045 * brightness))
  atmosphere.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = atmosphere
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let layer = 0; layer < 3; layer++) {
    const count = Math.floor(threads / 3) + (layer < threads % 3 ? 1 : 0)
    const strength = [0.42, 0.9, 1.05][layer] * brightness
    const baseColor = layer === 0 ? deep : color
    // Share the expensive field samples across neighboring threads.
    const basis = Array.from({ length: samples + 1 }, (_, j) => {
      const x = j / samples
      const field = ribbonBasis(x, layer, time, settings.amplitude)
      const bend = Math.sin(x * Math.PI) * settings.mouseInfluence
      return { x: x * width, center: field.center + pointer.y * bend, spread: field.spread }
    })

    for (let i = 0; i < count; i++) {
      const strand = count <= 1 ? 0 : i / (count - 1) - 0.5
      const path = new Path2D()
      for (let j = 0; j <= samples; j++) {
        const p = basis[j]
        const x = j / samples
        const fine = settings.amplitude * 0.006 * Math.sin(x * 18 - time * 0.31 + strand * 2 + layer) * strand
        const fieldY = p.center + strand * p.spread + fine
        const y = (flow ? flow.deform(x, strand, layer, fieldY) : fieldY) * height
        const px = p.x + pointer.x * settings.mouseInfluence * height * Math.sin(x * Math.PI)
        if (j === 0) path.moveTo(px, y)
        else path.lineTo(px, y)
      }

      // One gradient stroke combines the continuous filament and traveling
      // light, avoiding a second rasterization of every path.
      const edge = 0.45 + 0.55 * Math.cos(strand * Math.PI)
      ctx.lineWidth = (layer === 0 ? 0.55 : 0.75) + (i % 7 === 0 ? 0.2 : 0)

      const packet = ((time * (0.042 + layer * 0.006) + strand * 0.19 + layer * 0.43) % 1.7) - 0.35
      const gradient = ctx.createLinearGradient(0, 0, width, 0)
      // A second, broader light trail prevents a ribbon from blinking as a
      // packet leaves. Each strand's phase differs slightly from its neighbor.
      for (let stop = 0; stop <= 16; stop++) {
        const x = stop / 16
        const d = (x - packet) / 0.14
        const trail = 0.18 + 0.18 * (0.5 + 0.5 * Math.sin(x * 10 - time * 0.44 + strand * 3 + layer))
        // Keep compressed folds translucent instead of merging into a thick
        // yellow band. Neighboring filaments still share the same lighting.
        const density = Math.min(1, Math.max(0.34, basis[Math.round(x * samples)].spread / 0.14))
        const alpha = Math.min(1, strength * edge * density * (0.4 + trail + 0.7 * Math.exp(-d * d)))
        gradient.addColorStop(x, rgba(i % 9 === 0 ? light : baseColor, alpha * (flow?.opacity(x, i, layer) ?? 1)))
      }
      ctx.strokeStyle = gradient
      ctx.stroke(path)
      // Only a few fine filaments receive a soft halo; no full-canvas blur.
      if (i % 9 === 0 && layer > 0 && !mobile) {
        ctx.globalAlpha = 0.14
        ctx.lineWidth = 3.2
        ctx.stroke(path)
        ctx.globalAlpha = 1
      }
    }
  }

  for (let i = 0; i < particles; i++) {
    const life = 19 + seed(i + 20) * 20
    const age = (time / life + seed(i + 7)) % 1
    const x = -0.08 + age * 1.16
    const strand = seed(i + 90) - 0.5
    const layer = i % 3
    const offset = (seed(i + 130) - 0.5) * (i % 5 === 0 ? 0.65 : 0.2)
    const y = ribbonY(x, strand, layer, time, settings.amplitude) + offset
    const fade = Math.sin(age * Math.PI) ** 2
    const alpha = fade * (0.16 + seed(i + 10) * 0.4) * brightness * (flow?.particles ?? 1)
    const radius = (i % 11 === 0 ? 1.9 : 0.5) + seed(i + 60) * 0.75
    const px = x * width
    const py = (y + pointer.y * settings.mouseInfluence * Math.sin(x * Math.PI)) * height
    if (i % 7 === 0) {
      const halo = ctx.createRadialGradient(px, py, 0, px, py, radius * 4)
      halo.addColorStop(0, rgba(color, alpha * 0.22))
      halo.addColorStop(1, rgba(color, 0))
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(px, py, radius * 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = rgba(i % 6 === 0 ? light : color, alpha)
    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
}
