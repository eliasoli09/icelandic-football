'use client'

import { useEffect, useRef } from 'react'
import { drawWaves, resolveColor, type RGB } from './draw'
import { waveQuality, waveSettings, type WaveSettings } from './field'
import styles from './LightWaves.module.css'

export type LightWavesProps = Partial<WaveSettings> & {
  /** Any CSS colour. Changing this preserves the ongoing motion. */
  color?: string
  className?: string
}

/** Decorative, self-sizing background. Its parent must be positioned.
 * Pointer input is observed on that parent; the canvas never intercepts it. */
export function LightWaves({ color = '#e8b93c', className = '', ...options }: LightWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const setColorRef = useRef<((color: string) => void) | null>(null)
  const latestColor = useRef(color)
  const { speed, amplitude, threadCount, brightness, particleCount, mouseInfluence } = waveSettings(options)

  useEffect(() => {
    latestColor.current = color
    setColorRef.current?.(color)
  }, [color])

  useEffect(() => {
    const canvas = canvasRef.current
    const region = canvas?.parentElement
    const host = region?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !region || !host || !ctx) return

    const settings = { speed, amplitude, threadCount, brightness, particleCount, mouseInfluence }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    let width = 0
    let height = 0
    let quality = waveQuality(0, window.devicePixelRatio || 1, settings)
    let visible = false
    let disposed = false
    let frame: number | null = null
    let previous: number | null = null
    // A composed first frame, also used by the static reduced-motion version.
    let elapsed = 7.5
    let rgb = resolveColor(latestColor.current)
    let targetColor = rgb
    const pointer = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }

    const draw = () => drawWaves(ctx, width, height, elapsed, rgb, pointer, settings, quality)
    const canDraw = () => !disposed && visible && !document.hidden && width > 0 && height > 0
    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      previous = null
    }

    const tick = (now: number) => {
      frame = null
      if (!canDraw() || reduced.matches) { previous = null; return }
      const dt = previous === null ? 0 : Math.max(0, (now - previous) / 1000)
      previous = now
      elapsed += dt * speed
      // Exponential damping has the same response at 30, 60 and 120 Hz.
      const follow = 1 - Math.exp(-dt * 2.2)
      pointer.x += (target.x - pointer.x) * follow
      pointer.y += (target.y - pointer.y) * follow
      const blend = 1 - Math.exp(-dt * 3)
      rgb = rgb.map((v, i) => v + (targetColor[i] - v) * blend) as RGB
      draw()
      frame = requestAnimationFrame(tick)
    }

    const sync = () => {
      if (!canDraw()) { stop(); return }
      if (reduced.matches) {
        stop()
        pointer.x = pointer.y = 0
        rgb = targetColor
        draw()
      } else if (frame === null) {
        frame = requestAnimationFrame(tick)
      }
    }

    const resize = () => {
      const rect = region.getBoundingClientRect()
      width = rect.width
      height = rect.height
      quality = waveQuality(width, window.devicePixelRatio || 1, settings)
      const pixelWidth = Math.max(1, Math.round(width * quality.dpr))
      const pixelHeight = Math.max(1, Math.round(height * quality.dpr))
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
        ctx.setTransform(quality.dpr, 0, 0, quality.dpr, 0, 0)
      }
      sync()
    }

    setColorRef.current = (nextColor) => { targetColor = resolveColor(nextColor); sync() }
    const onMove = (event: PointerEvent) => {
      if (!finePointer.matches || reduced.matches || quality.mobile || !visible) return
      const bounds = host.getBoundingClientRect()
      target.x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2))
      target.y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2))
    }
    const resetPointer = () => { target.x = target.y = 0 }
    const motionChange = () => { resetPointer(); sync() }
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (!visible) resetPointer()
      sync()
    }, { threshold: 0 })
    const observer = new ResizeObserver(resize)
    intersection.observe(host)
    observer.observe(region)
    host.addEventListener('pointermove', onMove, { passive: true })
    host.addEventListener('pointerleave', resetPointer, { passive: true })
    document.addEventListener('visibilitychange', sync)
    reduced.addEventListener('change', motionChange)
    finePointer.addEventListener('change', resetPointer)
    window.addEventListener('resize', resize, { passive: true })
    resize()

    return () => {
      disposed = true
      stop()
      setColorRef.current = null
      intersection.disconnect()
      observer.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', resetPointer)
      document.removeEventListener('visibilitychange', sync)
      reduced.removeEventListener('change', motionChange)
      finePointer.removeEventListener('change', resetPointer)
      window.removeEventListener('resize', resize)
    }
  }, [speed, amplitude, threadCount, brightness, particleCount, mouseInfluence])

  return (
    <div
      className={`${styles.background} ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
