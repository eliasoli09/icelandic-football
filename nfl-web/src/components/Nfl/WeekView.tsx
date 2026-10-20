'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { NflLogo } from './NflLogo'
import { TvBadge } from './TvBadge'
import type { Broadcast } from '@/lib/nfl/queries'
import { ProbSplit } from './ProbSplit'
import type { Forecast } from '@/lib/nfl/forecast'
import { clock, dayKey, dayLabel, isSmallHours } from '@/lib/nfl/time'
import { modelSpreadLabel, probLabel, totalLabel } from '@/lib/nfl/format'
import { oddsLabel } from '@/lib/nfl/odds'
import { crowdShare, type Crowd } from '@/lib/nfl/crowd'
import { weekLabel, weekTypes } from '@/lib/nfl/week'
import { isPlayed, type NflGame, type NflTeam } from '@/lib/nfl/types'

export function WeekView({ season, games, teams, initialWeek, forecasts, broadcasts = {}, crowd = {} }: { season: number; games: NflGame[]; teams: NflTeam[]; initialWeek: number; forecasts: Record<string, Forecast>; broadcasts?: Record<string, Broadcast>; crowd?: Record<string, Crowd> }) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const weeks = useMemo(() => weekTypes(games), [games])
  const [week, setWeek] = useState(initialWeek)

  // ?vika=6 makes a week shareable; read after mount so the page itself stays cacheable
  useEffect(() => {
    const v = Number(new URLSearchParams(window.location.search).get('vika'))
    if (weeks.some(([w]) => w === v)) setWeek(v)
  }, [weeks])

  const go = (w: number) => {
    setWeek(w)
    const url = new URL(window.location.href)
    url.searchParams.set('vika', String(w))
    window.history.replaceState(null, '', url)
  }

  const idx = weeks.findIndex(([w]) => w === week)
  const type = weeks[idx]?.[1] ?? 'REG'
  const days = useMemo(() => {
    const m = new Map<string, NflGame[]>()
    for (const g of games.filter((x) => x.week === week)) m.set(dayKey(g.kickoff), [...(m.get(dayKey(g.kickoff)) ?? []), g])
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [games, week])

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-5">
        <button className="w-11 h-11 rounded-full border inline-flex items-center justify-center disabled:opacity-30" style={{ borderColor: 'var(--border)' }}
          disabled={idx <= 0} onClick={() => go(weeks[idx - 1][0])} aria-label="Fyrri vika">
          <ChevronLeft size={18} aria-hidden />
        </button>
        <div className="text-center">
          <p className="display text-2xl font-extrabold">{weekLabel(type, week)}</p>
          <p className="text-xs muted">Tímabilið {season}</p>
        </div>
        <button className="w-11 h-11 rounded-full border inline-flex items-center justify-center disabled:opacity-30" style={{ borderColor: 'var(--border)' }}
          disabled={idx < 0 || idx >= weeks.length - 1} onClick={() => go(weeks[idx + 1][0])} aria-label="Næsta vika">
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      {days.length === 0 && <p className="muted">Engir leikir fundust.</p>}
      <div className="grid gap-6">
        {days.map(([key, list]) => (
          <div key={key}>
            <h2 className="text-sm font-semibold muted mb-2">{dayLabel(list[0].kickoff)}</h2>
            <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
              {list.map((g) => <GameRow key={g.game_id} g={g} f={forecasts[g.game_id]} home={byAbbr.get(g.home)} away={byAbbr.get(g.away)} tv={broadcasts[g.game_id]} crowd={crowd[g.game_id]} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Side({ team, abbr, score, won, p }: { team: NflTeam | undefined; abbr: string; score: number | null; won: boolean; p: number | null }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <NflLogo team={team} size={26} />
      <span className={`truncate ${won ? 'font-bold' : ''}`}>
        <span className="hidden sm:inline">{team?.name ?? abbr}</span>
        <span className="sm:hidden">{abbr}</span>
      </span>
      {score !== null ? (
        <span className={`ml-auto stat text-lg ${won ? '' : 'muted'}`}>{score}</span>
      ) : p !== null ? (
        <span className="ml-auto num text-sm font-semibold">{probLabel(p)}</span>
      ) : null}
    </div>
  )
}

function GameRow({ g, f, home, away, tv, crowd }: { g: NflGame; f: Forecast | undefined; home: NflTeam | undefined; away: NflTeam | undefined; tv?: Broadcast; crowd?: Crowd }) {
  const played = isPlayed(g)
  const prices = oddsLabel(g.away_ml) && oddsLabel(g.home_ml) ? `${g.away} ${oddsLabel(g.away_ml)} · ${g.home} ${oddsLabel(g.home_ml)}` : null
  const c = crowdShare(crowd)
  const fav = f && (f.pHome >= 0.5 ? { abbr: g.home, p: f.pHome } : { abbr: g.away, p: 1 - f.pHome })
  const qbs = f?.newQb ? [f.newQb.away, f.newQb.home].filter((x) => x !== null) : []
  // the lines under the time; on a phone they go in one row under the game instead
  const details = [
    !played && f?.spread != null ? `Líkanið ${modelSpreadLabel(g.home, g.away, f.spread)}` : null,
    !played && prices ? `Stuðlar ${prices}` : null,
    !played && g.total_line !== null ? `Heildarstig ${totalLabel(g.total_line)}` : null,
    c ? `Íslendingar ${c.pHome >= 0.5 ? `${g.home} ${probLabel(c.pHome)}` : `${g.away} ${probLabel(1 - c.pHome)}`}` : null,
    played && fav ? `líkanið gaf ${fav.abbr} ${probLabel(fav.p)}` : null,
    g.neutral && g.stadium ? g.stadium : null,
  ].filter((x): x is string => !!x)
  return (
    <Link href={`/leikur/${g.game_id}`} className="trow grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
      <div className="grid gap-1.5 min-w-0">
        <Side team={away} abbr={g.away} score={g.away_score} won={played && g.away_score! > g.home_score!} p={!played && f ? 1 - f.pHome : null} />
        <Side team={home} abbr={g.home} score={g.home_score} won={played && g.home_score! > g.away_score!} p={!played && f ? f.pHome : null} />
        {!played && f && <ProbSplit pHome={f.pHome} home={home} away={away} />}
      </div>
      <div className="text-right text-xs muted grid content-center gap-0.5 num min-w-[4.5rem]">
        {played ? (
          <span className="font-semibold" style={{ color: 'var(--text)' }}>Lokið{g.overtime ? ' · framl.' : ''}</span>
        ) : g.time_tbd ? (
          <span>Tími óákveðinn</span>
        ) : (
          <span className="font-semibold text-sm sm:text-xs" style={{ color: 'var(--text)' }}>
            {isSmallHours(g.kickoff) && <span className="muted font-normal block sm:inline text-[10px] sm:text-xs">aðfaranótt </span>}
            {clock(g.kickoff)}
          </span>
        )}
        {details.map((d) => <span key={d} className="hidden sm:block">{d}</span>)}
        {!played && <TvBadge b={tv} className="justify-end" />}
      </div>
      {details.length > 0 && <p className="sm:hidden col-span-2 text-[11px] muted num">{details.join(' · ')}</p>}
      {!played && qbs.map((q) => (
        <p key={q.qb} className="col-span-2 text-[11px] inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
          <AlertTriangle size={12} aria-hidden />
          Nýr leikstjórnandi: {q.qb} (í stað {q.usual})
        </p>
      ))}
    </Link>
  )
}
