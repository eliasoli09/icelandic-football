'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NflLogo } from './NflLogo'
import { clock, dayKey, dayLabel, isSmallHours } from '@/lib/nfl/time'
import { spreadLabel, totalLabel } from '@/lib/nfl/format'
import { weekLabel, weekTypes } from '@/lib/nfl/week'
import { isPlayed, type NflGame, type NflTeam } from '@/lib/nfl/types'

export function WeekView({ season, games, teams, initialWeek }: { season: number; games: NflGame[]; teams: NflTeam[]; initialWeek: number }) {
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
              {list.map((g) => <GameRow key={g.game_id} g={g} home={byAbbr.get(g.home)} away={byAbbr.get(g.away)} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Side({ team, abbr, score, won }: { team: NflTeam | undefined; abbr: string; score: number | null; won: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <NflLogo team={team} size={26} />
      <span className={`truncate ${won ? 'font-bold' : ''}`}>
        <span className="hidden sm:inline">{team?.name ?? abbr}</span>
        <span className="sm:hidden">{abbr}</span>
      </span>
      {score !== null && <span className={`ml-auto stat text-lg ${won ? '' : 'muted'}`}>{score}</span>}
    </div>
  )
}

function GameRow({ g, home, away }: { g: NflGame; home: NflTeam | undefined; away: NflTeam | undefined }) {
  const played = isPlayed(g)
  const spread = spreadLabel(g)
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
      <div className="grid gap-1.5 min-w-0">
        <Side team={away} abbr={g.away} score={g.away_score} won={played && g.away_score! > g.home_score!} />
        <Side team={home} abbr={g.home} score={g.home_score} won={played && g.home_score! > g.away_score!} />
      </div>
      <div className="text-right text-xs muted grid content-center gap-0.5 num">
        {played ? (
          <span className="font-semibold" style={{ color: 'var(--text)' }}>Lokið{g.overtime ? ' · framl.' : ''}</span>
        ) : g.time_tbd ? (
          <span>Tími óákveðinn</span>
        ) : (
          <span className="font-semibold" style={{ color: 'var(--text)' }}>
            {isSmallHours(g.kickoff) && <span className="muted font-normal">aðfaranótt </span>}
            {clock(g.kickoff)}
          </span>
        )}
        {!played && spread && <span>Forgjöf {spread}</span>}
        {!played && g.total_line !== null && <span>Heildarstig {totalLabel(g.total_line)}</span>}
        {g.neutral && g.stadium && <span>{g.stadium}</span>}
      </div>
    </div>
  )
}
