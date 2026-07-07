'use client'

import { Trophy, BarChart3 } from 'lucide-react'
import { useLeague } from './LeagueContext'

/** Segmented league switcher — swaps the accent theme with it. */
export function LeagueSwitcher({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { league, setLeague } = useLeague()
  const items = [
    { key: 'besta' as const, label: 'Besta deildin', Icon: Trophy },
    { key: 'lengjudeild' as const, label: 'Lengjudeildin', Icon: BarChart3 },
  ]
  return (
    <div
      role="tablist"
      aria-label="Veldu deild"
      className={`inline-flex rounded-full border p-1 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {items.map(({ key, label, Icon }) => {
        const active = league === key
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => setLeague(key)}
            className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors min-h-[36px] ${size === 'sm' ? 'px-3' : 'px-4'}`}
            style={{
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-ink)' : 'var(--text-2)',
            }}
          >
            <Icon size={14} aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}
