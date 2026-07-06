'use client'

import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'

/** Animated three-segment probability bar — fills on scroll-into-view. */
export function ProbBar({
  pHome,
  pDraw,
  pAway,
  compact = false,
}: {
  pHome: number
  pDraw: number
  pAway: number
  compact?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-30px' })
  const reduce = useReducedMotion()
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const h = compact ? 'h-6' : 'h-9'

  const seg = (
    p: number,
    bg: string,
    color: string,
    delay: number,
    label: string,
  ) => (
    <motion.div
      className={`flex items-center justify-center overflow-hidden whitespace-nowrap`}
      style={{ background: bg, color, minWidth: 0 }}
      initial={reduce ? { flexGrow: p } : { flexGrow: 0.0001 }}
      animate={inView ? { flexGrow: Math.max(p, 0.001) } : undefined}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
      aria-label={`${label} ${pct(p)}`}
    >
      <span className={`stat ${compact ? 'text-[11px]' : 'text-sm'} px-1`}>{pct(p)}</span>
    </motion.div>
  )

  return (
    <div ref={ref}>
      <div
        className={`flex w-full ${h} rounded-lg overflow-hidden num`}
        role="img"
        aria-label={`Sigurlíkur: heimasigur ${pct(pHome)}, jafntefli ${pct(pDraw)}, útisigur ${pct(pAway)}`}
      >
        {seg(pHome, 'var(--accent)', 'var(--accent-ink)', 0, 'Heimasigur')}
        {seg(pDraw, 'var(--surface-2)', 'var(--text-2)', 0.08, 'Jafntefli')}
        {seg(pAway, 'var(--ice)', '#0a1220', 0.16, 'Útisigur')}
      </div>
      {!compact && (
        <div className="flex justify-between text-[11px] mt-1.5 muted font-medium">
          <span>Heimasigur</span>
          <span>Jafntefli</span>
          <span>Útisigur</span>
        </div>
      )}
    </div>
  )
}
