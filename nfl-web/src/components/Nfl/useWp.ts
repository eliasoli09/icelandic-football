'use client'

import { useEffect, useState } from 'react'
import type { WpReply } from '@/app/api/nfl/live/wp/route'
import type { WpPoint } from '@/lib/nfl/winChart'

/** The stored win chances of these games, fetched again every `every` seconds while the page is visible. */
export function useWp(ids: string[], every = 60): Record<string, WpPoint[]> {
  const [wp, setWp] = useState<Record<string, WpPoint[]>>({})
  const key = [...ids].sort().join(',')
  useEffect(() => {
    if (!key) return
    let alive = true
    const load = async () => {
      if (document.hidden) return
      try {
        const d: WpReply = await (await fetch(`/api/nfl/live/wp?leikir=${key}`)).json()
        if (alive) setWp(d.games)
      } catch { /* the next poll tries again */ }
    }
    void load()
    const t = setInterval(load, Math.max(30, every) * 1000)
    return () => { alive = false; clearInterval(t) }
  }, [key, every])
  return wp
}
