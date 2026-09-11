'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Shield, ArrowUpRight } from 'lucide-react'
import { EntranceClockContext } from './EntranceClock'
import { deformY, entranceFrame, flowPoint, followerX, introQuality, mainBall, smooth, trailOpacity, waveRect, WAVE_START, type Rect } from './timeline'
import { drawWaves, resolveColor, type RGB } from '../LightWaves/draw'
import { seed, waveQuality, waveSettings } from '../LightWaves/field'
import type { BallInstance, BallRenderer } from './BallRenderer'
import waveStyles from '../LightWaves/LightWaves.module.css'
import styles from './HomeEntrance.module.css'

const SESSION_KEY = 'besta-spain:entrance:v1'
let consumed = false

/** This shell streams before the async dashboard finishes loading. The intro
 * owns only decoration and focus; actual page content stays mounted underneath. */
export function HomeEntrance({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true)
  const [ready, setReady] = useState(false)
  const [running, setRunning] = useState(false)
  const clock = useRef({ active: false, waveTime: WAVE_START, heroVisible: false })
  const contentRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const ballCanvasRef = useRef<HTMLCanvasElement>(null)
  const waveCanvasRef = useRef<HTMLCanvasElement>(null)
  const waveRegionRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)
  const controls = useRef<{ start: () => void; finish: () => void } | null>(null)

  useEffect(() => {
    if (!visible) return
    const html = document.documentElement
    let seen = consumed
    try { seen ||= sessionStorage.getItem(SESSION_KEY) === 'seen' } catch { /* Memory fallback still handles SPA returns. */ }
    if (seen) {
      delete html.dataset.entrance
      setVisible(false)
      return
    }
    const overlay = overlayRef.current
    const canvas = ballCanvasRef.current
    const waves = waveCanvasRef.current
    const region = waveRegionRef.current
    const ctx = waves?.getContext('2d')
    if (!overlay || !canvas || !waves || !region || !ctx) { setVisible(false); delete html.dataset.entrance; return }

    let disposed = false
    let finished = false
    let started = false
    let destinationReady = false
    let renderer: BallRenderer | null = null
    let frame: number | null = null
    let previous: number | null = null
    let time = 0
    let idleTime = 0
    let viewport: Rect = { x: 0, y: 0, width: innerWidth, height: innerHeight }
    let hero: Rect = viewport
    let palette: RGB = [232, 185, 60]
    let targetPalette: RGB = palette
    let quality = introQuality(innerWidth, devicePixelRatio)
    const settings = waveSettings()
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const scrollY = window.scrollY
    const previousOverflow = document.body.style.overflow
    const previousPadding = document.body.style.paddingRight
    const scrollbar = innerWidth - html.clientWidth
    const blocked = [contentRef.current, document.querySelector('.league-theme > header'), document.querySelector('.league-theme > footer')]
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
      .map(el => ({ el, inert: el.inert }))

    html.dataset.entrance = 'waiting'
    clock.current.active = true
    blocked.forEach(({ el }) => { el.inert = true })
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
    window.scrollTo(0, 0)

    const remember = () => {
      consumed = true
      html.dataset.entranceSeen = 'true'
      try { sessionStorage.setItem(SESSION_KEY, 'seen') } catch { /* Storage can be disabled. */ }
    }
    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      previous = null
    }
    const releasePage = () => {
      delete html.dataset.entrance
      html.style.removeProperty('--entrance-hero')
      html.style.removeProperty('--entrance-content')
      html.style.removeProperty('--entrance-handoff')
      blocked.forEach(({ el, inert }) => { el.inert = inert })
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPadding
    }
    const finish = () => {
      if (finished || disposed) return
      finished = true
      remember()
      stop()
      clock.current.active = false
      releasePage()
      setVisible(false)
      const target = contentRef.current?.querySelector('[data-entrance-focus]') ?? document.querySelector('header a')
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true })
      }
    }

    const measure = () => {
      viewport = { x: 0, y: 0, width: innerWidth, height: innerHeight }
      quality = introQuality(viewport.width, devicePixelRatio)
      renderer?.resize(viewport.width, viewport.height, quality.dpr)
      // Allocate once per viewport resize, not on every frame of the morph.
      waves.width = Math.round(viewport.width * quality.dpr)
      waves.height = Math.round(viewport.height * quality.dpr)
      const element = contentRef.current?.querySelector('.wave-hero')
      if (element) {
        const r = element.getBoundingClientRect()
        // Match the background's inner border box exactly.
        hero = { x: r.x + 1, y: r.y + 1, width: r.width - 2, height: r.height - 2 }
        targetPalette = resolveColor(getComputedStyle(element).getPropertyValue('--accent').trim() || '#e8b93c')
        destinationReady = true
        if (renderer) setReady(true)
      } else {
        if (contentRef.current?.querySelector('p') && !contentRef.current.querySelector('[role="status"]')) {
          finish()
          return
        }
        hero = { x: Math.max(16, (innerWidth - 1120) / 2), y: 89, width: Math.min(innerWidth - 32, 1120), height: innerWidth < 768 ? 440 : 360 }
      }
    }

    const paint = () => {
      if (!renderer || disposed || finished) return
      const t = started ? time : -1
      const state = entranceFrame(t)
      const main = mainBall(t, reduced.matches ? 0 : idleTime, viewport)
      overlay.style.setProperty('--ball-x', `${main.x}px`)
      overlay.style.setProperty('--ball-y', `${main.y}px`)
      overlay.style.setProperty('--ball-r', `${main.radius}px`)
      overlay.style.setProperty('--charge', String(state.charge))
      overlay.style.setProperty('--launch', String(smooth(.22, .42, t)))
      overlay.style.setProperty('--floor-opacity', String(1 - smooth(.2, .7, t)))
      const balls: BallInstance[] = []
      if (main.alpha > 0) balls.push(main)
      if (started && !reduced.matches) {
        const rect = waveRect(viewport, hero, t)
        const q = waveQuality(rect.width, quality.dpr, settings)
        // Keep the strand identity stable throughout the viewport contraction.
        q.threads = waveQuality(hero.width, quality.dpr, settings).threads
        for (let i = 0; i < quality.balls && state.balls > 0; i++) {
          const lane = i % q.threads
          const layer = lane % 3
          const strand = Math.floor(lane / 3) / (q.threads / 3 - 1) - .5
          const x = followerX(i, t)
          const p = flowPoint(x, strand, layer, t, clock.current.waveTime, rect)
          const size = (viewport.width < 768 ? 4 : 6) + seed(i + 100) * (viewport.width < 768 ? 8 : 13)
          const alpha = state.balls * smooth(-.08, .04, x) * (1 - smooth(1, 1.1, x))
          if (alpha > .002) balls.push({
            ...p, radius: size * (1 - smooth(1.1, 2.2, t) * .96),
            rotationX: t * .5 + seed(i) * 2,
            rotationY: t * 1.5 + seed(i + 2) * 6, rotationZ: t * -.35,
            alpha, logo: false,
          })
        }
        region.style.left = `${rect.x}px`
        region.style.top = `${rect.y}px`
        region.style.width = `${rect.width}px`
        region.style.height = `${rect.height}px`
        // The settled hero fades in as one opaque composition over this same
        // frame. Keep the source present until the handoff is fully covered.
        region.style.opacity = '1'
        region.style.setProperty('--settle', String(smooth(1.5, 2.7, t)))
        ctx.setTransform(waves.width / rect.width, 0, 0, waves.height / rect.height, 0, 0)
        drawWaves(ctx, rect.width, rect.height, clock.current.waveTime, palette, { x: 0, y: 0 }, settings, q, {
          deform: (x, strand, layer, y) => deformY(x, strand, layer, y, t),
          opacity: (x, index, layer) => trailOpacity(x, index, layer, q.threads, quality.balls, t),
          particles: smooth(1.4, 2.2, t),
        })
        html.style.setProperty('--entrance-hero', String(state.hero))
        html.style.setProperty('--entrance-content', String(state.content))
        html.style.setProperty('--entrance-handoff', String(smooth(2.75, 3.05, t)))
        clock.current.heroVisible = t >= 2.7
        if (t >= 2.2) html.dataset.entrance = 'reveal'
        overlay.style.setProperty('--backdrop', String(1 - smooth(2.2, 2.8, t)))
      }
      renderer.render(balls)
    }

    const tick = (now: number) => {
      frame = null
      if (disposed || finished || document.hidden) { previous = null; return }
      const dt = previous === null ? 0 : (now - previous) / 1000
      previous = now
      if (started) {
        time += dt
        if (reduced.matches) {
          overlay.style.setProperty('--overlay-opacity', String(1 - smooth(0, .18, time)))
          if (time >= .18) { finish(); return }
        } else {
          clock.current.waveTime += dt
          const blend = smooth(1.5, 2.7, time)
          palette = [232, 185, 60].map((v, i) => v + (targetPalette[i] - v) * blend) as RGB
          if (entranceFrame(time).complete) { finish(); return }
        }
      } else idleTime += dt
      paint()
      if (!reduced.matches || started) frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      stop()
      if (document.hidden || !renderer || disposed || finished) return
      paint()
      if (!reduced.matches || started) frame = requestAnimationFrame(tick)
    }
    const start = () => {
      if (started || !renderer || !destinationReady || disposed || finished) return
      started = true
      remember()
      setRunning(true)
      skipRef.current?.focus({ preventScroll: true })
      html.dataset.entrance = 'running'
      if (reduced.matches) {
        html.style.setProperty('--entrance-hero', '1')
        html.style.setProperty('--entrance-content', '1')
        html.style.setProperty('--entrance-handoff', '1')
      }
      sync()
    }
    controls.current = { start, finish }
    const onResize = () => { measure(); sync() }
    const onLost = (event: Event) => { event.preventDefault(); finish() }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); finish() }
      if (event.key === 'Tab') {
        const buttons = [startRef.current, skipRef.current].filter((el): el is HTMLButtonElement => !!el && !el.disabled)
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
        event.preventDefault()
        buttons[next]?.focus()
      }
    }
    const observer = new ResizeObserver(onResize)
    if (contentRef.current) observer.observe(contentRef.current)
    window.addEventListener('resize', onResize, { passive: true })
    document.addEventListener('visibilitychange', sync)
    document.addEventListener('keydown', onKey)
    reduced.addEventListener('change', sync)
    canvas.addEventListener('webglcontextlost', onLost)

    // A missing image, unsupported GPU or delayed chunk must never trap visitors.
    const timeout = window.setTimeout(finish, 8000)
    const logo = new Image()
    logo.onload = async () => {
      try {
        const { BallRenderer } = await import('./BallRenderer')
        if (disposed || finished) return
        renderer = new BallRenderer(canvas, logo)
        clearTimeout(timeout)
        measure()
        sync()
        if (startRef.current && destinationReady) {
          startRef.current.disabled = false
          if (!overlay.contains(document.activeElement)) startRef.current.focus({ preventScroll: true })
        }
      } catch { finish() }
    }
    logo.onerror = finish
    logo.src = '/intro/besta-deild-logo.png'
    measure()
    skipRef.current?.focus({ preventScroll: true })

    return () => {
      disposed = true
      stop()
      clearTimeout(timeout)
      logo.onload = logo.onerror = null
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', sync)
      document.removeEventListener('keydown', onKey)
      reduced.removeEventListener('change', sync)
      canvas.removeEventListener('webglcontextlost', onLost)
      renderer?.dispose()
      controls.current = null
      clock.current.active = false
      releasePage()
      if (!finished) {
        window.scrollTo(0, scrollY)
        previousFocus?.focus({ preventScroll: true })
      }
    }
  }, [visible])

  return (
    <EntranceClockContext.Provider value={clock}>
      <div ref={contentRef} className="entrance-page">{children}</div>
      {visible && (
        <div ref={overlayRef} className={`${styles.overlay} entrance-overlay`} role="dialog" aria-modal="true" aria-label="Velkomin í Bestu spána">
          <div className={`${styles.scene} entrance-scene`} aria-hidden="true">
            <div className={styles.backdrop} />
            <div className={styles.floor} />
            <div ref={waveRegionRef} className={`${styles.waves} ${waveStyles.background}`}>
              <canvas ref={waveCanvasRef} className={waveStyles.canvas} />
            </div>
            <canvas ref={ballCanvasRef} className={styles.balls} />
          </div>
          <div className={styles.brand}><Shield size={23} aria-hidden="true" /><span>Besta spáin</span></div>
          <button ref={skipRef} className={styles.skip} onClick={() => controls.current?.finish()}>Sleppa inngangi <ArrowUpRight size={15} aria-hidden="true" /></button>
          <button ref={startRef} className={styles.start} disabled={!ready || running} onClick={() => controls.current?.start()}>
            <span>{ready ? 'BYRJA' : 'HLEÐ…'}</span>
          </button>
          <p className={styles.caption} aria-hidden="true">Leikurinn byrjar hér.</p>
          <span className="sr-only" role="status">{running ? 'Opna Bestu spána…' : 'Veldu BYRJA til að opna síðuna eða slepptu innganginum.'}</span>
        </div>
      )}
      <noscript><style>{'.entrance-overlay{display:none!important}html[data-entrance] .entrance-page,html[data-entrance] header,html[data-entrance] footer{opacity:1!important}'}</style></noscript>
    </EntranceClockContext.Provider>
  )
}
