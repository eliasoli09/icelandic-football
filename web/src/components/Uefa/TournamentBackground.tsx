'use client'

import { useEffect, useId, useRef, type CSSProperties } from 'react'
import Image from 'next/image'
import { chevronContour, conferenceRibbon } from './tournamentGeometry'
import styles from './TournamentBackground.module.css'

export const TOURNAMENT_MOTION_DEFAULTS = {
  speed: 1,
  amplitude: 1,
  brightness: .82,
  lineCount: 12,
  pointerStrength: 6,
} as const

type TournamentBackgroundProps = {
  competition: 'uel' | 'uecl'
  /** Outgoing crossfade layers stay rendered but stop all animation. */
  active?: boolean
  /** Multipliers for the default 14–25 second motion and restrained curve deformation. */
  speed?: number
  amplitude?: number
  brightness?: number
  /** Per group; phones display every other line and omit the farthest group. */
  lineCount?: number
  /** Maximum pointer displacement in pixels; bounded to eight. Zero disables pointer response. */
  pointerStrength?: number
}

/** Decorative layer inside a relative wrapper; place foreground content at z-index: 1. */
export function TournamentBackground({
  competition,
  active: enabled = true,
  speed = TOURNAMENT_MOTION_DEFAULTS.speed,
  amplitude = TOURNAMENT_MOTION_DEFAULTS.amplitude,
  brightness = TOURNAMENT_MOTION_DEFAULTS.brightness,
  lineCount = TOURNAMENT_MOTION_DEFAULTS.lineCount,
  pointerStrength = TOURNAMENT_MOTION_DEFAULTS.pointerStrength,
}: TournamentBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const trophyRef = useRef<HTMLDivElement>(null)
  const id = useId().replace(/:/g, '')
  const count = Math.max(4, Math.min(20, Math.round(lineCount)))
  const intensity = Math.max(0, Math.min(1, brightness))
  const motionSpeed = Math.max(0, Math.min(3, speed))
  const motionAmplitude = Math.max(0, Math.min(2, amplitude))
  const pointerMax = Math.max(0, Math.min(8, pointerStrength))
  const pathAt = competition === 'uel' ? chevronContour : conferenceRibbon
  const asset = `/uefa/${competition}-trophy.png`
  const lines = Array.from({ length: count }, (_, index) => index)

  useEffect(() => {
    const root = rootRef.current
    const trophy = trophyRef.current
    if (!root || !trophy) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const compact = window.matchMedia('(max-width: 640px)')
    const finePointer = window.matchMedia('(pointer: fine)')
    const paths = Array.from(root.querySelectorAll<SVGPathElement>('[data-line]'))
    const hero = root.closest('[data-uefa-theme]')?.querySelector<HTMLElement>('.uefa-hero') ?? root.parentElement?.querySelector<HTMLElement>('.uefa-hero')
    let visible = true, active = false, disposed = false
    let frame = 0, elapsed = 0, lastPaint = 0
    let lastTime: number | null = null
    let x = 0, y = 0, targetX = 0, targetY = 0

    const renderPaths = (seconds: number) => {
      for (const path of paths) {
        const line = Number(path.dataset.line), group = Number(path.dataset.group)
        if (compact.matches && (line % 2 === 1 || group === 2)) continue
        path.setAttribute('d', pathAt(line, seconds, group, motionAmplitude))
      }
    }
    const paint = (time: number) => {
      frame = 0
      if (!active || disposed) return
      elapsed += lastTime === null ? 0 : time - lastTime
      lastTime = time
      const paintDelta = time - lastPaint
      if (paintDelta >= (compact.matches ? 50 : 1000 / 30)) {
        lastPaint = time
        const seconds = elapsed / 1000 * motionSpeed
        renderPaths(seconds)
        const smoothing = 1 - Math.exp(-paintDelta / 580)
        x += (targetX - x) * smoothing
        y += (targetY - y) * smoothing
        // The photograph remains upright; independent masked light gives the metal depth.
        const driftX = Math.sin(seconds / 18 * Math.PI * 2) * 2.5 * motionAmplitude
        const driftY = Math.sin(seconds / 23 * Math.PI * 2 + .7) * 2 * motionAmplitude
        trophy.style.transform = `translate3d(${Math.max(-8, Math.min(8, x + driftX)).toFixed(2)}px, ${Math.max(-6, Math.min(6, y + driftY)).toFixed(2)}px, 0)`
        trophy.style.setProperty('--light-x', `${48 + Math.sin(seconds / 19 * Math.PI * 2) * 33}%`)
        trophy.style.setProperty('--light-y', `${32 + Math.cos(seconds / 23 * Math.PI * 2) * 24}%`)
      }
      frame = window.requestAnimationFrame(paint)
    }
    const sync = () => {
      window.cancelAnimationFrame(frame)
      frame = 0
      lastTime = null
      lastPaint = performance.now()
      active = enabled && visible && !document.hidden && !motion.matches && !disposed
      root.dataset.running = String(active)
      root.dataset.ready = 'true'
      if (motion.matches) {
        targetX = targetY = x = y = 0
        renderPaths(0)
        trophy.style.transform = ''
        trophy.style.setProperty('--light-x', '48%')
        trophy.style.setProperty('--light-y', '32%')
      }
      if (active) frame = window.requestAnimationFrame(paint)
    }
    const pointerMove = (event: PointerEvent) => {
      if (!hero || !active || !finePointer.matches) return
      const rect = hero.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      targetX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)) * pointerMax
      targetY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) * pointerMax * .65
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
      disposed = true
      active = false
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      motion.removeEventListener('change', sync)
      hero?.removeEventListener('pointermove', pointerMove)
      hero?.removeEventListener('pointerleave', pointerLeave)
    }
  }, [enabled, pathAt, motionSpeed, motionAmplitude, pointerMax, count])

  const contour = (line: number, group: number, glint = false) => (
    <path
      key={`${group}-${line}-${glint}`}
      data-group={group}
      data-line={line}
      d={pathAt(line, 0, group, motionAmplitude)}
      pathLength="1"
      stroke={glint ? undefined : `url(#${id}-color)`}
      className={`${glint ? styles.glint : styles.contour} ${line % 2 ? styles.extraLine : ''}`}
      style={{ animationDelay: `${glint ? 1.2 + group * 3 + line * .4 : group * .06}s`, animationDuration: glint ? `${(18 + group * 2) / (motionSpeed || 1)}s` : undefined }}
    />
  )

  return (
    <div ref={rootRef} className={`${styles.background} ${competition === 'uel' ? styles.europa : styles.conference}`} style={{ '--art-brightness': intensity, '--trophy-mask': `url("${asset}")` } as CSSProperties} data-running="false" data-ready="false" data-active={String(enabled)} aria-hidden="true">
      <div className={styles.atmosphere} />
      <svg className={styles.contours} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMin slice" focusable="false">
        <defs>
          <linearGradient id={`${id}-color`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={competition === 'uel' ? '#ff6900' : '#00d74a'} stopOpacity=".42" />
            <stop offset=".45" stopColor={competition === 'uel' ? '#ff9a38' : '#55f2b2'} />
            <stop offset="1" stopColor={competition === 'uel' ? '#ff6900' : '#00d74a'} stopOpacity=".5" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map(group => (
          <g key={group} className={`${styles.edgeGroup} ${group === 2 ? styles.farGroup : ''}`} opacity={[.78, .28, .36][group]}>
            {lines.map(line => contour(line, group))}
            {[2, 8].filter(line => line < count).map(line => contour(line, group, true))}
          </g>
        ))}
      </svg>
      <div ref={trophyRef} className={styles.trophy}>
        {/* A real trophy cutout is shared by the image and exact silhouette lighting masks. */}
        <Image src={asset} width={1024} height={1536} sizes="(max-width: 640px) 154px, (max-width: 900px) 194px, 218px" alt="" draggable={false} className={styles.trophyImage} />
        <div className={styles.trophyShade} />
        <div className={styles.trophyLight} />
      </div>
      {competition === 'uecl' && (
        <svg className={`${styles.contours} ${styles.foregroundThreads}`} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMin slice" focusable="false">
          {[0, 4].map(line => contour(line, 0))}
        </svg>
      )}
      <div className={styles.readabilityShade} />
    </div>
  )
}
