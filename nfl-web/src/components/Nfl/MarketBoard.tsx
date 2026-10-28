'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { PlayerHead } from './PlayerHead'
import { barColor, pointsLabel } from '@/lib/nfl/format'
import { MARKET_TOP } from '@/lib/nfl/market'
import type { ClientRow } from '@/lib/nfl/marketView'
import type { NflTeam } from '@/lib/nfl/types'

const FILTERS = ['Allir', 'QB', 'RB', 'WR', 'TE'] as const
const SHOW = 25

/** Places gained since the round before; nothing to compare with is "-", a first appearance "nýr". */
function Change({ n, isNew }: { n: number | null; isNew?: boolean }) {
  if (n === null) return <span className="text-xs muted">{isNew ? 'nýr' : '-'}</span>
  if (n === 0) return <span className="text-xs muted">-</span>
  return <span className="text-xs font-semibold tabular-nums whitespace-nowrap" style={{ color: n > 0 ? 'var(--good, #3fb950)' : 'var(--bad, #f85149)' }}>{n > 0 ? '▲' : '▼'} {Math.abs(n)}</span>
}

/** The newest round, #1 to #MARKET_TOP, filtered by position; + puts a player on the chart. */
export function MarketBoard({ board, chosen, full, onToggle, teams }: {
  board: ClientRow[]; chosen: string[]; full: boolean; onToggle: (id: string) => void; teams: Map<string, Pick<NflTeam, 'color' | 'color2'>>
}) {
  const [f, setF] = useState<(typeof FILTERS)[number]>('Allir')
  const [all, setAll] = useState(false)
  const rows = board.filter((r) => r.rank <= MARKET_TOP && (f === 'Allir' || r.position === f))
  return (
    <section className="card p-4 grid gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="display text-lg font-extrabold">Topp {MARKET_TOP}</h2>
        <div className="inline-flex rounded-full border p-1 text-xs" style={{ borderColor: 'var(--border)' }}>
          {FILTERS.map((x) => (
            <button key={x} onClick={() => setF(x)} aria-pressed={f === x} className="rounded-full px-3 min-h-[32px] font-semibold"
              style={{ background: f === x ? 'var(--accent)' : 'transparent', color: f === x ? 'var(--accent-ink)' : 'var(--text-2)' }}>{x}</button>
          ))}
        </div>
      </div>
      <p className="text-xs muted">Verðmæti í fantasy-stigum umfram varamann það sem eftir er tímabilsins. ▲/▼ er breyting á sæti frá síðustu umferð.</p>
      <ol className="grid">
        {(all ? rows : rows.slice(0, SHOW)).map((r) => {
          const on = chosen.includes(r.player_id)
          return (
            <li key={r.player_id} className="trow flex items-center gap-2 px-1 sm:px-2 py-1.5 text-sm">
              <span className="w-8 shrink-0 text-right tabular-nums font-bold">{r.rank}</span>
              <PlayerHead name={r.name} src={r.headshot} color={barColor(teams.get(r.team))} size={32} />
              <Link href={`/leikmadur/${r.player_id}`} className="min-w-0 flex-1">
                <span className="font-semibold truncate block">{r.name}</span>
                <span className="text-xs muted block truncate">{r.position}{r.pos_rank} · {r.team} · {pointsLabel(r.proj)} í leik</span>
              </Link>
              <span className="grid justify-items-end shrink-0">
                <span className="font-bold tabular-nums">{pointsLabel(r.value)}</span>
                <Change n={r.change} isNew={r.isNew} />
              </span>
              <button onClick={() => onToggle(r.player_id)} aria-pressed={on} disabled={!on && full}
                aria-label={on ? `Taka ${r.name} af línuritinu` : `Setja ${r.name} á línuritið`}
                className="w-9 h-9 shrink-0 rounded-full border inline-flex items-center justify-center disabled:opacity-40"
                style={{ borderColor: on ? 'var(--accent)' : 'var(--border)', color: on ? 'var(--accent)' : undefined }}>
                {on ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
              </button>
            </li>
          )
        })}
      </ol>
      {rows.length > SHOW && (
        <button onClick={() => setAll(!all)} className="text-sm font-semibold underline justify-self-start min-h-[36px]">
          {all ? 'Sýna færri' : `Sýna alla ${rows.length}`}
        </button>
      )}
    </section>
  )
}
