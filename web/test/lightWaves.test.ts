import { describe, expect, it } from 'vitest'
import { ribbonY, waveQuality, waveSettings } from '../src/components/LightWaves/field'

describe('light ribbon field', () => {
  it('changes curvature over time instead of translating a fixed layer', () => {
    const curvature = (x: number, t: number) =>
      ribbonY(x - 0.02, 0.1, 1, t) - 2 * ribbonY(x, 0.1, 1, t) + ribbonY(x + 0.02, 0.1, 1, t)
    expect(Math.abs(curvature(0.7, 0) - curvature(0.7, 5))).toBeGreaterThan(0.0001)
  })

  it('keeps neighboring threads in a coherent ribbon throughout a long run', () => {
    for (let t = 0; t <= 60; t += 3) {
      for (let x = 0; x <= 1; x += 0.05) {
        expect(Math.abs(ribbonY(x, 0.15, 1, t) - ribbonY(x, 0.17, 1, t))).toBeLessThan(0.02)
      }
    }
  })

  it('stays continuous across nominal cycles, with no 20 second reset', () => {
    for (const t of [16, 20, 32, 40, 60, 3600]) {
      const delta = Math.abs(ribbonY(0.78, -0.25, 2, t - 0.001) - ribbonY(0.78, -0.25, 2, t + 0.001))
      expect(delta).toBeLessThan(0.001)
    }
    expect(ribbonY(0.78, -0.25, 2, 0)).not.toBeCloseTo(ribbonY(0.78, -0.25, 2, 20), 3)
  })

  it('lets amplitude turn deformation off without invalid coordinates', () => {
    expect(ribbonY(0.7, 0.1, 1, 0, 0)).toBe(ribbonY(0.7, 0.1, 1, 8, 0))
  })
})

describe('light wave rendering budget', () => {
  it('reduces geometry and particles on phones and caps high-density canvases', () => {
    const desktop = waveQuality(1440, 3, waveSettings())
    const phone = waveQuality(390, 3, waveSettings())
    expect(phone.threads).toBeLessThan(desktop.threads)
    expect(phone.particles).toBeLessThan(desktop.particles)
    expect(phone.samples).toBeLessThan(desktop.samples)
    expect(phone.dpr).toBeLessThanOrEqual(1.5)
    expect(desktop.dpr).toBeLessThanOrEqual(1.75)
  })

  it('honors zero controls and bounds expensive or invalid settings', () => {
    const settings = waveSettings({ speed: 0, amplitude: 0, threadCount: 0, brightness: 0, particleCount: 0, mouseInfluence: 0 })
    expect(Object.values(settings)).toEqual([0, 0, 0, 0, 0, 0])
    const invalid = waveSettings({ threadCount: Infinity, particleCount: -10, speed: NaN, brightness: 90 })
    expect(invalid.threadCount).toBeLessThanOrEqual(180)
    expect(invalid.particleCount).toBe(0)
    expect(Number.isFinite(invalid.speed)).toBe(true)
    expect(invalid.brightness).toBeLessThanOrEqual(2)
  })
})
