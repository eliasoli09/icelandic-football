'use client'

import { useEffect, useState } from 'react'
import type { UefaCompetitionKey } from '@/lib/uefaCompetitions'
import { ChampionsBackground } from './ChampionsBackground'
import { TournamentBackground } from './TournamentBackground'
import styles from './CompetitionBackdrop.module.css'

/** Only the incoming layer animates; the outgoing layer freezes during its fade. */
export function CompetitionBackdrop({competition}:{competition:UefaCompetitionKey}) {
  const [layers,setLayers] = useState<UefaCompetitionKey[]>([competition])
  useEffect(()=>{
    setLayers(current=>current.at(-1)===competition ? current : [current.at(-1)!,competition])
    const timer=window.setTimeout(()=>setLayers([competition]),320)
    return ()=>window.clearTimeout(timer)
  },[competition])
  return <div className={styles.backdrop} aria-hidden="true">
    {layers.map(key=><div key={key} className={styles.layer} data-active={key===competition}>
      {key==='ucl' ? <ChampionsBackground active={key===competition}/> : <TournamentBackground competition={key} active={key===competition}/>}
    </div>)}
  </div>
}
