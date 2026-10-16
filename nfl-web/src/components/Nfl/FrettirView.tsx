'use client'

import { useMemo, useState } from 'react'
import { NEWS_NOTE, NewsList } from './NewsList'
import type { NewsItem } from '@/lib/nfl/queries'
import type { NflTeam } from '@/lib/nfl/types'

export function FrettirView({ items, teams }: { items: NewsItem[]; teams: NflTeam[] }) {
  const [team, setTeam] = useState('')
  const shown = useMemo(() => (team ? items.filter((n) => n.teams.includes(team)) : items), [items, team])
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'is'))
  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="display text-xl font-extrabold">Fréttir</h2>
        <label className="text-sm inline-flex items-center gap-2">
          <span className="muted">Lið</span>
          <select value={team} onChange={(e) => setTeam(e.target.value)} className="rounded-lg border px-3 min-h-[40px] text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="">Öll lið</option>
            {sorted.map((t) => <option key={t.abbr} value={t.abbr}>{t.name}</option>)}
          </select>
        </label>
      </div>
      <NewsList items={shown} />
      <p className="text-[11px] muted max-w-2xl">{NEWS_NOTE}</p>
    </section>
  )
}
