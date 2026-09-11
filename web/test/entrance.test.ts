import { describe, expect, it } from 'vitest'
import { entranceFrame, flowPoint, followerX, introQuality, mainBall, smooth, waveRect, type Rect } from '../src/components/Entrance/timeline'
import { ribbonY } from '../src/components/LightWaves/field'

const viewport: Rect = { x: 0, y: 0, width: 1440, height: 900 }
const hero: Rect = { x: 160, y: 90, width: 1120, height: 360 }

describe('football entrance continuity', () => {
  it('eases acceleration to zero at both ends instead of jolting between phases', () => {
    const h = .0001
    const acceleration = (t: number) => (smooth(0, 1, t + h) - 2 * smooth(0, 1, t) + smooth(0, 1, t - h)) / (h * h)
    expect(Math.abs(acceleration(h))).toBeLessThan(.02)
    expect(Math.abs(acceleration(1 - h))).toBeLessThan(.02)
  })

  it('slows the followers into the live light flow without a speed discontinuity', () => {
    const velocity = (t: number) => (followerX(4, t + .0001) - followerX(4, t - .0001)) / .0002
    expect(velocity(.7)).toBeCloseTo(.39, 3)
    expect(velocity(2.2)).toBeCloseTo(.052, 3)
    expect(velocity(2.2 - .001)).toBeCloseTo(velocity(2.2 + .001), 3)
  })

  it('follows a curved launch and preserves the idle position on click', () => {
    const idle = mainBall(-1, 3, viewport), clicked = mainBall(0, 3, viewport)
    expect(clicked.x).toBe(idle.x); expect(clicked.y).toBe(idle.y)
    const from = mainBall(.25, 0, viewport), mid = mainBall(.45, 0, viewport), to = mainBall(.65, 0, viewport)
    const yProgress = (mid.y - from.y) / (to.y - from.y)
    expect(yProgress).toBeLessThan(.45)
  })
  it('lands on exactly the same field and bounds as the living hero', () => {
    expect(waveRect(viewport, hero, 2.8)).toEqual(hero)
    for (const layer of [0, 1, 2]) {
      for (const x of [0.1, 0.4, 0.8]) {
        const p = flowPoint(x, .2, layer, 2.2, 9.7, hero)
        expect(p.x).toBeCloseTo(hero.x + x * hero.width, 10)
        expect(p.y).toBeCloseTo(hero.y + ribbonY(x, .2, layer, 9.7) * hero.height, 10)
      }
    }
  })

  it('has no position jump at any phase boundary', () => {
    for (const t of [.25, .65, 1.1, 1.65, 2.2, 2.8, 3.3]) {
      const before = flowPoint(.7, .25, 1, t - .0001, 7.5 + t - .0001, waveRect(viewport, hero, t - .0001))
      const after = flowPoint(.7, .25, 1, t + .0001, 7.5 + t + .0001, waveRect(viewport, hero, t + .0001))
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1)
    }
  })

  it('deforms the shared stream, then releases the live site at 3.3 seconds', () => {
    expect(entranceFrame(0).hero).toBe(0)
    expect(entranceFrame(2.2).hero).toBe(0)
    expect(entranceFrame(2.8).hero).toBe(1)
    expect(entranceFrame(3.3)).toMatchObject({ complete: true, hero: 1, content: 1, balls: 0 })
    expect(entranceFrame(20).complete).toBe(true)
  })

  it('keeps the idle face still and launches the main ball beyond the screen', () => {
    const idle = mainBall(-1, 0, viewport)
    for (const rotation of [idle.rotationX, idle.rotationY, idle.rotationZ]) expect(rotation).toBeCloseTo(0, 10)
    const fired = mainBall(.65, 0, viewport)
    expect(fired.x - fired.radius).toBeGreaterThan(viewport.width)
    expect(fired.y).toBeLessThan(idle.y)
  })

  it('reduces phone geometry and caps pixel density', () => {
    expect(introQuality(390, 3)).toEqual({ balls: 96, dpr: 1.5 })
    expect(introQuality(1440, 3)).toEqual({ balls: 240, dpr: 1.75 })
  })
})
