'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Check, ChevronDown, Search, Trophy } from 'lucide-react'
import { useLeague } from './LeagueContext'
import { leagueTheme } from '@/lib/leagueTheme'
import type { League } from '@/lib/types'

/** Above this many competitions the pills stop fitting and it becomes a list. */
const PILL_LIMIT = 3

export function LeagueSwitcher({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { league, setLeague, leagues, current } = useLeague()
  if (leagues.length <= PILL_LIMIT) return <Pills size={size} />

  return <Picker size={size} league={league} setLeague={setLeague} leagues={leagues} current={current} />
}

function Pills({ size }: { size: 'sm' | 'md' }) {
  const { league, setLeague, leagues } = useLeague()
  return (
    <div
      role="tablist"
      aria-label="Veldu deild"
      className={`inline-flex rounded-full border p-1 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {leagues.map((l) => {
        const active = league === l.key
        const Icon = l.key === 'besta' ? Trophy : BarChart3
        return (
          <button
            key={l.key}
            role="tab"
            aria-selected={active}
            onClick={() => setLeague(l.key as League)}
            className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors min-h-[36px] ${size === 'sm' ? 'px-3' : 'px-4'}`}
            style={{
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-ink)' : 'var(--text-2)',
            }}
          >
            <Icon size={14} aria-hidden />
            {l.name}
          </button>
        )
      })}
    </div>
  )
}

function Picker({
  size, league, setLeague, leagues, current,
}: {
  size: 'sm' | 'md'
  league: League
  setLeague: (l: League) => void
  leagues: ReturnType<typeof useLeague>['leagues']
  current: ReturnType<typeof useLeague>['current']
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  // group by country so a long list stays scannable
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const hit = leagues.filter(
      (l) => !needle || l.name.toLowerCase().includes(needle) || l.country.toLowerCase().includes(needle),
    )
    const by = new Map<string, typeof leagues>()
    for (const l of hit) {
      const k = l.country || '—'
      if (!by.has(k)) by.set(k, [])
      by.get(k)!.push(l)
    }
    return [...by]
  }, [leagues, q])

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-full border font-semibold min-h-[36px] ${size === 'sm' ? 'text-xs px-3' : 'text-sm px-4'}`}
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
      >
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: 'var(--accent)' }}
          aria-hidden
        />
        <span className="truncate max-w-[42vw] sm:max-w-none">{current?.name ?? 'Veldu deild'}</span>
        <ChevronDown size={14} aria-hidden style={{ color: 'var(--text-2)' }} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-[19rem] max-w-[85vw] rounded-2xl border shadow-xl overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-solid)' }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <Search size={14} aria-hidden style={{ color: 'var(--text-2)' }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Leita að deild eða landi"
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: 'var(--text)' }}
            />
          </div>
          <div className="max-h-[19rem] overflow-y-auto py-1">
            {groups.length === 0 && (
              <p className="px-3 py-3 text-xs muted">Engin deild fannst.</p>
            )}
            {groups.map(([country, items]) => (
              <div key={country}>
                <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider muted">{country}</p>
                {items.map((l) => {
                  const active = l.key === league
                  return (
                    <button
                      key={l.key}
                      role="option"
                      aria-selected={active}
                      onClick={() => { setLeague(l.key as League); setOpen(false); setQ('') }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:opacity-80 transition-opacity"
                      style={{ color: active ? 'var(--text)' : 'var(--text-2)' }}
                    >
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: leagueTheme(l.key, l.accent).accent }}
                        aria-hidden
                      />
                      <span className="flex-1 truncate">{l.name}</span>
                      {active && <Check size={14} aria-hidden style={{ color: 'var(--accent)' }} />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
