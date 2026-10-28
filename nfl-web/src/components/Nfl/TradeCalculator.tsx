'use client'

import { useId, useState } from 'react'
import { X } from 'lucide-react'
import { pointsLabel } from '@/lib/nfl/format'
import { tradeVerdict } from '@/lib/nfl/market'
import type { ClientRow } from '@/lib/nfl/marketView'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** What a player adds to his side: nothing below replacement. */
const worth = (r: ClientRow | undefined) => Math.max(r?.value ?? 0, 0)

function Side({ label, total, ids, setIds, taken, board, byId }: {
  label: string; total: number; ids: string[]; setIds: (x: string[]) => void; taken: string[]; board: ClientRow[]; byId: Map<string, ClientRow>
}) {
  const [q, setQ] = useState('')
  const inputId = useId()
  const needle = fold(q.trim())
  const hits = needle.length < 2 ? [] : board.filter((r) => !taken.includes(r.player_id) && fold(r.name).includes(needle)).slice(0, 6)
  return (
    <div className="grid gap-2 content-start">
      <div className="font-bold flex items-baseline justify-between gap-2">
        <label htmlFor={inputId}>{label}</label><span className="tabular-nums">{pointsLabel(total)}</span>
      </div>
      {ids.map((id) => {
        const r = byId.get(id)
        return (
          <div key={id} className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-sm" style={{ borderColor: 'var(--border)' }}>
            <span className="truncate">{r?.name} <span className="muted text-xs">{r?.position} · {r?.team}</span></span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="tabular-nums">{pointsLabel(worth(r))}</span>
              <button onClick={() => setIds(ids.filter((x) => x !== id))} aria-label={`Taka ${r?.name ?? ''} út`} className="w-8 h-8 inline-flex items-center justify-center"><X size={14} aria-hidden /></button>
            </span>
          </div>
        )
      })}
      <input id={inputId} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita að leikmanni" autoComplete="off"
        className="rounded-lg border px-3 min-h-[40px] text-base sm:text-sm bg-transparent" style={{ borderColor: 'var(--border)' }} />
      {hits.map((r) => (
        <button key={r.player_id} onClick={() => { setIds([...ids, r.player_id]); setQ('') }} className="trow text-left flex items-center justify-between gap-2 px-2 py-1.5 text-sm min-h-[40px]">
          <span className="truncate">{r.name} <span className="muted text-xs">{r.position} · {r.team}</span></span>
          <span className="tabular-nums muted text-xs">{pointsLabel(worth(r))}</span>
        </button>
      ))}
    </div>
  )
}

/** Skiptireiknir: our value on each side, from the newest round, all in the browser. */
export function TradeCalculator({ board }: { board: ClientRow[] }) {
  const [give, setGive] = useState<string[]>([])
  const [get, setGet] = useState<string[]>([])
  const byId = new Map(board.map((r) => [r.player_id, r]))
  const v = tradeVerdict(give.map((id) => byId.get(id)?.value ?? 0), get.map((id) => byId.get(id)?.value ?? 0))
  const taken = [...give, ...get]
  return (
    <section className="card p-4 grid gap-3">
      <h2 className="display text-lg font-extrabold">Skiptireiknir</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Side label="Þú lætur" total={v.a} ids={give} setIds={setGive} taken={taken} board={board} byId={byId} />
        <Side label="Þú færð" total={v.b} ids={get} setIds={setGet} taken={taken} board={board} byId={byId} />
      </div>
      <p className="font-bold min-h-[1.5rem]" aria-live="polite">
        {give.length > 0 && get.length > 0 && (v.fair ? 'Sanngjörn skipti' : v.winner === 'b' ? `Þú vinnur skiptin um ${pointsLabel(v.margin)} stig` : `Hinn vinnur skiptin um ${pointsLabel(v.margin)} stig`)}
      </p>
      <p className="text-xs muted">Verðmæti er spáð fantasy-stig umfram varamann það sem eftir er tímabilsins. Leikmaður undir varamannsstigum telst 0. Sanngjarnt er innan 10% af stærri hliðinni.</p>
    </section>
  )
}
