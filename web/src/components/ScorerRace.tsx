'use client'

import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'

export interface RaceRow {
  name: string
  current: number
  pWin: number
}

/** Animated horizontal race-bar chart for the golden-boot race. */
export function ScorerRace({ rows }: { rows: RaceRow[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-30px' })
  const reduce = useReducedMotion()
  const max = Math.max(...rows.map((r) => r.pWin), 0.01)
  return (
    <div ref={ref} className="grid gap-2.5">
      {rows.map((r, i) => (
        <div key={r.name} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium truncate">
              {i === 0 && <span aria-label="Efstur" title="Efstur í kapphlaupinu">👑 </span>}
              {r.name}
            </span>
            <span className="muted num text-xs shrink-0">
              {r.current} mörk · <span className="stat" style={{ color: 'var(--accent)' }}>{Math.round(r.pWin * 100)}%</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: i === 0 ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 45%, var(--draw))' }}
              initial={reduce ? { width: `${(r.pWin / max) * 100}%` } : { width: 0 }}
              animate={inView ? { width: `${(r.pWin / max) * 100}%` } : undefined}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }}
            />
          </div>
        </div>
      ))}
      {!rows.length && <p className="muted text-sm">Reiknast eftir innhleðslu.</p>}
    </div>
  )
}
