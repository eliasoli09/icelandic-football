'use client'

import { Check, Lock, X } from 'lucide-react'
import { NflLogo } from '../NflLogo'
import { pickPoints, type UserPick } from '@/lib/nfl/pickem'
import { clock, dayLabel, isSmallHours } from '@/lib/nfl/time'
import { isPlayed, type NflGame, type NflTeam } from '@/lib/nfl/types'

export function PickRow({ g, home, away, pick, locked, picks, model, onPick }: {
  g: NflGame; home: NflTeam | undefined; away: NflTeam | undefined; pick: string | null; locked: boolean
  /** Everyone's picks in this game, visible once it has started. */
  picks: UserPick[]
  model: string | null
  onPick: (team: string) => void
}) {
  const played = isPlayed(g)
  const points = pick && played ? pickPoints(pick, g) : null
  const share = (abbr: string) => (picks.length ? Math.round((100 * picks.filter((p) => p.pick === abbr).length) / picks.length) : null)
  const side = (abbr: string, team: NflTeam | undefined, score: number | null) => {
    const chosen = pick === abbr
    const pct = locked ? share(abbr) : null
    return (
      <button type="button" onClick={() => onPick(abbr)} disabled={locked} aria-pressed={chosen}
        className="flex-1 min-w-0 min-h-[52px] rounded-xl border px-3 py-2 flex items-center gap-2.5 text-left transition-colors disabled:cursor-default"
        style={{
          borderColor: chosen ? 'var(--accent)' : 'var(--border)',
          background: chosen ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
          opacity: locked && !chosen ? 0.75 : 1,
        }}>
        <NflLogo team={team} size={28} />
        <span className="min-w-0">
          <span className="block font-semibold truncate">{team?.name.split(' ').at(-1) ?? abbr}</span>
          <span className="block text-[11px] muted num">
            {abbr}{pct !== null ? ` · ${pct}% völdu` : ''}{model === abbr ? ' · Líkanið' : ''}
          </span>
        </span>
        {score !== null && <span className="ml-auto stat text-lg">{score}</span>}
      </button>
    )
  }
  return (
    <div className="px-3 py-3 grid gap-2">
      <div className="flex items-center justify-between text-[11px] muted">
        <span>{dayLabel(g.kickoff)} · {isSmallHours(g.kickoff) ? 'aðfaranótt ' : ''}{g.time_tbd ? 'tími óákveðinn' : clock(g.kickoff)}</span>
        {points !== null ? (
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: points > 0 ? 'var(--win)' : 'var(--loss)' }}>
            {points > 0 ? <Check size={12} aria-hidden /> : <X size={12} aria-hidden />}
            {points === 1 ? 'Rétt' : points === 0.5 ? 'Jafntefli, ½' : 'Rangt'}
          </span>
        ) : locked ? (
          <span className="inline-flex items-center gap-1"><Lock size={11} aria-hidden /> {pick ? 'Læst' : 'Læst, engin spá'}</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        {side(g.away, away, g.away_score)}
        <span className="self-center text-xs muted">@</span>
        {side(g.home, home, g.home_score)}
      </div>
    </div>
  )
}
