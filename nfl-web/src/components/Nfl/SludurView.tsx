'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ExternalLink, Flame, Repeat } from 'lucide-react'
import { NflLogo } from './NflLogo'
import { NEWS_NOTE } from './NewsList'
import type { RumourItem } from '@/lib/nfl/queries'
import { countdown, HEAT_LABEL, tradeTeams, TRADE_DEADLINE_LABEL, type Heat, type Trade } from '@/lib/nfl/rumours'
import { clock, dayLabel } from '@/lib/nfl/time'
import type { NflTeam } from '@/lib/nfl/types'

const HEAT_COLOR: Record<Heat, string> = { heitt: '#ff2e4d', volgt: '#f59e0b', kalt: '#5aa8ff' }

function Countdown() {
  // computed after mount: the server's clock and the reader's are not the same minute
  const [left, setLeft] = useState<ReturnType<typeof countdown> | 'pending'>('pending')
  useEffect(() => {
    const tick = () => setLeft(countdown(new Date()))
    tick()
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [])
  return (
    <section className="card p-5 grid gap-1">
      <p className="text-[11px] font-bold tracking-widest" style={{ color: 'var(--accent)' }}>SKIPTAFRESTURINN</p>
      {left === 'pending' ? <p className="display text-3xl font-extrabold">&nbsp;</p>
        : left ? (
          <p className="display text-3xl sm:text-4xl font-extrabold num">
            {left.days} <span className="text-lg muted font-semibold">dagar</span> {left.hours} <span className="text-lg muted font-semibold">klst</span> {left.minutes} <span className="text-lg muted font-semibold">mín</span>
          </p>
        ) : <p className="display text-3xl font-extrabold">Fresturinn er liðinn</p>}
      <p className="text-sm muted">{left === null ? 'Lið mega ekki skipta á leikmönnum fyrr en nýtt keppnisár hefst í mars.' : `Rennur út ${TRADE_DEADLINE_LABEL} að íslenskum tíma.`}</p>
    </section>
  )
}

export function SludurView({ rumours, trades, teams }: { rumours: RumourItem[]; trades: Trade[]; teams: NflTeam[] }) {
  const [team, setTeam] = useState('')
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const shownRumours = team ? rumours.filter((r) => r.teams.includes(team)) : rumours
  const shownTrades = team ? trades.filter((t) => tradeTeams(t).includes(team)) : trades
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'is'))

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="display text-3xl font-extrabold tracking-tight">Slúður</h2>
          <p className="muted text-sm">Orðrómar um skipti og staðfest skipti fyrir skiptafrestinn.</p>
        </div>
        <label className="text-sm inline-flex items-center gap-2">
          <span className="muted">Lið</span>
          <select value={team} onChange={(e) => setTeam(e.target.value)} className="rounded-lg border px-3 min-h-[40px] text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="">Öll lið</option>
            {sorted.map((t) => <option key={t.abbr} value={t.abbr}>{t.name}</option>)}
          </select>
        </label>
      </header>

      <Countdown />

      <section className="grid gap-3">
        <h3 className="display text-xl font-extrabold inline-flex items-center gap-2"><Repeat size={18} aria-hidden /> Staðfest skipti</h3>
        {shownTrades.length === 0 ? <p className="text-sm muted">Engin staðfest skipti {team ? 'hjá þessu liði ' : ''}enn.</p> : (
          <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
            {shownTrades.map((t) => (
              <li key={t.id} className="px-4 py-3 grid gap-1.5">
                {t.moves.map((m, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-semibold">{m.player}</span>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <NflLogo team={byAbbr.get(m.from)} size={20} /> {m.from}
                      <ArrowRight size={14} aria-hidden className="muted" />
                      <NflLogo team={byAbbr.get(m.to)} size={20} /> {m.to}
                    </span>
                  </div>
                ))}
                <p className="text-xs muted flex flex-wrap gap-x-2">
                  <span>{dayLabel(t.traded_on)}</span>
                  {t.compensation && <span>· Á móti: {t.compensation}</span>}
                  {t.source_url && <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2">Heimild <ExternalLink size={10} aria-hidden /></a>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h3 className="display text-xl font-extrabold inline-flex items-center gap-2"><Flame size={18} aria-hidden /> Orðrómarnir</h3>
        {shownRumours.length === 0 ? <p className="text-sm muted">Ekkert slúður {team ? 'um þetta lið ' : ''}síðasta mánuðinn.</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {shownRumours.map((n) => (
              <li key={n.url} className="card p-4 grid gap-1.5 content-start">
                {n.heat && (
                  <span className="text-[11px] font-bold tracking-wide inline-flex items-center gap-1" style={{ color: HEAT_COLOR[n.heat] }}>
                    <Flame size={12} aria-hidden /> {HEAT_LABEL[n.heat].toUpperCase()}
                  </span>
                )}
                <h4 className="font-semibold leading-snug">{n.title_is}</h4>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>{n.summary_is}</p>
                <p className="text-[11px] muted flex flex-wrap items-center gap-x-2">
                  <span>{dayLabel(n.published_at).split(' ').slice(1).join(' ')} kl. {clock(n.published_at)}</span>
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2">
                    Heimild: {n.source} <ExternalLink size={10} aria-hidden />
                  </a>
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] muted max-w-2xl">{NEWS_NOTE} Hitinn (heitt, volgt, kalt) er mat ritstjórnar á því hversu líkleg skiptin eru.</p>
      </section>
    </div>
  )
}
