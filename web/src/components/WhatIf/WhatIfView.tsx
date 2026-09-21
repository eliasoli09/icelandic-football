'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dices, RotateCcw, Sparkles, Trophy } from 'lucide-react'
import { simulateRest, type Pick, type WhatIfResult } from '@/lib/whatif/simulate'
import type { WhatIfData } from '@/lib/whatif/data'
import styles from './WhatIf.module.css'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des']
const dayLabel = (iso: string | null) => {
  if (!iso) return 'Óráðið'
  const d = new Date(iso)
  return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`
}
const RUNS = 5000, RUNS_LABEL = '5.000'

export function WhatIfView({ data }: { data: WhatIfData }) {
  const [picks, setPicks] = useState<Map<number, Pick>>(new Map())
  const [seed, setSeed] = useState(20260706)
  const [scoring, setScoring] = useState<number | null>(null)

  const name = useMemo(() => new Map(data.teams.map((t) => [t.id, t.name])), [data.teams])
  const teams = useMemo(() => data.teams.map(({ id, points, gf, ga, played, group }) => ({ id, points, gf, ga, played, group })), [data.teams])

  // Five thousand seasons belong in the reader's browser, not in the server's
  // response: until they have run, the page shows the site's own prediction,
  // which is what the first run lands on anyway.
  const [running, setRunning] = useState(false)
  useEffect(() => setRunning(true), [])
  const base = useMemo(() => running ? index(simulateRest(teams, data.fixtures, new Map(), { runs: RUNS, seed })) : null, [running, teams, data.fixtures, seed])
  const mine = useMemo(() => running ? index(simulateRest(teams, data.fixtures, picks, { runs: RUNS, seed })) : null, [running, teams, data.fixtures, picks, seed])

  const expectedPlace = (r: WhatIfResult) => r.posProbs.reduce((sum, p, i) => sum + p * (i + 1), 0)
  const rows: Shown[] = mine
    ? [...mine.values()]
        .sort((a, b) => expectedPlace(a) - expectedPlace(b) || b.projectedPoints - a.projectedPoints)
        .map((r) => ({ id: r.id, points: r.projectedPoints, title: r.pTitle, europe: r.pEurope, relegation: r.pRelegation }))
    : data.teams.map((t) => {
        const b = data.baseline.find((x) => x.id === t.id)
        return { id: t.id, points: b?.projPoints ?? t.points, title: b?.pTitle ?? 0, europe: b?.pEurope ?? 0, relegation: b?.pRelegation ?? 0 }
      })
  const set = (id: number, pick: Pick | null) => setPicks((old) => {
    const next = new Map(old)
    if (pick) next.set(id, pick); else next.delete(id)
    return next
  })
  const chosen = picks.size

  return (
    <div className={styles.shell}>
      <header className={styles.intro}>
        <p className={styles.kicker}><Sparkles size={13} aria-hidden /> ÞÍN SPÁ</p>
        <h1>Hvað ef þú réðir úrslitunum?</h1>
        <p className={styles.subtitle}>
          Veldu úrslit í leikjunum sem eftir eru. Það sem þú sleppir hermir líkan síðunnar sjálft
          - {RUNS_LABEL} keppnistímabil í hvert sinn sem þú breytir einhverju.
          Byrjunarstaðan er nákvæmlega spá síðunnar.
        </p>
        <div className={styles.controls}>
          <span className={styles.count}>{chosen === 0 ? 'Líkanið ræður öllum leikjunum' : `Þú hefur ráðið ${chosen} af ${data.fixtures.length} leikjum`}</span>
          <button className={styles.ghost} onClick={() => setSeed((s) => s + 1)}><Dices size={14} aria-hidden /> Herma aftur</button>
          <button className={styles.ghost} onClick={() => setPicks(new Map())} disabled={chosen === 0}><RotateCcw size={14} aria-hidden /> Núllstilla</button>
        </div>
      </header>

      <div className={styles.grid}>
        <section className={styles.fixtures} aria-label="Leikir sem eftir eru">
          {group(data.fixtures).map(([day, list]) => (
            <div key={day} className={styles.day}>
              <h2>{day}</h2>
              {list.map((f) => {
                const pick = picks.get(f.id)
                return (
                  <div key={f.id} className={styles.fixture} data-picked={pick ? 'true' : 'false'}>
                    <span className={styles.side}>{name.get(f.home)}</span>
                    <div className={styles.buttons} role="group" aria-label={`Úrslit: ${name.get(f.home)} gegn ${name.get(f.away)}`}>
                      {(['home', 'draw', 'away'] as const).map((which) => (
                        <button key={which} className={styles.pickButton}
                          aria-pressed={pick?.kind === 'outcome' && pick.pick === which}
                          aria-label={`${which === 'home' ? name.get(f.home) : which === 'away' ? name.get(f.away) : 'Jafntefli'} ${which === 'draw' ? '' : 'vinnur'}`}
                          onClick={() => set(f.id, pick?.kind === 'outcome' && pick.pick === which ? null : { kind: 'outcome', pick: which })}>
                          {which === 'home' ? '1' : which === 'draw' ? 'X' : '2'}
                        </button>
                      ))}
                      <button className={styles.pickButton} aria-pressed={scoring === f.id || pick?.kind === 'score'}
                        onClick={() => setScoring(scoring === f.id ? null : f.id)} aria-label="Velja markatölu">Skor</button>
                    </div>
                    <span className={styles.side}>{name.get(f.away)}</span>
                    {(scoring === f.id || pick?.kind === 'score') && (
                      <div className={styles.score}>
                        <label className={styles.srOnly} htmlFor={`h-${f.id}`}>Mörk {name.get(f.home)}</label>
                        <input id={`h-${f.id}`} type="number" min={0} max={20} inputMode="numeric"
                          value={pick?.kind === 'score' ? pick.home : ''} placeholder="0"
                          onChange={(e) => set(f.id, score(e.target.value, pick?.kind === 'score' ? pick.away : 0, true, pick))} />
                        <span aria-hidden>-</span>
                        <label className={styles.srOnly} htmlFor={`a-${f.id}`}>Mörk {name.get(f.away)}</label>
                        <input id={`a-${f.id}`} type="number" min={0} max={20} inputMode="numeric"
                          value={pick?.kind === 'score' ? pick.away : ''} placeholder="0"
                          onChange={(e) => set(f.id, score(e.target.value, pick?.kind === 'score' ? pick.home : 0, false, pick))} />
                      </div>
                    )}
                    {!pick && <span className={styles.auto}>Líkanið</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </section>

        <section className={styles.board} aria-label="Lokastaðan eins og hún gæti orðið">
          <h2><Trophy size={15} aria-hidden /> Spáin þín</h2>
          <table className={styles.table}>
            <thead>
              <tr><th>#</th><th>Lið</th><th>Stig nú</th><th>Spáð</th><th>Titill</th><th>Evrópa</th><th>Fall</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const team = data.teams.find((t) => t.id === r.id)!
                const before = base?.get(r.id)
                return (
                  <tr key={r.id}>
                    <td className={styles.place}>{i + 1}</td>
                    <td className={styles.name}>{team.name}{team.group === 'nedri' && <small> neðri</small>}</td>
                    <td>{team.points}</td>
                    <td className={styles.strong}>{r.points.toFixed(1)}{before && delta(r.points - before.projectedPoints, 1, styles)}</td>
                    <td>{pct(r.title)}{before && delta(100 * (r.title - before.pTitle), 0, styles)}</td>
                    <td>{pct(r.europe)}{before && delta(100 * (r.europe - before.pEurope), 0, styles)}</td>
                    <td>{pct(r.relegation)}{before && delta(100 * (r.relegation - before.pRelegation), 0, styles)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className={styles.note}>
            Grænt og rautt sýnir breytinguna frá því sem líkanið segir sjálft. Efri og neðri hluti mætast ekki aftur,
            svo neðri hlutinn kemst ekki ofar en í sjöunda sæti hvað sem þú velur.
          </p>
        </section>
      </div>
    </div>
  )
}

interface Shown { id: number; points: number; title: number; europe: number; relegation: number }
const index = (rows: WhatIfResult[]) => new Map(rows.map((r) => [r.id, r]))
const pct = (p: number) => `${Math.round(100 * p)}%`

function delta(change: number, digits: number, s: Record<string, string>) {
  if (Math.abs(change) < (digits ? 0.05 : 0.5)) return null
  return <span className={change > 0 ? s.up : s.down}>{change > 0 ? '+' : '−'}{Math.abs(change).toFixed(digits)}</span>
}

function score(raw: string, other: number, isHome: boolean, current: Pick | undefined): Pick | null {
  const n = Math.max(0, Math.min(20, Math.round(Number(raw))))
  if (raw === '' || !Number.isFinite(n)) return current?.kind === 'score' ? current : null
  return isHome ? { kind: 'score', home: n, away: other } : { kind: 'score', home: other, away: n }
}

/** The fixtures a day at a time, in the order they will be played. */
function group<T extends { date: string | null }>(fixtures: T[]): [string, T[]][] {
  const days = new Map<string, T[]>()
  for (const f of fixtures) {
    const key = dayLabel(f.date)
    days.set(key, [...(days.get(key) ?? []), f])
  }
  return [...days.entries()]
}
