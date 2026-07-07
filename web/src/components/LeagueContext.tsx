'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { League } from '@/lib/types'

const LeagueCtx = createContext<{
  league: League
  setLeague: (l: League) => void
}>({ league: 'besta', setLeague: () => {} })

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const [league, setLeagueState] = useState<League>('besta')

  useEffect(() => {
    const stored = window.localStorage.getItem('deild')
    if (stored === 'lengjudeild') setLeagueState('lengjudeild')
  }, [])

  const setLeague = (l: League) => {
    setLeagueState(l)
    window.localStorage.setItem('deild', l)
  }

  return (
    <LeagueCtx.Provider value={{ league, setLeague }}>
      <div className="league-theme" data-league={league === 'lengjudeild' ? 'lengjudeild' : undefined}>
        {children}
      </div>
    </LeagueCtx.Provider>
  )
}

export const useLeague = () => useContext(LeagueCtx)
