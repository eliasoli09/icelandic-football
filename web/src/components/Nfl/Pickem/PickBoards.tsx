'use client'

import { useState } from 'react'
import { Cpu } from 'lucide-react'
import type { BoardRow } from '@/lib/nfl/pickem'
import type { League } from '@/lib/nfl/pickStore'

const pts = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace('.', ','))

export function PickBoards({ board, me, weekName, leagues, league, onLeague }: {
  board: { week: BoardRow[]; season: BoardRow[] }; me: string | null; weekName: string
  leagues: League[]; league: string; onLeague: (id: string) => void
}) {
  const [tab, setTab] = useState<'week' | 'season'>('week')
  const rows = board[tab]
  return (
    <section className="grid gap-3" aria-label="Stigatöflur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="display text-xl font-extrabold">Taflan</h3>
        <div className="inline-flex rounded-full border p-1 text-sm" role="group" aria-label="Tímabil töflu" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {([['week', weekName], ['season', 'Tímabilið']] as const).map(([key, label]) => (
            <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)} className="rounded-full px-4 min-h-[36px] font-semibold"
              style={{ background: tab === key ? 'var(--accent)' : 'transparent', color: tab === key ? 'var(--accent-ink)' : 'var(--text-2)' }}>{label}</button>
          ))}
        </div>
      </div>
      {leagues.length > 0 && (
        <label className="text-sm inline-flex items-center gap-2">
          <span className="muted">Sýna</span>
          <select value={league} onChange={(e) => onLeague(e.target.value)} className="min-h-[36px] rounded-lg border px-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <option value="all">Alla</option>
            {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      )}
      {rows.length === 0 ? (
        <p className="muted text-sm">Engin stig komin enn. Taflan fyllist þegar fyrstu leikirnir klárast.</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] muted">
                <th className="px-3 py-2 w-10">#</th><th className="py-2">Nafn</th>
                <th className="py-2 text-right">Rétt</th><th className="px-3 py-2 text-right">Leikir</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t" style={{
                  borderColor: 'var(--border)',
                  background: r.id === me ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : undefined,
                }}>
                  <td className="px-3 py-2 num muted">{r.place}</td>
                  <td className="py-2 font-semibold">
                    {r.model ? <span className="inline-flex items-center gap-1.5"><Cpu size={13} aria-hidden style={{ color: 'var(--accent)' }} />{r.name}</span> : r.name}
                  </td>
                  <td className="py-2 text-right num font-semibold">{pts(r.points)}</td>
                  <td className="px-3 py-2 text-right num muted">{r.picks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
