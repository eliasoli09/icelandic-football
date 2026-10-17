'use client'

import { useEffect, useState } from 'react'
import type { LiveReply } from '@/app/api/nfl/live/route'
import type { StatsReply } from '@/app/api/nfl/live/stats/route'

/** Poll one of our live routes as often as the server refreshes it, while the tab is visible; off when `on` is false. */
function usePoll<T extends { interval: number }>(url: string, on: boolean, floor: number): T | null {
  const [data, setData] = useState<T | null>(null)
  const every = Math.max(floor, data?.interval ?? 60) * 1000
  useEffect(() => {
    if (!on) return
    let alive = true
    const load = async () => {
      if (document.hidden) return
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (res.ok && alive) setData(await res.json())
      } catch { /* the next poll tries again */ }
    }
    void load()
    const t = setInterval(load, every)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', load) }
  }, [url, on, every])
  return data
}

/** Scores always; player and team stats only when a widget on the board reads them. */
export function useFeeds(needStats: boolean) {
  const live = usePoll<LiveReply>('/api/nfl/live', true, 15)
  const stats = usePoll<StatsReply>('/api/nfl/live/stats', needStats && !!live?.games.length, 60)
  return { live, stats }
}
