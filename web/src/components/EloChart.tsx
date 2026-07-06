'use client'

import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
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
      <div className="flex flex-wrap gap-2 mb-4">
        {teamNames.map((t) => (
          <button
            key={t}
            onClick={() => toggle(t)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border"
            style={{
              borderColor: selected.has(t) ? colorOf.get(t) : 'var(--border)',
              background: selected.has(t) ? colorOf.get(t) + '22' : 'var(--surface)',
              color: selected.has(t) ? colorOf.get(t) : 'var(--text-2)',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--text-2)' }}
              tickFormatter={(d: string | null) => (d ? d.slice(0, 7) : '')}
              minTickGap={48}
            />
            <YAxis
              domain={['dataMin - 20', 'dataMax + 20']}
              tick={{ fontSize: 11, fill: 'var(--text-2)' }}
              width={44}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(d) => (typeof d === 'string' ? d.slice(0, 10) : '')}
              formatter={(v) => [Math.round(Number(v)), '']}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {[...selected].map((t) => (
              <Line
                key={t}
                type="monotone"
                dataKey={t}
                stroke={colorOf.get(t)}
                dot={false}
                strokeWidth={2}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
