'use client'

import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { barColor } from '@/lib/nfl/format'
import { MARKET_TOP } from '@/lib/nfl/market'
import type { NflTeam } from '@/lib/nfl/types'

export type Range = '1V' | '1M' | 'ALLT'
const SPAN: Record<Range, number> = { '1V': 2, '1M': 5, ALLT: Infinity }
const OUT = MARKET_TOP + 1

export const rankLabel = (r: number) => (r > MARKET_TOP ? 'utan topp 300' : `#${r}`)

/**
 * Rank after each round, #1 at the top, one line per chosen player in his club's colour
 * (dashed when an earlier line already has that colour). A round without a row is a gap.
 */
export function MarketChart({ weeks, ranks, players, teams, range }: {
  weeks: number[]
  ranks: Record<string, (number | null)[]>
  players: { player_id: string; name: string; team: string }[]
  teams: Map<string, Pick<NflTeam, 'color' | 'color2'>>
  range: Range
}) {
  const from = Math.max(0, weeks.length - SPAN[range])
  const data = useMemo(() => weeks.slice(from).map((w, i) => {
    const p: Record<string, number | null> = { week: w }
    for (const pl of players) p[pl.player_id] = ranks[pl.player_id]?.[from + i] ?? null
    return p
  }), [weeks, from, players, ranks])
  if (!players.length) return <p className="muted text-sm">Bættu leikmanni við línuritið með + í töflunni.</p>
  const seen = new Set<string>()
  const lines = players.map((p) => {
    const color = barColor(teams.get(p.team))
    const dashed = seen.has(color)
    seen.add(color)
    return { ...p, color, dashed }
  })
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -4 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="week" tick={{ fill: 'var(--text-2)', fontSize: 11 }} stroke="var(--border)" tickFormatter={(w) => `V${w}`} />
          <YAxis reversed domain={[1, (max: number) => Math.min(OUT, Math.max(max, 2))]} tick={{ fill: 'var(--text-2)', fontSize: 11 }} stroke="var(--border)"
            allowDecimals={false} tickFormatter={(r: number) => (r > MARKET_TOP ? '300+' : `#${r}`)} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
            labelFormatter={(w) => `Eftir umferð ${w}`}
            formatter={(v, id) => [rankLabel(Number(v)), players.find((p) => p.player_id === id)?.name ?? String(id)]} />
          {lines.map((p) => (
            <Line key={p.player_id} dataKey={p.player_id} stroke={p.color} strokeWidth={2.5} strokeDasharray={p.dashed ? '6 4' : undefined}
              dot={{ r: 3, fill: p.color }} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
