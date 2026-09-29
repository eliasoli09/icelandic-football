import { afterEach, expect, test, vi } from 'vitest'
import { roundedStarContour } from '../src/components/Uefa/starGeometry'

const hooks = vi.hoisted(() => ({ root: undefined as unknown, effect: undefined as undefined | (() => void | (() => void)) }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useRef: () => ({ current: hooks.root }),
  useEffect: (effect: () => void | (() => void)) => { hooks.effect = effect },
}))
import { TenaballScene } from '../src/components/Topp10/TenaballScene'

function mount(reduced = false) {
  const motion = Object.assign(new EventTarget(), { matches: reduced })
  const doc = Object.assign(new EventTarget(), { hidden: false })
  const paths = [{ dataset: { contour: '590' }, setAttribute: vi.fn() }]
  const root = { dataset: { running: '' }, querySelectorAll: () => paths }
  const frames = new Map<number, (time: number) => void>()
  let id = 0
  let intersect: (entries: { isIntersecting: boolean }[]) => void = () => {}
  const disconnect = vi.fn()
  const removeMotion = vi.spyOn(motion, 'removeEventListener')
  const removeVisibility = vi.spyOn(doc, 'removeEventListener')
  vi.stubGlobal('matchMedia', (q: string) => q.includes('reduced-motion') ? motion : { matches: false })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('requestAnimationFrame', (fn: (time: number) => void) => { frames.set(++id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('IntersectionObserver', class {
    constructor(fn: typeof intersect) { intersect = fn }
    observe() {}
    disconnect = disconnect
  })
  hooks.root = root
  TenaballScene()
  const cleanup = hooks.effect!() as () => void
  const tick = (time: number) => { const [key, fn] = [...frames][0]; frames.delete(key); fn(time) }
  return { root, doc, motion, frames, paths, cleanup, disconnect, removeMotion, removeVisibility, tick, intersect: (visible: boolean) => intersect([{ isIntersecting: visible }]) }
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('reduced motion cancels drawing and pauses all background CSS animations', () => {
  const view = mount(true)
  expect(view.frames.size).toBe(0)
  expect(view.root.dataset.running).toBe('false')
  view.motion.matches = false
  view.motion.dispatchEvent(new Event('change'))
  expect(view.frames.size).toBe(1)
  view.motion.matches = true
  view.motion.dispatchEvent(new Event('change'))
  expect(view.frames.size).toBe(0)
  view.cleanup()
})

test('hidden/offscreen pauses and resume does not jump ahead by hidden wall time', () => {
  const v = mount()
  v.tick(100)
  v.tick(500)
  const before = v.paths[0].setAttribute.mock.lastCall
  v.doc.hidden = true
  v.doc.dispatchEvent(new Event('visibilitychange'))
  expect(v.frames.size).toBe(0)
  v.intersect(false)
  v.doc.hidden = false
  v.doc.dispatchEvent(new Event('visibilitychange'))
  expect(v.frames.size).toBe(0)
  v.intersect(true)
  v.tick(60_000)
  expect(v.paths[0].setAttribute.mock.lastCall).toEqual(before)
  expect(v.frames.size).toBe(1)
  v.cleanup()
})

test('the rendered contour returns to the identical shape after two 16-second loops', () => {
  const v = mount()
  v.tick(100)
  const initial = v.paths[0].setAttribute.mock.lastCall
  for (let t = 200; t <= 32_100; t += 100) v.tick(t)
  expect(v.paths[0].setAttribute.mock.lastCall).toEqual(initial)
  expect(roundedStarContour(590, 2 * Math.PI + .01)).toBe(roundedStarContour(590, .01))
  v.cleanup()
})

test('unmount clears the loop, observer and listeners', () => {
  const v = mount()
  v.cleanup()
  expect(v.frames.size).toBe(0)
  expect(v.disconnect).toHaveBeenCalledOnce()
  expect(v.removeMotion).toHaveBeenCalledWith('change', expect.any(Function))
  expect(v.removeVisibility).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
})
