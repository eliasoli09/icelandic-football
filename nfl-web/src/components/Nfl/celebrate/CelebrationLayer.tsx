'use client'

import { useEffect, useRef, useState } from 'react'
import type { LiveReply } from '@/app/api/nfl/live/route'
import { freshMoments, scoringMoments, type ScoreMoment } from '@/lib/nfl/celebrations'
import { playIs, quarterLabel } from '@/lib/nfl/live'
import type { NflTeam } from '@/lib/nfl/types'
import { Celebration } from './Celebration'
import { T } from './themes'

const scoreLine = (m: ScoreMoment) => `${m.away} ${m.awayScore ?? '-'}-${m.homeScore ?? '-'} ${m.home} · ${quarterLabel(m.quarter)}${m.minute ? ` ${m.minute}` : ''}`

/** The banners for new touchdowns and field goals, one at a time, over the page. */
export function CelebrationLayer({ live, teams }: { live: LiveReply | null; teams: Map<string, NflTeam> }) {
  const seen = useRef<Set<string> | null>(null)
  const [queue, setQueue] = useState<ScoreMoment[]>([])

  useEffect(() => {
    // a failed poll says nothing about what has been scored; skip it, or the next good one would replay the day
    if (!live || live.error) return
    const { fresh, seen: next } = freshMoments(seen.current, scoringMoments(live.games, [...teams.values()]))
    seen.current = next
    if (fresh.length) setQueue((q) => [...q, ...fresh].slice(-6))
  }, [live, teams])

  const now = queue[0]
  useEffect(() => {
    if (!now) return
    const t = setTimeout(() => setQueue((q) => q.slice(1)), T.end + 250)
    return () => clearTimeout(t)
  }, [now])

  if (!now) return null
  return (
    <div className="fixed left-0 right-0 z-[70] flex justify-center pointer-events-none" style={{ top: 'clamp(64px, 12vh, 132px)', overflowX: 'clip' }} aria-live="polite">
      <Celebration key={now.key} kind={now.kind} team={now.team} logo={teams.get(now.team)?.logo ?? `/nfl/${now.team}.png`} score={scoreLine(now)} play={playIs(now.comment)} />
    </div>
  )
}
