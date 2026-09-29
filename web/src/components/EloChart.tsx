'use client'

import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

const PALETTE = [
  '#4d8dff', '#22c58b', '#f0605b', '#eda13c', '#a78bfa', '#f472b6',
  '#38bdf8', '#facc15', '#94a3b8', '#fb923c', '#2dd4bf', '#c084fc',
]

export interface EloSeriesPoint {
  idx: number
  date: string | null
  [team: string]: number | string | null
}

/**
 * Interactive Elo history: legend chips toggle teams, hovering a chip
 * isolates its line (others fade to 10%), and lines draw in on mount.
 */
export function EloChart({
  data,
  teamNames,
  defaultSelected,
  teamColors = {},
}: {
  data: EloSeriesPoint[]
  teamNames: string[]
  defaultSelected: string[]
  teamColors?: Record<string, string>
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected))
  const [focus, setFocus] = useState<string | null>(null)
  const toggle = (t: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }
  const colorOf = useMemo(
    () => new Map(teamNames.map((t, i) => [t, teamColors[t] ?? PALETTE[i % PALETTE.length]])),
    [teamNames, teamColors],
  )
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Veldu lið á grafið">
        {teamNames.map((t) => {
          const on = selected.has(t)
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              onMouseEnter={() => setFocus(t)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(t)}
              onBlur={() => setFocus(null)}
              aria-pressed={on}
              className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-transform hover:scale-[1.03]"
              style={{
                borderColor: on ? colorOf.get(t) : 'var(--border)',
                background: on ? colorOf.get(t) + '26' : 'var(--surface)',
                color: on ? colorOf.get(t) : 'var(--text-2)',
              }}
            >
              {t}
            </button>
          )
        })}
      </div>
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--text-2)' }}
              tickFormatter={(d: string | null) => (d ? d.slice(0, 7) : '')}
              minTickGap={48}
              stroke="var(--border)"
            />
            <YAxis
              domain={['dataMin - 20', 'dataMax + 20']}
              tick={{ fontSize: 11, fill: 'var(--text-2)' }}
              width={44}
              stroke="var(--border)"
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-solid, var(--surface))',
                border: '1px solid var(--border-strong)',
                borderRadius: 10,
                fontSize: 12,
                fontVariantNumeric: 'tabular-nums',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              }}
              labelStyle={{ color: 'var(--text-2)' }}
              labelFormatter={(d) => (typeof d === 'string' ? d.slice(0, 10) : '')}
              formatter={(v, name) => [Math.round(Number(v)), name]}
            />
            {[...selected].map((t) => (
              <Line
                key={t}
                type="monotone"
                dataKey={t}
                stroke={colorOf.get(t)}
                strokeOpacity={focus && focus !== t ? 0.1 : 1}
                dot={false}
                strokeWidth={focus === t ? 3 : 2}
                connectNulls
                animationDuration={700}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
