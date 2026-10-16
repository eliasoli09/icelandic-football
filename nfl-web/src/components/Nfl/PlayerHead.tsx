'use client'

import { useState } from 'react'
import { headshotUrl } from '@/lib/nfl/players'

/** A player's photo from the NFL, or initials in the club colour if it does not load. */
export function PlayerHead({ name, src, color, size = 40 }: { name: string; src: string | null; color?: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  const initials = name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  if (!src || broken) {
    return (
      <span aria-hidden className="inline-flex items-center justify-center rounded-full font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.36, background: color ?? 'var(--surface-2)', color: '#fff' }}>
        {initials}
      </span>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element -- remote NFL image with a fallback, no optimisation
  return <img src={headshotUrl(src, size)!} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)}
    className="rounded-full object-cover shrink-0" style={{ width: size, height: size, background: 'var(--surface-2)' }} />
}
