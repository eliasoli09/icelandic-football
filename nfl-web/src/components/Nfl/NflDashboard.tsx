'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpDown, BarChart3, Pause, Play } from 'lucide-react'
import { divisionStrength, selectDashboardRows, type DashboardFilter, type DashboardRow, type DashboardSort } from '@/lib/nfl/dashboard'
import { NflFootball } from './NflFootball'
import styles from './NflStadium.module.css'

// Explicit separators keep SSR identical on browsers without Icelandic ICU data.
const integer = { format: (value: number) => Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
const decimal = { format: (value: number) => value.toFixed(1).replace('.', ',') }
const runLabel = (value: string) => {
  const d = new Date(value)
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}. kl. ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
const columns: [DashboardSort, string][] = [['name', 'Lið'], ['elo', 'Einkunn | Elo'], ['wins', 'Spáðir sigrar'], ['playoffs', 'Líkur í úrslitakeppni'], ['divisionChance', 'Líkur á að vinna riðil'], ['title', 'Líkur á Super Bowl']]

function Probability({ value, tone }: { value: number | null; tone: string }) {
  return <div className={styles.probability}>
    <span className={styles.track} aria-hidden="true"><span className={styles[tone]} style={{ '--fill': `${Math.max(0, Math.min(1, value ?? 0)) * 100}%` } as CSSProperties} /></span>
    <span>{value === null ? '-' : `${Math.round(value * 100)}%`}</span>
  </div>
}

/** `compact`: the Spár tab's version, without the ball (the front page has it). */
export function NflDashboard({ rows, sims, season, runAt, error, compact = false }: { rows: DashboardRow[]; sims: number | null; season: number | null; runAt: string | null; error?: string; compact?: boolean }) {
  const [filter, setFilter] = useState<DashboardFilter>('AFC')
  const [sort, setSort] = useState<DashboardSort>('wins')
  const [descending, setDescending] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [paused, setPaused] = useState(false)
  const sorted = useMemo(() => selectDashboardRows(rows, filter, sort, descending), [rows, filter, sort, descending])
  const divisions = useMemo(() => divisionStrength(rows), [rows])
  const choose = (value: DashboardFilter) => { setFilter(value); setSort(value === 'Super Bowl' ? 'title' : 'wins'); setDescending(true); setExpanded(false) }
  const sortBy = (value: DashboardSort) => { setSort(value); setDescending(sort === value ? !descending : value !== 'name') }
  return <section className={styles.dashboard} data-paused={paused}>
    <div className={`${styles.hero} ${compact ? styles.heroCompact : ''}`}>
      {!compact && <div className={styles.heroArt} aria-hidden="true">
        <NflFootball paused={paused} />
        <span className={styles.heroMotto}>STÆRRI LEIKIR<br />SKARPARI SÝN<i /></span>
      </div>}
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>BANDARÍSKI FÓTBOLTINN</p>
        <h1>{compact ? 'Spár' : 'NFL'}</h1>
        <p className={styles.subtitle}>Spáð lokastaða og líkur í úrslitakeppni.</p>
        <div className={styles.filters} aria-label="Veldu deild">
          {(['AFC', 'NFC', 'Super Bowl'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => choose(value)}>{value}</button>)}
        </div>
      </div>
      {!compact && <button className={styles.motionToggle} aria-pressed={paused} onClick={() => setPaused(p => !p)} aria-label={paused ? 'Spila hreyfingar' : 'Gera hlé á hreyfingum'} title={paused ? 'Spila hreyfingar' : 'Gera hlé á hreyfingum'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
    </div>
    <div className={styles.panels}>
      <section className={styles.panel} aria-labelledby="nfl-forecast-title">
        <div className={styles.panelHeading}><h2 id="nfl-forecast-title">Spáð lokastaða</h2><span className={styles.badge}>{sims ? `${integer.format(sims)} hermanir` : season ? `Tímabilið ${season}` : 'NFL'}</span></div>
        {rows.length ? <>
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`Spáð lokastaða - ${filter}`}>
            <table className={styles.forecastTable}>
              <thead><tr><th scope="col">#</th>{columns.map(([key, label]) => <th scope="col" key={key} aria-sort={sort === key ? descending ? 'descending' : 'ascending' : 'none'}><button onClick={() => sortBy(key)}>{label}<ArrowUpDown size={10} aria-hidden="true" /></button></th>)}</tr></thead>
              <tbody key={filter}>{(expanded ? sorted : sorted.slice(0, 10)).map((row, index) => <tr key={row.abbr} style={{ '--row': index } as CSSProperties}>
                <td>{index + 1}</td><th scope="row">{row.name}</th><td>{integer.format(row.elo)}</td><td>{row.wins === null ? '-' : decimal.format(row.wins)}</td>
                <td><Probability value={row.playoffs} tone="cyan" /></td><td><Probability value={row.divisionChance} tone="red" /></td><td><Probability value={row.title} tone="silver" /></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className={styles.panelFooter}><p>{sims ? `Líkur byggðar á ${integer.format(sims)} hermunum.` : 'Líkur birtast þegar hermun hefur verið keyrð.'} Spáðir sigrar samkvæmt Elo.</p><button onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>{expanded ? 'Sýna færri' : 'Sjá öll liðin'}<ArrowRight size={16} /></button></div>
        </> : <div className={styles.emptyState}><BarChart3 size={32} /><h3>Spáin er í undirbúningi</h3><p>{error ?? 'Engir leikir fundust fyrir tímabilið.'}</p><Link href="/stada">Skoða stöðuna <ArrowRight size={15} /></Link></div>}
      </section>
      <aside className={`${styles.panel} ${styles.divisionPanel}`} aria-labelledby="nfl-divisions-title">
        <div className={styles.panelHeading}><h2 id="nfl-divisions-title">Styrkur riðla</h2><BarChart3 size={18} className={styles.subtleIcon} /></div>
        {divisions.length ? <ol className={styles.divisions}>{divisions.map((division, index) => <li key={division.name}><span>{index + 1}</span><strong>{division.name}</strong><span className={styles.divisionTrack} aria-hidden="true"><span className={index > 5 ? styles.red : index === 5 ? styles.silver : styles.cyan} style={{ '--fill': `${Math.max(8, (division.elo / divisions[0].elo) * 100)}%` } as CSSProperties} /></span><b>{integer.format(division.elo)}</b></li>)}</ol> : <p className={styles.divisionEmpty}>Styrkleikar birtast þegar gögn eru tiltæk.</p>}
        <p className={styles.divisionNote}>Meðal Elo-einkunn liða í hverjum riðli.</p>
        <Link href="/styrkleiki" className={styles.textLink}>Sjá nánar um riðla <ArrowRight size={16} /></Link>
        <Link href="https://islensk-fotbolti.vercel.app/topp10" className={styles.promo}><BarChart3 size={30} /><span><strong>Prófaðu Tenaball</strong><small>Þekkir þú bestu leikmennina?</small></span><ArrowRight size={18} /></Link>
      </aside>
    </div>
    <div className={styles.dataNote}><span>{season ? `Tímabilið ${season}` : 'NFL'} · Elo + líkindahermun</span>{runAt && <span>Síðast hermt: {runLabel(runAt)}</span>}</div>
  </section>
}
