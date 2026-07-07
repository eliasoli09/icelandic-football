'use client'

import Link from 'next/link'
import { useLeague } from './LeagueContext'
import { LeagueSwitcher } from './LeagueSwitcher'
import { TeamBadge } from './TeamBadge'
import type { MatchWithPrediction } from '@/lib/queries'
import type { DashboardTeam } from '@/lib/dashboard'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('is-IS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : 'Óráðið'

export function LeikirView({
  matches,
  teams,
}: {
  matches: MatchWithPrediction[]
  teams: Record<number, DashboardTeam>
}) {
  const { league } = useLeague()
  const nm = (id: number) => teams[id]?.name ?? `#${id}`
  const rows = matches.filter((m) => m.league === league)
  const title = league === 'besta' ? 'Besta deildin' : 'Lengjudeildin'
  const byMonth = new Map<string, typeof rows>()
  for (const m of rows) {
    const key = m.date ? m.date.slice(0, 7) : 'óráðið'
    byMonth.set(key, [...(byMonth.get(key) ?? []), m])
  }
  return (
    <div key={league} className="fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="display text-2xl font-black" style={{ color: 'var(--accent)' }}>
          Leikir — {title} 2026
        </h1>
        <LeagueSwitcher size="sm" />
      </div>
      <div className="grid gap-6">
        {[...byMonth].map(([month, ms]) => (
          <section key={month}>
            <h2 className="text-[11px] font-bold muted uppercase tracking-[0.18em] mb-2.5">
              {month === 'óráðið'
                ? 'Dagsetning óráðin'
                : new Date(month + '-01').toLocaleString('is-IS', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </h2>
            <div className="tilt-wrap grid gap-2">
              {ms.map((m) => (
                <Link key={m.id} href={`/leikir/${m.id}`} className="card-3d card-3d-hover px-4 py-2.5 flex items-center gap-3 text-sm min-h-[44px]">
                  <span className="muted text-xs w-24 shrink-0 num">{fmtDate(m.date)}</span>
                  <span className="flex-1 text-right inline-flex items-center justify-end gap-2 min-w-0">
                    <span className="truncate">{nm(m.home_team)}</span>
                    <TeamBadge info={teams[m.home_team]} size={16} />
                  </span>
                  <span className={`plate stat text-sm shrink-0 ${m.status === 'played' ? '' : 'opacity-55'}`}>
                    {m.status === 'played' ? `${m.home_goals} – ${m.away_goals}` : '–'}
                  </span>
                  <span className="flex-1 inline-flex items-center gap-2 min-w-0">
                    <TeamBadge info={teams[m.away_team]} size={16} />
                    <span className="truncate">{nm(m.away_team)}</span>
                  </span>
                  {m.phase !== 'main' && (
                    <span className="text-[10px] muted uppercase hidden sm:block">
                      {m.phase === 'efri' ? 'Efri' : m.phase === 'nedri' ? 'Neðri' : 'Umspil'}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
        {!rows.length && <p className="muted text-sm">Engir leikir í grunninum.</p>}
      </div>
    </div>
  )
}
