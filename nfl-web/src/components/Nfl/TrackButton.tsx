'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Eye } from 'lucide-react'
import { trackSlip } from './dashboard/store'
import type { BetLeg } from '@/lib/nfl/tracker'

/** "Fylgjast með": puts a slip on the reader's dashboard, where each leg is followed live. */
export function TrackButton({ name, legs, odds, fair = false }: { name: string; legs: BetLeg[]; odds: number | null; fair?: boolean }) {
  const [done, setDone] = useState(false)
  if (done) return <Link href="/stjornbord" className="text-xs inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--win)' }}><Check size={13} aria-hidden /> Á stjórnborðinu</Link>
  return (
    <button onClick={() => { trackSlip({ name, legs, odds, stake: null, fair }); setDone(true) }} className="text-xs inline-flex items-center gap-1 rounded-full border px-2.5 min-h-[30px]" style={{ borderColor: 'var(--border)' }}>
      <Eye size={13} aria-hidden /> Fylgjast með
    </button>
  )
}
