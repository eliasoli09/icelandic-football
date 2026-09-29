import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import clubs from './clubs.json'
import layout from './pin-layout.json'
import { project } from './geo'

describe('2026 KSÍ atlas coverage', () => {
  it('contains exactly the official twelve clubs in each division', () => {
    // KSÍ competition 7025510 and 7025540, verified 12 September 2026.
    const ids = (league: string) => clubs.filter(c => c.league === league).map(c => c.id).sort((a, b) => a - b)
    expect(ids('besta')).toEqual([2, 4, 6, 12, 13, 15, 22, 23, 25, 29, 30, 34])
    expect(ids('lengju')).toEqual([1, 7, 8, 9, 10, 18, 20, 24, 27, 28, 31, 32])
    expect(new Set(clubs.map(c => c.slug)).size).toBe(24)
  })
  it('ships a real, nonempty official PNG for every club', () => {
    for (const club of clubs) {
      const bytes = readFileSync(resolve('public', club.badge.slice(1)))
      expect(bytes.subarray(0, 8).toString('hex'), club.name).toBe('89504e470d0a1a0a')
      expect(bytes.readUInt32BE(16), club.name).toBeGreaterThan(32)
      expect(bytes.readUInt32BE(20), club.name).toBeGreaterThan(32)
      expect(club.sources.some(s => s.includes('ksi.is/'))).toBe(true)
    }
  })
  it('exports one pin per club with its tip at the shared geographic position', () => {
    expect(layout).toHaveLength(24)
    for (const club of clubs) {
      const pin = layout.find(p => p.id === club.id)!
      expect(pin, club.name).toBeDefined()
      // Blender/glTF stores float32 coordinates; allow its rounding precision.
      expect(pin.anchor[0], club.name).toBeCloseTo(project(club).x, 7)
      expect(pin.anchor[2], club.name).toBeCloseTo(project(club).z, 7)
      expect(pin.head[1]).toBeGreaterThan(pin.anchor[1])
    }
  })
})
