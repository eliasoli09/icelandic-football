'use client'

import { useState } from 'react'
import { Crown, Sparkles } from 'lucide-react'
import { TeamBadge } from './TeamBadge'
import type { DashboardTeam } from '@/lib/dashboard'

export interface AllTimeRowData {
  teamId: number
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points3: number
  seasons: number
  firstSeason: number
  lastSeason: number
}

export function SagaTable({
  rows,
  titles,
  teams,
  analyses,
}: {
  rows: AllTimeRowData[]
  titles: Record<number, number>
  teams: Record<number, DashboardTeam>
  analyses: Record<number, string>
}) {
  const [view, setView] = useState<'einfold' | 'itarleg'>('einfold')
  const [open, setOpen] = useState<number | null>(null)
  const nm = (id: number) => teams[id]?.name ?? `#${id}`
  const sorted = [...rows].sort((a, b) => b.points3 - a.points3)
  const detailed = view === 'itarleg'

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div
          role="tablist"
          aria-label="Umfang töflunnar"
          className="inline-flex rounded-full border p-0.5 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          {(['einfold', 'itarleg'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-full font-semibold min-h-[32px]"
              style={{
                background: view === v ? 'var(--accent)' : 'transparent',
                color: view === v ? 'var(--accent-ink)' : 'var(--text-2)',
              }}
            >
              {v === 'einfold' ? 'Einföld' : 'Ítarleg'}
            </button>
          ))}
        </div>
        <p className="text-[11px] muted hidden sm:flex items-center gap-1.5">
          <Sparkles size={11} aria-hidden style={{ color: 'var(--accent)' }} />
          Smelltu á lið fyrir AI-greiningu
        </p>
      </div>

      <div className="table-wrap">
        <table className="w-full text-sm">
          <thead>
            <tr className="muted text-xs text-left">
              <th className="py-2 font-semibold w-8">#</th>
              <th className="font-semibold">Lið</th>
              <th className="text-right font-semibold">Titlar</th>
              {detailed && (
                <>
                  <th className="text-right font-semibold">Tímabil</th>
                  <th className="text-right font-semibold">Leikir</th>
                  <th className="text-right font-semibold hidden sm:table-cell">U–J–T</th>
                  <th className="text-right font-semibold">Sigur%</th>
                </>
              )}
              <th className="text-right font-semibold">Mörk</th>
              <th className="text-right font-semibold">Stig</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const t = titles[r.teamId] ?? 0
              const analysis = analyses[r.teamId]
              const isOpen = open === r.teamId
              const cols = detailed ? 9 : 5
              return (
                <FragmentRow
                  key={r.teamId}
                  r={r} i={i} t={t} detailed={detailed} cols={cols}
                  isOpen={isOpen} analysis={analysis}
                  onToggle={() => setOpen(isOpen ? null : r.teamId)}
                  nm={nm} teams={teams}
                />
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] muted mt-3">
        Stig reiknuð samræmt með 3 fyrir sigur öll tímabil (eldri mót notuðu 2). Opinberar töflur KSÍ
        1912–1984 (1923, 1949 og 1981 af Wikipediu) og öll leikjaúrslit frá 1985; 1913 og 1914 féll mótið
        niður og Fram fékk titilinn án keppni.
      </p>
    </div>
  )
}

function FragmentRow({
  r, i, t, detailed, cols, isOpen, analysis, onToggle, nm, teams,
}: {
  r: AllTimeRowData
  i: number
  t: number
  detailed: boolean
  cols: number
  isOpen: boolean
  analysis?: string
  onToggle: () => void
  nm: (id: number) => string
  teams: Record<number, DashboardTeam>
}) {
  return (
    <>
      <tr
        className="trow cursor-pointer"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <td className={`py-2.5 num w-8 ${i < 3 ? 'rank-top stat' : 'muted'}`}>{i + 1}</td>
        <td className="font-semibold whitespace-nowrap">
          <TeamBadge info={teams[r.teamId]} /> {nm(r.teamId)}
          <span className="hidden sm:inline text-[10px] muted font-normal ml-2">{r.firstSeason}–{r.lastSeason}</span>
        </td>
        <td className="text-right">
          {t > 0 ? (
            <span className="pill" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}>
              <Crown size={10} aria-hidden /> {t}
            </span>
          ) : (
            <span className="muted text-xs">—</span>
          )}
        </td>
        {detailed && (
          <>
            <td className="text-right num">{r.seasons}</td>
            <td className="text-right num">{r.played.toLocaleString('is-IS')}</td>
            <td className="text-right num muted hidden sm:table-cell whitespace-nowrap">
              {r.won}–{r.drawn}–{r.lost}
            </td>
            <td className="text-right num">{Math.round((r.won / Math.max(1, r.played)) * 100)}%</td>
          </>
        )}
        <td className="text-right num muted whitespace-nowrap">{r.gf.toLocaleString('is-IS')}:{r.ga.toLocaleString('is-IS')}</td>
        <td className="text-right stat text-base">{r.points3.toLocaleString('is-IS')}</td>
      </tr>
      {isOpen && analysis && (
        <tr>
          <td colSpan={cols} className="pb-3">
            <div className="strip rounded-lg p-4 text-sm leading-relaxed" style={{ background: 'var(--surface-2)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] muted mb-1.5 inline-flex items-center gap-1.5">
                <Sparkles size={10} aria-hidden style={{ color: 'var(--accent)' }} />
                AI-greining
              </p>
              {analysis}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
