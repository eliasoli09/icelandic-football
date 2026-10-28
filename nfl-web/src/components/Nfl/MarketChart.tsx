'use client'

import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { barColor } from '@/lib/nfl/format'
import { MARKET_TOP } from '@/lib/nfl/market'
import { rankTicks } from '@/lib/nfl/marketView'
import type { NflTeam } from '@/lib/nfl/types'

export type Range = '1V' | '1M' | 'ALLT'
const SPAN: Record<Range, number> = { '1V': 2, '1M': 5, ALLT: Infinity }
/** The first line in a colour is solid; each later one in the same colour gets the next dash. */
const DASHES = [undefined, '6 4', '2 3', '10 3', '1 2', '12 3 2 3']

export const OUTSIDE = `utan topp ${MARKET_TOP}`
export const rankLabel = (r: number) => (r > MARKET_TOP ? OUTSIDE : `#${r}`)

export interface LineStyle { color: string; dash: string | undefined }
type Teams = Map<string, Pick<NflTeam, 'color' | 'color2'>>

/** Colour and dash of each chosen player's line, used by both the chart and its legend. */
export function lineStyles(players: { player_id: string; team: string }[], teams: Teams): Map<string, LineStyle> {
  const used = new Map<string, number>()
  return new Map(players.map((p) => {
    const color = barColor(teams.get(p.team))
    const n = used.get(color) ?? 0
    used.set(color, n + 1)
    return [p.player_id, { color, dash: DASHES[n % DASHES.length] }]
  }))
}

/** A short piece of the line, for the chips under the chart. */
export function LineSwatch({ style }: { style: LineStyle | undefined }) {
  if (!style) return null
  return (
    <svg width="18" height="6" viewBox="0 0 18 6" aria-hidden className="shrink-0">
      <line x1="1" y1="3" x2="17" y2="3" stroke={style.color} strokeWidth="2.5" strokeDasharray={style.dash} strokeLinecap="butt" />
    </svg>
  )
}

/** Rank after each round, #1 at the top, one line per chosen player. A round without a row is a gap. */
export function MarketChart({ weeks, ranks, players, styles, range }: {
  weeks: number[]
  ranks: Record<string, (number | null)[]>
  players: { player_id: string; name: string }[]
  styles: Map<string, LineStyle>
  range: Range
}) {
  const from = Math.max(0, weeks.length - SPAN[range])
  const { data, max } = useMemo(() => {
    let max = 1
    const data = weeks.slice(from).map((w, i) => {
      const p: Record<string, number | null> = { week: w }
      for (const pl of players) {
        const r = ranks[pl.player_id]?.[from + i] ?? null
        p[pl.player_id] = r
        if (r !== null && r > max) max = r
      }
      return p
    })
    return { data, max: Math.min(max, MARKET_TOP + 1) }
  }, [weeks, from, players, ranks])
  if (!players.length) return <p className="muted text-sm">Bættu leikmanni við línuritið með + í töflunni.</p>
  const ticks = rankTicks(max)
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="week" tick={{ fill: 'var(--text-2)', fontSize: 11 }} stroke="var(--border)" tickFormatter={(w) => `V${w}`} />
          <YAxis reversed domain={[1, Math.max(max, 2)]} ticks={ticks} interval={0} tick={{ fill: 'var(--text-2)', fontSize: 11 }} stroke="var(--border)"
            allowDecimals={false} tickFormatter={(r: number) => (r > MARKET_TOP ? `${MARKET_TOP}+` : `#${r}`)} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
            labelFormatter={(w) => `Eftir umferð ${w}`}
            formatter={(v, id) => [rankLabel(Number(v)), players.find((p) => p.player_id === id)?.name ?? String(id)]} />
          {players.map((p) => {
            const s = styles.get(p.player_id)
            return (
              <Line key={p.player_id} dataKey={p.player_id} stroke={s?.color} strokeWidth={2.5} strokeDasharray={s?.dash}
                dot={{ r: 3, fill: s?.color, strokeDasharray: '' }} connectNulls={false} isAnimationActive={false} />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
