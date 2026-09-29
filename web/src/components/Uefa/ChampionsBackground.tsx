'use client'

import { useEffect, useId, useRef } from 'react'
import { projectStarBall, roundedStarContour } from './starGeometry'
import styles from './ChampionsBackground.module.css'

const initialBall = projectStarBall(0)
const contourScales = Array.from({ length: 14 }, (_, i) => 640 + i * 19)
const edgePlacements = ['translate(-720 155) rotate(18)', 'translate(1760 -430) rotate(-18)', 'translate(-530 1060) rotate(-12)']

/** Decorative only. Mount inside a relative wrapper with foreground content at z-index: 1. */
export function ChampionsBackground({active = true}: {active?: boolean} = {}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLDivElement>(null)
  const id = useId().replace(/:/g, '')

  useEffect(() => {
    const root = rootRef.current
    const ball = ballRef.current
    if (!root || !ball) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const compact = window.matchMedia('(max-width: 640px)')
    const finePointer = window.matchMedia('(pointer: fine)')
    const starPaths = Array.from(root.querySelectorAll<SVGPathElement>('[data-star]'))
    const contours = Array.from(root.querySelectorAll<SVGPathElement>('[data-contour]'))
    const hero = root.closest('[data-uefa-theme]')?.querySelector<HTMLElement>('.uefa-hero') ?? root.parentElement
    let visible = true
    let frame = 0
    let elapsed = 0
    let lastTime = 0
    let lastPaint = 0
    let x = 0, y = 0, targetX = 0, targetY = 0

    const paint = (time: number) => {
      const delta = lastTime ? time - lastTime : 0
      lastTime = time
      elapsed += delta
      // Geometry changes at 30fps on desktop / 20fps on phones, with no React renders.
      if (time - lastPaint >= (compact.matches ? 50 : 32)) {
        const smoothing = 1 - Math.exp(-(time - lastPaint) / 580)
        lastPaint = time
        const stars = projectStarBall(elapsed / 72000 * Math.PI * 2)
        for (const path of starPaths) {
          const star = stars[Number(path.dataset.star)]
          path.setAttribute('d', star.path)
          path.setAttribute('opacity', String(star.opacity))
        }
        for (const path of contours) {
          if (compact.matches && Number(path.dataset.contour) % 2 === 1) continue
          const scale = contourScales[Number(path.dataset.contour)]
          path.setAttribute('d', roundedStarContour(scale, elapsed / 16000 * Math.PI * 2))
        }
        x += (targetX - x) * smoothing
        y += (targetY - y) * smoothing
        ball.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
      }
      frame = window.requestAnimationFrame(paint)
    }

    const sync = () => {
      window.cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
      lastPaint = performance.now()
      const running = active && visible && !document.hidden && !motion.matches
      root.dataset.running = String(running)
      if (motion.matches) {
        targetX = targetY = x = y = 0
        ball.style.transform = ''
      }
      if (running) frame = window.requestAnimationFrame(paint)
    }
    const pointerMove = (event: PointerEvent) => {
      if (!hero || motion.matches || !finePointer.matches) return
      const rect = hero.getBoundingClientRect()
      const heroHeight = Math.min(rect.height, 280)
      if (event.clientY < rect.top || event.clientY > rect.top + heroHeight) {
        targetX = targetY = 0
        return
      }
      targetX = Math.max(-6, Math.min(6, ((event.clientX - rect.left) / rect.width - 0.5) * 12))
      targetY = Math.max(-4, Math.min(4, ((event.clientY - rect.top) / heroHeight - 0.5) * 8))
    }
    const pointerLeave = () => { targetX = targetY = 0 }
    const observer = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false
      sync()
    }, { threshold: 0 })
    observer.observe(root)
    document.addEventListener('visibilitychange', sync)
    motion.addEventListener('change', sync)
    hero?.addEventListener('pointermove', pointerMove, { passive: true })
    hero?.addEventListener('pointerleave', pointerLeave, { passive: true })
    sync()
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      motion.removeEventListener('change', sync)
      hero?.removeEventListener('pointermove', pointerMove)
      hero?.removeEventListener('pointerleave', pointerLeave)
    }
  }, [active])

  return (
    <div ref={rootRef} className={styles.background} aria-hidden="true" data-running={String(active)}>
      <div className={styles.atmosphere} />
      <svg className={styles.contours} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMin slice" focusable="false">
        <defs>
          <linearGradient id={`${id}-contour`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#765dff" />
            <stop offset=".4" stopColor="#145dff" />
            <stop offset=".7" stopColor="#03c9ff" />
            <stop offset="1" stopColor="#4e44d5" />
          </linearGradient>
        </defs>
        {edgePlacements.map((placement, group) => (
          <g key={placement} transform={placement} className={styles.edgeGroup}>
            {contourScales.map((scale, index) => (
              <path key={index} data-contour={index} d={roundedStarContour(scale, 0)} pathLength="1" className={`${styles.contour} ${index % 2 ? styles.extraContour : ''}`} stroke={`url(#${id}-contour)`} />
            ))}
            {[2, 10].map((index) => (
              <path key={`glint-${index}`} data-contour={index} d={roundedStarContour(contourScales[index], 0)} pathLength="1" className={styles.glint} style={{ animationDelay: `${1.2 + group * 2 + index * 0.25}s` }} />
            ))}
          </g>
        ))}
      </svg>
      <div ref={ballRef} className={styles.ball}>
        <svg viewBox="0 0 500 500" focusable="false">
          <defs>
            <radialGradient id={`${id}-body`} cx="31%" cy="22%" r="79%">
              <stop stopColor="#093ec3" stopOpacity=".45" />
              <stop offset=".44" stopColor="#061341" stopOpacity=".42" />
              <stop offset=".8" stopColor="#020a2d" stopOpacity=".5" />
              <stop offset="1" stopColor="#5816a8" stopOpacity=".32" />
            </radialGradient>
            <linearGradient id={`${id}-seam`} x1="0" y1="0" x2="1" y2=".85">
              <stop stopColor="#71e9ff" />
              <stop offset=".28" stopColor="#1397ff" />
              <stop offset=".56" stopColor="#3560e5" />
              <stop offset=".83" stopColor="#c469ff" />
              <stop offset="1" stopColor="#f0aaff" />
            </linearGradient>
            <linearGradient id={`${id}-patch`} x1=".15" y1="0" x2=".9" y2="1">
              <stop stopColor="#108df5" stopOpacity=".12" />
              <stop offset=".48" stopColor="#08216c" stopOpacity=".04" />
              <stop offset="1" stopColor="#872ce9" stopOpacity=".19" />
            </linearGradient>
            <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2=".7">
              <stop stopColor="#27c9ff" />
              <stop offset=".3" stopColor="#1379fd" stopOpacity=".2" />
              <stop offset=".6" stopColor="#4772ff" stopOpacity=".12" />
              <stop offset="1" stopColor="#d171ff" />
            </linearGradient>
            <radialGradient id={`${id}-light`}>
              <stop stopColor="#38abff" stopOpacity=".2" />
              <stop offset="1" stopColor="#152dda" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="250" cy="250" r="249" fill={`url(#${id}-light)`} />
          <circle cx="250" cy="250" r="221" fill={`url(#${id}-body)`} />
          <circle cx="250" cy="250" r="221" fill="none" stroke={`url(#${id}-rim)`} className={styles.rimGlow} />
          <circle cx="250" cy="250" r="221" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.25" />
          {initialBall.map(star => (
            <path key={star.index} data-star={star.index} d={star.path} opacity={star.opacity} pathLength="1" fill={`url(#${id}-patch)`} stroke={`url(#${id}-seam)`} className={styles.star} />
          ))}
          {[3, 6, 9].map(index => (
            <path key={index} data-star={index} d={initialBall[index].path} opacity={initialBall[index].opacity} pathLength="1" className={`${styles.glint} ${styles.ballGlint}`} style={{ animationDelay: `${1.2 + index * 1.1}s` }} />
          ))}
        </svg>
      </div>
      <div className={styles.centerShade} />
    </div>
  )
}
