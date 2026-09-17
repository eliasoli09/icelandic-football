'use client'

import { useMemo, useState } from 'react'
import { FIFA, lineOf, tier, type FifaPlayer, type Line } from '@/lib/fifa/ratings'
import { normalise } from '@/lib/topp10/normalise'
import styles from './Fifa.module.css'

const LINE_LABEL: Record<Line, string> = { GK: 'Markverðir', DEF: 'Varnarmenn', MID: 'Miðjumenn', FWD: 'Sóknarmenn' }
const TEAMS = [...new Set(FIFA.players.map((p) => p.team))].sort((a, b) => a.localeCompare(b, 'is'))
const date = (iso: string) => iso.split('-').reverse().join('.')

function Card({ p }: { p: FifaPlayer }) {
  return (
    <div className={`${styles.card} ${styles[tier(p.rating)]}`}>
      <div className={styles.cardTop}>
        <strong>{p.rating}</strong>
        <span>{p.position ?? ''}</span>
      </div>
      <div className={styles.cardName} title={p.name}>{p.name}</div>
      <div className={styles.cardMeta}>{p.team}</div>
      <div className={styles.cardStats}>
        <span><b>{p.apps}</b>leikir</span>
        <span><b>{p.goals}</b>mörk</span>
        <span><b>{Math.round(p.minutes / 90)}</b>×90</span>
      </div>
    </div>
  )
}

export function FifaRatings() {
  const [team, setTeam] = useState('')
  const [line, setLine] = useState<Line | ''>('')
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)

  const rows = useMemo(() => {
    const q = normalise(query)
    return FIFA.players.filter((p) =>
      (!team || p.team === team) && (!line || lineOf(p.position) === line) && (!q || normalise(p.name).includes(q)))
  }, [team, line, query])
  const shown = all ? rows : rows.slice(0, 30)
  const cv = FIFA.model.crossValidation

  return (
    <section className={styles.shell} aria-labelledby="fifa-heading">
      <div className={styles.head}>
        <div>
          <h1 id="fifa-heading" className="display text-2xl font-black">FIFA-einkunnir - Besta deildin {FIFA.season}</h1>
          <p className="muted text-sm">Allir {FIFA.players.length} leikmenn sem hafa spilað í deildinni. Sá besti fær 94.</p>
        </div>
      </div>

      <div className={styles.cards}>
        {FIFA.players.slice(0, 8).map((p) => <Card key={p.id} p={p} />)}
      </div>

      <div className={styles.filters}>
        <label>
          <span className="sr-only">Lið</span>
          <select value={team} onChange={(e) => { setTeam(e.target.value); setAll(false) }}>
            <option value="">Öll lið</option>
            {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Staða</span>
          <select value={line} onChange={(e) => { setLine(e.target.value as Line | ''); setAll(false) }}>
            <option value="">Allar stöður</option>
            {(Object.keys(LINE_LABEL) as Line[]).map((l) => <option key={l} value={l}>{LINE_LABEL[l]}</option>)}
          </select>
        </label>
        <label className={styles.search}>
          <span className="sr-only">Leita að leikmanni</span>
          <input type="search" value={query} placeholder="Leita að leikmanni" onChange={(e) => { setQuery(e.target.value); setAll(false) }} />
        </label>
      </div>

      <div className="card p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="muted text-xs text-left">
              <th className="py-1 font-medium">#</th>
              <th className="font-medium">Einkunn</th>
              <th className="font-medium">Leikmaður</th>
              <th className="font-medium">Staða</th>
              <th className="font-medium">Lið</th>
              <th className="text-right font-medium">Leikir</th>
              <th className="text-right font-medium">Mín.</th>
              <th className="text-right font-medium">Mörk</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className="trow">
                <td className="py-1.5 muted num">{FIFA.players.indexOf(p) + 1}</td>
                <td><span className={`${styles.badge} ${styles[tier(p.rating)]}`}>{p.rating}</span></td>
                <td className="font-medium" title={p.basis === 'sofascore' ? 'Byggt á SofaScore-einkunn og líkani' : 'Byggt á líkani'}>
                  {p.name}{p.basis !== 'sofascore' && <span className="muted" aria-hidden> °</span>}
                </td>
                <td className="num muted">{p.position ?? '-'}</td>
                <td>{p.team}</td>
                <td className="text-right num">{p.apps}</td>
                <td className="text-right num muted">{p.minutes}</td>
                <td className="text-right num">{p.goals}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted py-2">Enginn leikmaður fannst.</td></tr>}
          </tbody>
        </table>
        {rows.length > shown.length && (
          <button className={styles.more} onClick={() => setAll(true)}>Sýna alla {rows.length}</button>
        )}
      </div>

      <p className="text-[11px] muted mt-2">
        Einkunnin er metin út frá {FIFA.matches} leikskýrslum KSÍ (byrjunarlið, skiptingar, mörk og spjöld), styrk liðs (Elo) og
        SofaScore-einkunnum ({date(FIFA.sofascoreSnapshot)}). SofaScore birtir aðeins 150 hæstu einkunnirnar (lægsta {FIFA.line.toFixed(2)}),
        svo líkanið lærir bæði af þeim sem eru á listanum og af því að hinir eru undir línunni. Í krossprófun spáir það hverjir komast á listann
        rétt í {Math.round(cv.auc * 100)}% tilvika. Sá besti fær 94 og hver 0,1 í SofaScore-einkunn neðar kostar 2 stig.
        ° = án SofaScore-einkunnar, eingöngu líkan. Staða og nafn frá Transfermarkt. Uppfært {date(FIFA.updated)}.
      </p>
    </section>
  )
}
