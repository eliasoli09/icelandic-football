import { afterEach, expect, test, vi } from 'vitest'

const hooks = vi.hoisted(() => ({ refs: [] as unknown[], effect: undefined as undefined | (() => void | (() => void)) }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useId: () => 'tournament-test',
  useRef: () => ({ current: hooks.refs.shift() }),
  useEffect: (effect: () => void | (() => void)) => { hooks.effect = effect },
}))
import { TournamentBackground } from '../src/components/Uefa/TournamentBackground'

function mount(reduced = false, compact = false, active = true) {
  const motion = Object.assign(new EventTarget(), { matches: reduced })
  const document = Object.assign(new EventTarget(), { hidden: false })
  const hero = Object.assign(new EventTarget(), { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 162 }) })
  const path = { dataset: { group: '0', line: '0' }, setAttribute: vi.fn() }
  const root = { closest: () => ({ querySelector: () => hero }), dataset: { running: '', ready: '' }, querySelectorAll: () => [path], parentElement: { querySelector: () => hero } }
  const trophy = { style: { transform: '', setProperty: vi.fn() } }
  const frames = new Map<number, (time: number) => void>()
  let next = 0
  let intersection: (entries: { isIntersecting: boolean }[]) => void = () => {}
  const disconnect = vi.fn()
  const removeHero = vi.spyOn(hero, 'removeEventListener')
  const removeMotion = vi.spyOn(motion, 'removeEventListener')
  const removeVisibility = vi.spyOn(document, 'removeEventListener')
  vi.stubGlobal('window', {
    matchMedia: (query: string) => query.includes('reduced-motion') ? motion : { matches: query.includes('max-width') ? compact : true },
    requestAnimationFrame: (callback: (time: number) => void) => { frames.set(++next, callback); return next },
    cancelAnimationFrame: (id: number) => { frames.delete(id) },
  })
  vi.stubGlobal('document', document)
  vi.stubGlobal('performance', { now: () => 0 })
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof intersection) { intersection = callback }
    observe() {}
    disconnect = disconnect
  })
  hooks.refs = [root, trophy]
  TournamentBackground({ competition: 'uecl', active })
  const cleanup = hooks.effect!() as () => void
  const tick = (time: number) => {
    const frame = frames.entries().next().value
    if (frame) { frames.delete(frame[0]); frame[1](time) }
  }
  return { motion, document, root, trophy, path, frames, cleanup, tick, disconnect, removeHero, removeMotion, removeVisibility, intersect: (visible: boolean) => intersection([{ isIntersecting: visible }]) }
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('initial reduced motion is static and toggling it cancels and restores a single loop', () => {
  const view = mount(true)
  expect(view.frames.size).toBe(0)
  expect(view.root.dataset.running).toBe('false')
  view.motion.matches = false
  view.motion.dispatchEvent(new Event('change'))
  expect(view.frames.size).toBe(1)
  view.tick(0)
  view.tick(100)
  expect(view.trophy.style.transform).not.toBe('')
  view.motion.matches = true
  view.motion.dispatchEvent(new Event('change'))
  expect(view.frames.size).toBe(0)
  expect(view.trophy.style.transform).toBe('')
  view.cleanup()
})

test('visibility and intersection stop motion, resume without duplicate loops, and release resources', () => {
  const view = mount()
  view.document.hidden = true
  view.document.dispatchEvent(new Event('visibilitychange'))
  expect(view.frames.size).toBe(0)
  view.intersect(false)
  view.document.hidden = false
  view.document.dispatchEvent(new Event('visibilitychange'))
  expect(view.frames.size).toBe(0)
  view.intersect(true)
  view.intersect(true)
  expect(view.frames.size).toBe(1)
  view.tick(50)
  expect(view.frames.size).toBe(1)
  view.cleanup()
  expect(view.frames.size).toBe(0)
  expect(view.disconnect).toHaveBeenCalledOnce()
  expect(view.removeHero.mock.calls.map(call => call[0])).toEqual(['pointermove', 'pointerleave'])
  expect(view.removeMotion).toHaveBeenCalledWith('change', expect.any(Function))
  expect(view.removeVisibility).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
})

test('geometry follows elapsed time independent of refresh rate', () => {
  const a = mount()
  for (let t = 0; t <= 1000; t += 10) a.tick(t)
  const result = a.path.setAttribute.mock.calls.at(-1)
  a.cleanup()
  const b = mount()
  for (let t = 0; t <= 1000; t += 50) b.tick(t)
  expect(b.path.setAttribute.mock.calls.at(-1)).toEqual(result)
  expect(b.path.setAttribute.mock.calls.length).toBeLessThanOrEqual(31)
  b.cleanup()
})

test('phones update geometry at at most twenty frames per second', () => {
  const view = mount(false, true)
  for (let t = 0; t <= 1000; t += 10) view.tick(t)
  expect(view.path.setAttribute.mock.calls.length).toBeLessThanOrEqual(20)
  expect(view.path.setAttribute.mock.calls.length).toBeGreaterThan(15)
  view.cleanup()
})

test('outgoing crossfade layers stay static even when visible and motion is permitted', () => {
  const view = mount(false, false, false)
  view.intersect(true)
  expect(view.frames.size).toBe(0)
  expect(view.root.dataset.running).toBe('false')
  view.cleanup()
})
