import Link from 'next/link'
import { ChevronDown, Info } from 'lucide-react'
import type { UefaClub, UefaMatch, UefaSim } from '@/lib/queries'
import { formatUefaNumber, strengthScale } from '@/lib/uefaDisplay'
import { UEFA_SIMULATION_RUNS } from '@/lib/uefaConfig'
import { formatKickoff } from '@/lib/kickoff'
import { ProbBar } from '../ProbBar'
import { CompetitionBackdrop } from './CompetitionBackdrop'
import { UEFA_COMPETITIONS, type UefaCompetition } from '@/lib/uefaCompetitions'
import { UefaStandings } from './UefaStandings'
import styles from './Uefa.module.css'

type Props = {
  competition: UefaCompetition
  clubs: UefaClub[]; rows: UefaSim[]; upcoming: UefaMatch[]; played: UefaMatch[]
  ladder: {name:string;strength:number}[]
}

export function CompetitionPage({competition,clubs,rows,ladder,upcoming,played}:Props) {
  const byClub=new Map(clubs.map(c=>[c.club,c]))
  const scale=strengthScale(ladder.map(l=>l.strength))
  const standings=rows.map((r,i)=>({...r,rank:i+1,rating:byClub.get(r.club)?.rating??null,assoc:byClub.get(r.club)?.assoc,rated:byClub.get(r.club)?.rated}))
  return <div className={styles.competition} data-uefa-theme={competition.key}>
    <CompetitionBackdrop competition={competition.key} />
    <header className={`${styles.hero} uefa-hero`}>
      <p className={styles.eyebrow}>EVRÓPUKEPPNIRNAR</p>
      <h1>{competition.name}</h1>
      <p className={styles.subtitle}>Spáð lokastaða og líkur á framhaldi.</p>
    </header>
    <nav className={styles.competitions} aria-label="Evrópukeppnir">
      {UEFA_COMPETITIONS.map(item=><Link key={item.key} href={`/uefa?deild=${item.key}`} scroll={false} aria-current={competition.key===item.key?'page':undefined}>{item.name}</Link>)}
    </nav>
    <div className={styles.columns}>
      <section className={styles.panel} aria-labelledby={`${competition.key}-standings-title`}>
        <div className={styles.panelHead}><h2 id={`${competition.key}-standings-title`}>Spáð lokastaða</h2><span className={styles.badge}>{formatUefaNumber(UEFA_SIMULATION_RUNS)} hermanir</span></div>
        <UefaStandings key={competition.key} rows={standings} />
        <p className={styles.note}>{rows.length} lið · Átta efstu fara beint í 16-liða úrslit. Sætin 9–24 fara í umspil. Neðstu tólf eru úr leik.</p>
      </section>
      <aside className={styles.side}>
        <section className={styles.panel} aria-labelledby={`${competition.key}-strength-title`}>
          <div className={styles.panelHead}><h2 id={`${competition.key}-strength-title`}>Styrkur deilda</h2></div>
          <ol className={styles.leagues}>{ladder.map((league,i)=><li key={league.name}>
            <span className={styles.leagueRank}>{i+1}</span><span>{league.name}</span>
            <span className={styles.leagueTrack} aria-hidden="true"><span style={{width:`${Math.max(0,league.strength)/scale*100}%`}}/></span>
            <strong>{formatUefaNumber(league.strength)}</strong>
          </li>)}</ol>
          <p className={styles.note}>Metið eingöngu úr leikjum milli deilda í Evrópukeppnunum.</p>
          <p className={styles.scale}>Sameiginlegur stikukvarði: 0–{formatUefaNumber(scale)} stig.</p>
        </section>
        <details className={`${styles.panel} ${styles.model}`}>
          <summary><Info size={16} aria-hidden="true"/>Um líkanið<ChevronDown size={16} aria-hidden="true"/></summary>
          <div>
            <p>Einkunn félags byggist á stöðu þess innan eigin deildar að viðbættum styrk deildarinnar. Styrkur deilda er metinn eingöngu úr leikjum sem fóru yfir landamæri.</p>
            <p>Deildarkeppnin er hermd {formatUefaNumber(UEFA_SIMULATION_RUNS)} sinnum samkvæmt núverandi líkanastillingu. Stig eru meðaltal úr hermununum; dálkarnir sýna líkur á beinu sæti, umspili og brottfalli.</p>
            <p>Prósentur eru námundaðar sjálfstætt og geta því samtals orðið örlítið frábrugðnar 100%. Stikur sýna upprunalegu líkurnar á sama 0–100% kvarða. Niðurstöðurnar eru spá, ekki trygging fyrir úrslitum.</p>
          </div>
        </details>
      </aside>
    </div>
    <section className={`${styles.panel} ${styles.fixtures}`} aria-labelledby={`${competition.key}-upcoming-title`}>
      <div className={styles.panelHead}><h2 id={`${competition.key}-upcoming-title`}>Leikir framundan</h2><span className={styles.badge}>{upcoming.length} leikir</span></div>
      {!upcoming.length && <p className={styles.empty}>Engir óspilaðir leikir eru skráðir.</p>}
      <ul>{upcoming.map(m=><li key={m.id}>
        <span className={styles.matchDate}>{formatKickoff(m.date)}</span>
        <span className={styles.teams}><strong>{m.home}</strong><span>–</span><strong>{m.away}</strong></span>
        <span className={styles.matchProb}>{m.p_home!==null&&m.p_draw!==null&&m.p_away!==null ? <ProbBar pHome={m.p_home} pDraw={m.p_draw} pAway={m.p_away} compact/> : <span className={styles.note}>Líkur óreiknaðar</span>}</span>
      </li>)}</ul>
    </section>
    {!!played.length && <section className={`${styles.panel} ${styles.fixtures}`} aria-labelledby={`${competition.key}-played-title`}>
      <div className={styles.panelHead}><h2 id={`${competition.key}-played-title`}>Spilaðir leikir</h2><span className={styles.badge}>{played.length} leikir</span></div>
      <ul>{played.map(m=><li key={m.id}>
        <span className={styles.matchDate}>{formatKickoff(m.date)}</span>
        <span className={styles.teams}><strong>{m.home}</strong><strong>{m.home_goals}–{m.away_goals}</strong><strong>{m.away}</strong></span>
      </li>)}</ul>
    </section>}
  </div>
}
