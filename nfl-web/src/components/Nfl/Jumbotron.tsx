'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { LiveReply, LiveRow } from '@/app/api/nfl/live/route'
import type { Broadcast } from '@/lib/nfl/queries'
import { oddsLabel } from '@/lib/nfl/odds'
import { clock, isSmallHours } from '@/lib/nfl/time'
import type { NflGame, NflTeam } from '@/lib/nfl/types'
import { NflLogo } from './NflLogo'

/** "Sýn Sport 2" → "SÝN 2", "RedZone, Sýn Sport 3" → "REDZONE". */
const channel = (b: Broadcast | undefined) => !b ? null : /redzone/i.test(b.channel) ? 'REDZONE' : b.channel.replace(/sport\s*/i, '').toUpperCase()
const SHORT: Record<string, string> = { Q1: '1. lh', Q2: '2. lh', Q3: '3. lh', Q4: '4. lh', OT: 'Framl.', HT: 'Hálfleikur', BT: 'Leikhlutaskil', FT: 'Lokið', AOT: 'Lokið (fr.)' }
const sameDay = (iso: string, now: Date) => iso.slice(0, 10) === now.toISOString().slice(0, 10)

/** Scores for the games under way, every so often, while the page is visible. */
function useScores(): Map<string, LiveRow> {
  const [rows, setRows] = useState<Map<string, LiveRow>>(new Map())
  const [every, setEvery] = useState(60)
  useEffect(() => {
    let alive = true
    const load = async () => {
      if (document.hidden) return
      try {
        const d: LiveReply = await (await fetch('/api/nfl/live', { cache: 'no-store' })).json()
        if (!alive) return
        setRows(new Map(d.games.map((g) => [g.game_id, g])))
        setEvery(Math.max(30, d.interval))
      } catch { /* the next poll tries again */ }
    }
    void load()
    const t = setInterval(load, every * 1000)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', load) }
  }, [every])
  return rows
}

/** The clock for the first cell, ticking once a second. */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return now
}

const countdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60
  return h ? `${h} klst ${String(m).padStart(2, '0')} mín` : `${m}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The round's games along the top of every page, like a stadium screen: LED
 * time and channel, the lines before kickoff, the score once it starts. On an
 * NFL Sunday the first cell turns into a countdown and a light runs across.
 */
export function Jumbotron({ games, teams, tv, week }: { games: NflGame[]; teams: NflTeam[]; tv: Record<string, Broadcast>; week: string }) {
  const live = useScores()
  const now = useNow()
  const team = new Map(teams.map((t) => [t.abbr, t]))
  if (!games.length) return null

  const today = now ? games.filter((g) => sameDay(g.kickoff, now)) : []
  const sunday = !!now && now.getUTCDay() === 0 && today.length > 0
  const onNow = [...live.values()].filter((g) => g.live).length
  const next = now ? today.find((g) => new Date(g.kickoff) > now) : undefined
  const head = sunday ? 'NFL-SUNNUDAGUR' : today.length ? 'LEIKDAGUR' : 'NFL'
  const sub = onNow ? `${onNow} ${onNow === 1 ? 'leikur' : 'leikir'} í gangi` : next && now ? `${today.indexOf(next) === 0 ? 'Fyrsti' : 'Næsti'} leikur eftir ${countdown(new Date(next.kickoff).getTime() - now.getTime())}` : today.length ? 'Leikjum dagsins lokið' : week

  return (
    <div className="jumbo" data-sunday={sunday || undefined} role="region" aria-label="Leikir umferðarinnar">
      <div className="jumbo-row">
        <Link href={onNow ? '/stjornbord' : '/leikir'} className="jumbo-cell jumbo-head" data-live={onNow > 0 || undefined}>
          <span className="jumbo-led text-[10px] tracking-[.18em] font-bold">{head}</span>
          <span className="text-[12px] font-semibold leading-tight">{onNow > 0 && <span className="live-dot mr-1.5 align-middle" aria-hidden />}{sub}</span>
        </Link>
        {games.map((g) => {
          const l = live.get(g.game_id)
          const final = l?.final ?? g.home_score !== null
          const started = !!l && (l.live || l.final)
          const hs = l?.homeScore ?? g.home_score, as = l?.awayScore ?? g.away_score
          const status = l && started ? (SHORT[l.status] ?? l.statusLabel) + (l.live && l.clock && l.status !== 'HT' && l.status !== 'BT' ? ` ${l.clock}` : '') : final ? 'Lokið' : `${isSmallHours(g.kickoff) ? 'nótt ' : ''}${clock(g.kickoff)}`
          const rows = [
            { abbr: g.away, score: as, line: oddsLabel(g.away_ml) ?? '', won: final && as !== null && hs !== null && as > hs },
            { abbr: g.home, score: hs, line: oddsLabel(g.home_ml) ?? '', won: final && as !== null && hs !== null && hs > as },
          ]
          return (
            <Link key={g.game_id} href={`/leikur/${g.game_id}`} className="jumbo-cell" data-live={l?.live || undefined} aria-label={`${g.away} @ ${g.home}`}>
              <span className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                <span className="jumbo-led">{status}</span>
                <span className="jumbo-ch">{channel(tv[g.game_id])}</span>
              </span>
              {rows.map((r) => (
                <span key={r.abbr} className="flex items-center gap-2" style={{ opacity: final && !r.won ? 0.6 : 1 }}>
                  <NflLogo team={team.get(r.abbr)} size={18} />
                  <span className="font-bold text-[14px] tracking-wide">{r.abbr}</span>
                  <span className={`ml-auto num ${started || final ? 'jumbo-score' : 'text-[12px] muted'}`}>{started || final ? r.score : r.line}</span>
                </span>
              ))}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
