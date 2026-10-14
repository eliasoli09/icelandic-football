'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { NflLogo } from './NflLogo'
import { PlayerHead } from './PlayerHead'
import { PlayersSwitch } from './PlayersSwitch'
import { barColor } from '@/lib/nfl/format'
import { leaders } from '@/lib/nfl/players'
import { GROUP_LABEL, LEADER_CATEGORIES, type LeaderStat } from '@/lib/nfl/statColumns'
import type { PlayerSeasonRow } from '@/lib/nfl/queries'
import type { NflTeam } from '@/lib/nfl/types'

export type LeaderRow = PlayerSeasonRow & { tackles: number; rookie: boolean }

const fmt = (v: number, f?: LeaderStat['format']) =>
  (f === 'epa' ? v.toFixed(1).replace('.', ',') : f === 'half' ? String(v).replace('.', ',') : String(Math.round(v))).replace('-', '−')

// Icelandic sorts Á after A and Þ near the end; localeCompare('is') gets that right
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'is')

export function LeadersView({ season, rows, teams }: { season: number; rows: LeaderRow[]; teams: NflTeam[] }) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const [rookies, setRookies] = useState(false)
  const [q, setQ] = useState('')
  const found = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s.length < 2 ? [] : rows.filter((r) => r.name.toLowerCase().includes(s)).sort(byName).slice(0, 12)
  }, [q, rows])

  return (
    <section className="grid gap-6">
      <PlayersSwitch active="tolfraedi" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm muted">Deildarkeppnin {season}</p>
        <div role="tablist" className="inline-flex rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {([[false, 'Allir'], [true, 'Nýliðar']] as const).map(([v, label]) => (
            <button key={label} role="tab" aria-selected={rookies === v} onClick={() => setRookies(v)}
              className="rounded-full px-4 min-h-[36px] font-semibold"
              style={{ background: rookies === v ? 'var(--accent)' : 'transparent', color: rookies === v ? 'var(--accent-ink)' : 'var(--text-2)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-3">
        <label className="flex items-center gap-2 px-2">
          <Search size={16} aria-hidden className="muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita að leikmanni" aria-label="Leita að leikmanni"
            className="flex-1 bg-transparent outline-none min-h-[40px] text-sm" />
        </label>
        {found.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-1 mt-2">
            {found.map((r) => (
              <li key={r.player_id}>
                <Link href={`/nfl/leikmadur/${r.player_id}`} className="trow flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
                  <PlayerHead name={r.name} src={r.headshot} color={barColor(byAbbr.get(r.team))} size={28} />
                  <span className="font-semibold">{r.name}</span>
                  <span className="muted text-xs">{r.position} · {r.team}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {LEADER_CATEGORIES.map(({ group, stats }) => (
        <div key={group} className="grid gap-3">
          <h2 className="display text-xl font-extrabold">{GROUP_LABEL[group]}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.map((st) => {
              const top = leaders(rows, st.stat as keyof LeaderRow, 10, (r) => !rookies || r.rookie)
              return (
                <div key={st.stat} className="card p-4">
                  <h3 className="text-sm font-semibold mb-2">{st.label}</h3>
                  {top.length === 0 ? <p className="text-sm muted">Enginn enn.</p> : (
                    <ol className="grid gap-1">
                      {top.map((r, i) => (
                        <li key={r.player_id}>
                          <Link href={`/nfl/leikmadur/${r.player_id}`} className="trow flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm">
                            <span className="num muted w-5 text-right text-xs">{i + 1}</span>
                            <PlayerHead name={r.name} src={r.headshot} color={barColor(byAbbr.get(r.team))} size={26} />
                            <span className="truncate font-medium">{r.name}</span>
                            <NflLogo team={byAbbr.get(r.team)} size={14} />
                            <span className="ml-auto num font-semibold">{fmt(Number(r[st.stat as keyof LeaderRow]), st.format)}</span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <p className="text-[11px] muted max-w-2xl">
        EPA (expected points added) mælir hve mörgum væntum stigum leikmaðurinn bætti við liðið sitt umfram meðaltal. Gögn: nflverse.
      </p>
    </section>
  )
}
