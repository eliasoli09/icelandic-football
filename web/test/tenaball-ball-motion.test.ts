import { afterEach, expect, test, vi } from 'vitest'
import { startStarBallMotion } from '../src/components/Topp10/starBallMotion'

function mount(reduced = false) {
  const motion = Object.assign(new EventTarget(), { matches: reduced })
  const doc = Object.assign(new EventTarget(), { hidden: false })
  const root = { dataset: {} } as HTMLElement
  const paint = vi.fn()
  const frames = new Map<number, (t: number) => void>()
  let n = 0
  let intersect: (entries: { isIntersecting: boolean }[]) => void = () => {}
  const disconnect = vi.fn()
  const removeMotion = vi.spyOn(motion, 'removeEventListener')
  const removeDocument = vi.spyOn(doc, 'removeEventListener')
  vi.stubGlobal('matchMedia', () => motion)
  vi.stubGlobal('document', doc)
  vi.stubGlobal('requestAnimationFrame', (fn: (t: number) => void) => { frames.set(++n, fn); return n })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('IntersectionObserver', class {
    constructor(fn: typeof intersect) { intersect = fn }
    observe() {}
    disconnect = disconnect
  })
  const controller = startStarBallMotion(root, paint)
  const tick = (time: number) => { const [id, fn] = [...frames][0]; frames.delete(id); fn(time) }
  return { motion, doc, root, paint, frames, controller, tick, disconnect, removeMotion, removeDocument, intersect: (visible: boolean) => intersect([{ isIntersecting: visible }]) }
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('turns in depth and returns to the identical pose every 12 seconds', () => {
  const v = mount()
  v.tick(100)
  v.tick(6100)
  expect(v.paint.mock.lastCall![0]).toBeCloseTo(Math.PI)
  v.tick(12100)
  expect(v.paint.mock.lastCall![0]).toBe(0)
  v.controller.dispose()
})
test('reduced motion renders a static ball and never starts a frame loop', () => {
  const v = mount(true)
  expect(v.paint).toHaveBeenCalledWith(0)
  expect(v.frames.size).toBe(0)
  v.motion.matches = false
  v.motion.dispatchEvent(new Event('change'))
  expect(v.frames.size).toBe(1)
  v.motion.matches = true
  v.motion.dispatchEvent(new Event('change'))
  expect(v.frames.size).toBe(0)
  v.controller.dispose()
})
test('pauses when hidden/offscreen and resumes without a time jump', () => {
  const v = mount()
  v.tick(100); v.tick(1100)
  const pose = v.paint.mock.lastCall
  v.doc.hidden = true
  v.doc.dispatchEvent(new Event('visibilitychange'))
  expect(v.frames.size).toBe(0)
  v.intersect(false)
  v.doc.hidden = false
  v.doc.dispatchEvent(new Event('visibilitychange'))
  expect(v.frames.size).toBe(0)
  v.intersect(true)
  v.tick(90100)
  expect(v.paint.mock.lastCall).toEqual(pose)
  v.controller.dispose()
})
test('disposes all frames, observers and listeners', () => {
  const v = mount()
  v.controller.dispose()
  expect(v.frames.size).toBe(0)
  expect(v.disconnect).toHaveBeenCalledOnce()
  expect(v.removeMotion).toHaveBeenCalledWith('change', expect.any(Function))
  expect(v.removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
})
