'use client'

import { useEffect, useId, useRef } from 'react'
import { projectStarBall, roundedStarContour } from '../Uefa/starGeometry'
import styles from './Tenaball.module.css'

const stars = projectStarBall(0).filter(s => s.depth > -0.1).sort((a, b) => a.depth - b.depth)
export function StarBall({ className = '' }: { className?: string }) {
  const id = useId().replaceAll(':', '')
  return <svg viewBox="0 0 500 500" className={className} aria-hidden="true">
    <defs><radialGradient id={id} cx="30%" cy="20%" r="80%"><stop stopColor="#175fff"/><stop offset=".5" stopColor="#041750"/><stop offset="1" stopColor="#010720"/></radialGradient></defs>
    <circle cx="250" cy="250" r="222" fill={`url(#${id})`} stroke="currentColor" strokeWidth="2"/>
    {stars.map(s => <path key={s.index} d={s.path} fill="currentColor" fillOpacity={s.opacity} stroke="currentColor" strokeWidth="1.5"/>)}
  </svg>
}

export function TenaballScene() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current!
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const mobile = matchMedia('(max-width: 700px)')
    const paths = Array.from(root.querySelectorAll<SVGPathElement>('[data-contour]'))
    let visible = true, frame = 0, elapsed = 0, previous = 0, painted = 0
    const paint = (time: number) => {
      elapsed += previous ? time - previous : 0
      previous = time
      if (time - painted > (mobile.matches ? 65 : 32)) {
        paths.forEach(p => p.setAttribute('d', roundedStarContour(Number(p.dataset.contour), elapsed / 16000 * Math.PI * 2)))
        painted = time
      }
      frame = requestAnimationFrame(paint)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      previous = 0
      const running = visible && !document.hidden && !motion.matches
      root.dataset.running = String(running)
      if (running) frame = requestAnimationFrame(paint)
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    observer.observe(root)
    document.addEventListener('visibilitychange', sync)
    motion.addEventListener('change', sync)
    sync()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', sync); motion.removeEventListener('change', sync) }
  }, [])
  return <div className={styles.scenery} ref={ref} aria-hidden="true">
    <div className={styles.aurora}/>
    <StarBall className={styles.ghostBall}/>
    <StarBall className={styles.lowerBall}/>
    <svg className={styles.contours} viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
      {['translate(-385 260) rotate(12)', 'translate(1500 220) rotate(-22)'].map((transform, side) => <g key={side} transform={transform}>
        {Array.from({ length: 11 }, (_, i) => <path key={i} data-contour={510 + i * 20} d={roundedStarContour(510 + i * 20, 0)} fill="none" stroke={i % 4 === 0 ? '#914DFF' : '#168dff'} strokeWidth={i % 4 === 0 ? 1.8 : .9} opacity={i % 4 === 0 ? .8 : .48}/>)}
        <path className={styles.tracer} d={roundedStarContour(590, 0)} fill="none" stroke="#85f6ff" strokeWidth="2.5" pathLength="100" strokeDasharray="7 93"/>
      </g>)}
    </svg>
    <div className={styles.shade}/>
  </div>
}
