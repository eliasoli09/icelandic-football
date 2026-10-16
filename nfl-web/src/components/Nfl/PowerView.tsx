'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { NflLogo } from './NflLogo'
import { barColor, eloMove } from '@/lib/nfl/format'
import type { NflTeam } from '@/lib/nfl/types'

export interface PowerRow {
  abbr: string
  elo: number
  lastChange: number | null
  record: string
  /** Points better than an average club on a neutral field. */
  edge: number
  series: { week: number; elo: number }[]
}

const DEFAULT_LINES = 8
const edgeLabel = (x: number) => {
  const r = Math.round(x * 2) / 2
  return r > 0 ? `+${String(r).replace('.', ',')}` : r < 0 ? `−${String(-r).replace('.', ',')}` : '0'
}

export function PowerView({ season, rows, teams, sentence }: { season: number; rows: PowerRow[]; teams: NflTeam[]; sentence: string }) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const [shown, setShown] = useState<Set<string>>(() => new Set(rows.slice(0, DEFAULT_LINES).map((r) => r.abbr)))
  const toggle = (abbr: string) => setShown((s) => { const n = new Set(s); if (n.has(abbr)) n.delete(abbr); else n.add(abbr); return n })

  // one row per week with a column per club, carrying a bye week's rating forward
  const data = useMemo(() => {
    const weeks = [...new Set(rows.flatMap((r) => r.series.map((p) => p.week)))].sort((a, b) => a - b)
    return weeks.map((week) => {
      const point: Record<string, number> = { week }
      for (const r of rows) {
        const upTo = r.series.filter((p) => p.week <= week)
        if (upTo.length) point[r.abbr] = Math.round(upTo[upTo.length - 1].elo)
      }
      return point
    })
  }, [rows])

  // round the axis to 25 Elo (one point on the scoreboard) around the clubs on show
  const domain = useMemo(() => {
    const vals = data.flatMap((p) => [...shown].map((a) => p[a]).filter((v): v is number => v !== undefined))
    if (!vals.length) return [1400, 1600]
    return [Math.floor((Math.min(...vals) - 10) / 25) * 25, Math.ceil((Math.max(...vals) + 10) / 25) * 25]
  }, [data, shown])

  return (
    <section className="grid gap-6">
      <div className="card p-4">
        <h2 className="display text-lg font-extrabold mb-1">Elo yfir tímabilið {season}</h2>
        <p className="text-xs muted mb-3">Vika 0 er upphaf tímabilsins. Smelltu á lið til að bæta því við eða taka það út.</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: 'var(--text-2)', fontSize: 11 }} stroke="var(--border)" />
              <YAxis domain={domain} tick={{ fill: 'var(--text-2)', fontSize: 11 }} stroke="var(--border)" allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                labelFormatter={(w) => (w === 0 ? 'Upphaf tímabils' : `Vika ${w}`)} />
              {rows.filter((r) => shown.has(r.abbr)).map((r) => (
                <Line key={r.abbr} dataKey={r.abbr} stroke={barColor(byAbbr.get(r.abbr))} strokeWidth={2} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {rows.map((r) => {
            const on = shown.has(r.abbr)
            return (
              <button key={r.abbr} onClick={() => toggle(r.abbr)} aria-pressed={on}
                className="rounded-full border px-2.5 min-h-[32px] text-xs font-semibold inline-flex items-center gap-1.5"
                style={{ borderColor: on ? barColor(byAbbr.get(r.abbr)) : 'var(--border)', color: on ? 'var(--text)' : 'var(--text-2)' }}>
                <NflLogo team={byAbbr.get(r.abbr)} size={14} />
                {r.abbr}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card p-4">
        <div className="table-wrap">
          <table className="text-sm w-full [&_td]:px-2 [&_th]:px-2 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead>
              <tr className="muted text-xs text-left">
                <th className="w-8">#</th>
                <th>Lið</th>
                <th className="text-right">Elo</th>
                <th className="text-right">Síðasti leikur</th>
                <th className="text-right">Met</th>
                <th className="text-right hidden sm:table-cell" title="Stig umfram meðallið á hlutlausum velli">Gegn meðalliði</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const team = byAbbr.get(r.abbr)
                return (
                  <tr key={r.abbr} className="trow">
                    <td className="num muted py-1.5">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <NflLogo team={team} size={20} />
                        <span className="font-semibold sm:hidden">{r.abbr}</span>
                        <span className="font-semibold hidden sm:inline">{team?.name ?? r.abbr}</span>
                      </div>
                    </td>
                    <td className="text-right num font-semibold">{Math.round(r.elo)}</td>
                    <td className="text-right num">
                      {r.lastChange === null ? <span className="muted">-</span> : (() => {
                        const m = eloMove(r.lastChange)
                        return <span style={{ color: m.dir === 'up' ? 'var(--win)' : m.dir === 'down' ? 'var(--loss)' : 'var(--text-2)' }}>{m.text}</span>
                      })()}
                    </td>
                    <td className="text-right num">{r.record}</td>
                    <td className="text-right num hidden sm:table-cell">{edgeLabel(r.edge)} stig</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] muted mt-3 leading-relaxed max-w-2xl">
          "Gegn meðalliði" er hve mörgum stigum liðið ætti að vinna meðallið á hlutlausum velli. {sentence}
        </p>
      </div>
    </section>
  )
}
