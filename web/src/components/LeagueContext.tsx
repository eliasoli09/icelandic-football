'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { League } from '@/lib/types'
import type { LeagueRow } from '@/lib/leagues'
import { leagueTheme, leagueVars } from '@/lib/leagueTheme'

interface Ctx {
  league: League
  setLeague: (l: League) => void
  leagues: LeagueRow[]
  current: LeagueRow | undefined
}

const LeagueCtx = createContext<Ctx>({
  league: 'besta', setLeague: () => {}, leagues: [], current: undefined,
})

/** The two founding leagues keep their hand-tuned palette in globals.css. */
const CSS_THEMED = new Set(['besta', 'lengjudeild'])

export function LeagueProvider({
  leagues,
  children,
}: {
  leagues: LeagueRow[]
  children: React.ReactNode
}) {
  const fallback = (leagues[0]?.key ?? 'besta') as League
  const [league, setLeagueState] = useState<League>(fallback)

  useEffect(() => {
    const stored = window.localStorage.getItem('deild')
    // a stored league can disappear when the registry changes
    if (stored && leagues.some((l) => l.key === stored)) setLeagueState(stored as League)
  }, [leagues])

  const setLeague = (l: League) => {
    setLeagueState(l)
    window.localStorage.setItem('deild', l)
  }

  const current = leagues.find((l) => l.key === league)
  // colours for anything the stylesheet does not already cover, so a new
  // competition themes itself without a CSS edit
  const style = useMemo(
    () => (CSS_THEMED.has(league) ? undefined : leagueVars(leagueTheme(league, current?.accent))),
    [league, current?.accent],
  )

  return (
    <LeagueCtx.Provider value={{ league, setLeague, leagues, current }}>
      <div
        className="league-theme"
        data-league={CSS_THEMED.has(league) && league !== 'besta' ? league : undefined}
        style={style as React.CSSProperties}
      >
        {children}
      </div>
    </LeagueCtx.Provider>
  )
}

export const useLeague = () => useContext(LeagueCtx)
