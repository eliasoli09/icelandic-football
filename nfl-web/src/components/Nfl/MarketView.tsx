'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { MarketChart, rankLabel, type Range } from './MarketChart'
import { MarketBoard } from './MarketBoard'
import { MarketMovers } from './MarketMovers'
import { TradeCalculator } from './TradeCalculator'
import type { ClientMarket } from '@/lib/nfl/marketView'
import type { NflTeam } from '@/lib/nfl/types'

const MAX = 6

/**
 * The client shell: the chosen players (in the address as `?p=id,id`, so a link shows the
 * same chart), the range and the four parts. The page is cached, so `?p=` is read here after
 * the first paint; until then the chart shows the round's biggest moves.
 */
export function MarketView({ view, teams }: { view: ClientMarket; teams: Pick<NflTeam, 'abbr' | 'color' | 'color2'>[] }) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const byId = useMemo(() => new Map(view.board.map((r) => [r.player_id, r])), [view.board])
  const [chosen, setChosen] = useState<string[]>(() => {
    const moved = [...view.week.up.slice(0, 2), ...view.week.down.slice(0, 2)].map((m) => m.player_id)
    return moved.length ? moved : view.board.slice(0, 3).map((r) => r.player_id)
  })
  const [range, setRange] = useState<Range>('ALLT')
  const touched = useRef(false)
  const chart = useRef<HTMLElement>(null)

  useEffect(() => {
    // the address is only readable after hydration on a cached page
    const asked = (new URLSearchParams(window.location.search).get('p') ?? '').split(',').filter((id) => byId.has(id))
    if (asked.length) setChosen([...new Set(asked)].slice(0, MAX))
  }, [byId])
  useEffect(() => {
    if (!touched.current) return
    window.history.replaceState(null, '', chosen.length ? `${window.location.pathname}?p=${chosen.join(',')}` : window.location.pathname)
  }, [chosen])

  const toggle = (id: string) => { touched.current = true; setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX ? c : [...c, id])) }
  const pick = (id: string) => {
    touched.current = true
    setChosen((c) => (c.includes(id) || c.length >= MAX ? c : [...c, id]))
    chart.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const players = chosen.flatMap((id) => byId.get(id) ?? [])
  const full = chosen.length >= MAX

  return (
    <div className="grid gap-6">
      <section ref={chart} className="card p-4 grid gap-3 scroll-mt-20">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="display text-lg font-extrabold">Sætið, umferð eftir umferð</h2>
          <div className="inline-flex rounded-full border p-1 text-xs" style={{ borderColor: 'var(--border)' }}>
            {(['1V', '1M', 'ALLT'] as Range[]).map((r) => (
              <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className="rounded-full px-3 min-h-[32px] font-semibold"
                style={{ background: range === r ? 'var(--accent)' : 'transparent', color: range === r ? 'var(--accent-ink)' : 'var(--text-2)' }}>{r}</button>
            ))}
          </div>
        </div>
        <MarketChart weeks={view.weeks} ranks={view.ranks} players={players} teams={byAbbr} range={range} />
        <div className="flex flex-wrap gap-1.5">
          {players.map((p) => (
            <button key={p.player_id} onClick={() => toggle(p.player_id)} aria-label={`Taka ${p.name} af línuritinu`}
              className="rounded-full border px-2.5 min-h-[32px] text-xs font-semibold inline-flex items-center gap-1.5" style={{ borderColor: 'var(--border)' }}>
              {p.name} <span className="muted">{rankLabel(p.rank)}</span> <X size={12} aria-hidden />
            </button>
          ))}
        </div>
        <p className="text-xs muted">{full ? 'Hámark 6 leikmenn á línuritinu.' : 'Bættu við með + í töflunni eða smelltu á nafn í listunum, allt að 6 leikmenn.'}</p>
      </section>
      <MarketMovers week={view.week} season={view.season} first={view.weeks[0]} board={view.board} onPick={pick} />
      <MarketBoard board={view.board} chosen={chosen} full={full} onToggle={toggle} teams={byAbbr} />
      <TradeCalculator board={view.board} />
    </div>
  )
}
