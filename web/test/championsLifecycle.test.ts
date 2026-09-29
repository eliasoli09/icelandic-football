import { afterEach, expect, test, vi } from 'vitest'

const hooks = vi.hoisted(() => ({ refs: [] as unknown[], effect: undefined as undefined | (() => void | (() => void)) }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useId: () => 'test-background',
  useRef: () => ({ current: hooks.refs.shift() }),
  useEffect: (effect: () => void | (() => void)) => { hooks.effect = effect },
}))
import { ChampionsBackground } from '../src/components/Uefa/ChampionsBackground'

function mount(reduced = false) {
  const motion = Object.assign(new EventTarget(), { matches: reduced })
  const document = Object.assign(new EventTarget(), { hidden: false })
  const hero = new EventTarget()
  const root = { closest: () => ({ querySelector: () => hero }), dataset: { running: '' }, querySelectorAll: () => [], parentElement: { querySelector: () => hero } }
  const ball = { style: { transform: '' } }
  const frames = new Set<number>()
  let next = 0
  let intersection: (entries: { isIntersecting: boolean }[]) => void = () => {}
  const disconnect = vi.fn()
  const removeHero = vi.spyOn(hero, 'removeEventListener')
  const removeMotion = vi.spyOn(motion, 'removeEventListener')
  const removeVisibility = vi.spyOn(document, 'removeEventListener')
  vi.stubGlobal('window', {
    matchMedia: (query: string) => query.includes('reduced-motion') ? motion : { matches: false },
    requestAnimationFrame: () => { frames.add(++next); return next },
    cancelAnimationFrame: (id: number) => { frames.delete(id) },
  })
  vi.stubGlobal('document', document)
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof intersection) { intersection = callback }
    observe() {}
    disconnect = disconnect
  })
  hooks.refs = [root, ball]
  ChampionsBackground()
  const cleanup = hooks.effect!() as () => void
  return { motion, document, root, frames, cleanup, disconnect, removeHero, removeMotion, removeVisibility, intersect: (visible: boolean) => intersection([{ isIntersecting: visible }]) }
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('reduced motion starts static and toggling it cancels the animation loop', () => {
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

test('hidden tabs and offscreen regions pause, then resume with only one loop', () => {
  const view = mount()
  expect(view.frames.size).toBe(1)
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
  view.cleanup()
})

test('unmount releases the observer, loop and all registered event listeners', () => {
  const view = mount()
  view.cleanup()
  expect(view.frames.size).toBe(0)
  expect(view.disconnect).toHaveBeenCalledOnce()
  expect(view.removeHero.mock.calls.map(call => call[0])).toEqual(['pointermove', 'pointerleave'])
  expect(view.removeMotion).toHaveBeenCalledWith('change', expect.any(Function))
  expect(view.removeVisibility).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
})
