'use client'

import { useState } from 'react'
import { ArrowRight, ExternalLink, Newspaper } from 'lucide-react'
import { TeamBadge } from './TeamBadge'
import type { DashboardTeam } from '@/lib/dashboard'
import {
  filterTransfers, groupByDay, SCOPE_LABELS, STATUS_LABELS,
  type TransferItem, type TransferScope, type TransferStatus,
} from '@/lib/transfers'

const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString('is-IS', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-bold border min-h-[32px] transition-colors"
      style={{
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? 'var(--accent-ink)' : 'var(--text-2)',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
      }}
    >
      {children}
    </button>
  )
}

export function SludurView({ items, teams }: { items: TransferItem[]; teams: Record<number, DashboardTeam> }) {
  const [status, setStatus] = useState<TransferStatus | 'allt'>('allt')
  const [scope, setScope] = useState<TransferScope | 'allt'>('allt')

  const rows = filterTransfers(items, status, scope)
  const days = groupByDay(rows)
  const count = (s: TransferStatus | 'allt') => filterTransfers(items, s, scope).length

  return (
    <div className="fade-up">
      <div className="mb-5">
        <h1 className="display text-2xl font-black" style={{ color: 'var(--accent)' }}>
          Slúður & félagaskipti
        </h1>
        <p className="text-sm muted mt-1 inline-flex items-center gap-1.5">
          <Newspaper size={13} aria-hidden />
          Staðfest félagaskipti og heitustu orðrómarnir — heimildir af fotbolti.net
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Chip active={status === 'allt'} onClick={() => setStatus('allt')}>Allt ({count('allt')})</Chip>
        <Chip active={status === 'stadfest'} onClick={() => setStatus('stadfest')}>Staðfest ({count('stadfest')})</Chip>
        <Chip active={status === 'ordromur'} onClick={() => setStatus('ordromur')}>Orðrómur ({count('ordromur')})</Chip>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Chip active={scope === 'allt'} onClick={() => setScope('allt')}>Allt</Chip>
        {(Object.keys(SCOPE_LABELS) as TransferScope[]).map((s) => (
          <Chip key={s} active={scope === s} onClick={() => setScope(s)}>{SCOPE_LABELS[s]}</Chip>
        ))}
      </div>

      <div className="grid gap-6">
        {days.map(([day, ts]) => (
          <section key={day}>
            <h2 className="text-[11px] font-bold muted uppercase tracking-[0.18em] mb-2.5">{fmtDay(day)}</h2>
            <div className="grid gap-1.5">
              {ts.map((t) => (
                <article key={t.id} className="card card-hover px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={t.status === 'stadfest' ? 'pill pill-win' : 'pill pill-flat'}>
                      {STATUS_LABELS[t.status]}
                    </span>
                    <span className="text-[10px] muted uppercase tracking-wide">{SCOPE_LABELS[t.scope]}</span>
                  </div>
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sm hover:underline inline-flex items-start gap-1.5">
                    {t.headline}
                    <ExternalLink size={12} aria-hidden className="mt-1 shrink-0" style={{ color: 'var(--text-2)' }} />
                  </a>
                  {(t.player || t.from_team || t.to_team) && (
                    <p className="text-xs mt-1.5 inline-flex flex-wrap items-center gap-1.5">
                      {t.player && <strong>{t.player}</strong>}
                      {(t.from_team || t.to_team) && (
                        <span className="inline-flex items-center gap-1.5 muted">
                          {t.from_team && (
                            <span className="inline-flex items-center gap-1">
                              {t.from_team_id != null && <TeamBadge info={teams[t.from_team_id]} size={14} />}
                              {t.from_team}
                            </span>
                          )}
                          <ArrowRight size={12} aria-hidden />
                          {t.to_team ? (
                            <span className="inline-flex items-center gap-1">
                              {t.to_team_id != null && <TeamBadge info={teams[t.to_team_id]} size={14} />}
                              {t.to_team}
                            </span>
                          ) : (
                            <span>óráðið</span>
                          )}
                        </span>
                      )}
                    </p>
                  )}
                  {t.summary && <p className="text-xs muted mt-1.5 leading-relaxed">{t.summary}</p>}
                </article>
              ))}
            </div>
          </section>
        ))}
        {!rows.length && <p className="muted text-sm">Ekkert slúður í grunninum ennþá.</p>}
      </div>

      <p className="text-[11px] muted mt-8">
        Uppfært vikulega úr fréttum fotbolti.net. Orðrómar eru aldrei notaðir í spálíkanið — aðeins staðfestar fréttir hafa áhrif á fréttastuðla.
      </p>
    </div>
  )
}
