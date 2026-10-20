'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Radio } from 'lucide-react'
import type { LiveReply, LiveRow } from '@/app/api/nfl/live/route'
import { probLabel } from '@/lib/nfl/format'
import { EVENT_LABEL, playIs, quarterLabel } from '@/lib/nfl/live'
import type { NflTeam } from '@/lib/nfl/types'
import { NflLogo } from './NflLogo'
import { useWp } from './useWp'
import { WinChart } from './WinChart'
import { progressOf, type WpPoint } from '@/lib/nfl/winChart'
import { ProbSplit } from './ProbSplit'

/** Poll our live route as often as the server refreshes, while the tab is visible; null until the first answer. */
function useLive(): LiveReply | null {
  const [data, setData] = useState<LiveReply | null>(null)
  const every = Math.max(15, data?.interval ?? 60) * 1000
  useEffect(() => {
    let alive = true
    const load = async () => {
      if (document.hidden) return
      try {
        const res = await fetch('/api/nfl/live', { cache: 'no-store' })
        if (res.ok && alive) setData(await res.json())
      } catch { /* the next poll tries again */ }
    }
    void load()
    const t = setInterval(load, every)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', load) }
  }, [every])
  return data
}

const state = (g: LiveRow) => `${g.statusLabel}${g.clock && g.live && g.status !== 'HT' ? ` · ${g.clock}` : ''}`

function LiveDot() {
  return <span className="live-dot" aria-hidden />
}

/** "Í beinni": every game under way, only while there are some. */
export function LiveStrip({ teams }: { teams: NflTeam[] }) {
  const data = useLive()
  const byAbbr = new Map(teams.map((t) => [t.abbr, t]))
  const games = data?.games ?? []
  if (!games.length) return null
  return (
    <section className="grid gap-2" aria-label="Í beinni">
      <h2 className="text-[11px] font-bold tracking-widest inline-flex items-center gap-2" style={{ color: 'var(--accent)' }}><LiveDot /> Í BEINNI</h2>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {games.map((g) => (
          <Link key={g.game_id} href={`/leikur/${g.game_id}`} className="card card-hover px-3 py-2 grid gap-1 shrink-0 min-w-[11rem]">
            {([['away', g.away, g.awayScore], ['home', g.home, g.homeScore]] as const).map(([side, abbr, score]) => (
              <span key={side} className="flex items-center gap-2 text-sm">
                <NflLogo team={byAbbr.get(abbr)} size={20} />
                <span className="font-semibold">{abbr}</span>
                <span className="ml-auto num font-bold">{score ?? '-'}</span>
              </span>
            ))}
            <span className="text-[11px] muted">{state(g)}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** The game page's live box: score, quarter, clock, live win probability and scoring plays. */
/** The stored chances with the latest one from the feed on the end, so the chart ends where the score is. */
function withNow(points: WpPoint[], g: LiveRow): WpPoint[] {
  if (!g.live || g.pHome === null) return points
  const now = { progress: progressOf(g.quarter, g.clock, g.status), p_home: g.pHome, home_score: g.homeScore ?? 0, away_score: g.awayScore ?? 0, status: g.status }
  return now.progress >= (points.at(-1)?.progress ?? 0) ? [...points, now] : points
}

export function LiveBox({ gameId, home, away }: { gameId: string; home: NflTeam | undefined; away: NflTeam | undefined }) {
  const data = useLive()
  const g = data?.games.find((x) => x.game_id === gameId)
  const wp = useWp(g ? [gameId] : [], data?.interval)
  if (!g) return null
  return (
    <section className="card p-5 grid gap-4" aria-label="Í beinni">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-widest inline-flex items-center gap-2" style={{ color: 'var(--accent)' }}>
          {g.final ? 'LOKASTAÐA' : <><LiveDot /> Í BEINNI</>}
        </span>
        <span className="text-xs muted">{state(g)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <span className="grid justify-items-center gap-1"><NflLogo team={away} size={44} /><span className="font-semibold text-sm">{away?.name ?? g.away}</span></span>
        <span className="display text-4xl font-extrabold num">{g.awayScore ?? 0} <span className="muted">-</span> {g.homeScore ?? 0}</span>
        <span className="grid justify-items-center gap-1"><NflLogo team={home} size={44} /><span className="font-semibold text-sm">{home?.name ?? g.home}</span></span>
      </div>
      {g.pHome !== null && (
        <div className="grid gap-1.5">
          <ProbSplit pHome={g.pHome} home={home} away={away} height={8} />
          <div className="flex justify-between text-xs num">
            <span>{g.away} {probLabel(1 - g.pHome)}</span>
            <span className="muted">Líkur í beinni{g.pHomePre !== null ? ` (fyrir leik: ${g.home} ${probLabel(g.pHomePre)})` : ''}</span>
            <span>{g.home} {probLabel(g.pHome)}</span>
          </div>
        </div>
      )}
      <WinChart points={withNow(wp[gameId] ?? [], g)} home={home} away={away} homeAbbr={g.home} awayAbbr={g.away} pre={g.pHomePre} />
      {g.events && g.events.length > 0 && (
        <ol className="grid gap-1.5 text-sm border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          {[...g.events].reverse().map((e, i) => (
            <li key={i} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-2">
              <span className="muted text-xs num">{quarterLabel(e.quarter)}{e.minute ? ` ${e.minute}` : ''}</span>
              <span className="min-w-0"><span className="font-semibold">{EVENT_LABEL[e.type] ?? e.type}:</span> {playIs(e.comment)}</span>
              <span className="num text-xs">{e.awayScore ?? ''}-{e.homeScore ?? ''}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-[11px] muted">Uppfærist sjálfkrafa á {data?.interval ?? 60} sek. fresti. Gögn: API-Sports. Líkurnar eru okkar eigin, út frá stöðunni, tímanum sem eftir er og spá Elo-líkansins fyrir leik.</p>
    </section>
  )
}
