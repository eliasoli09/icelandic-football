'use client'

import { useEffect, useMemo, useState } from 'react'
import { NflLogo } from './NflLogo'
import { diffLabel, pctLabel, REASON_LABEL } from '@/lib/nfl/format'
import { pct, type Criterion, type Ranked, type Standings, type WLT } from '@/lib/nfl/standings'
import { CONFERENCES, DIVISIONS, type NflTeam } from '@/lib/nfl/types'

type View = 'ridlar' | 'deild'
const DIV_NAME = { East: 'Austur', North: 'Norður', South: 'Suður', West: 'Vestur' } as const
const rec = (r: WLT) => (r.t ? `${r.w}-${r.l}-${r.t}` : `${r.w}-${r.l}`)

export function StandingsView({ season, standings, teams }: { season: number; standings: Standings; teams: NflTeam[] }) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const [view, setView] = useState<View>('ridlar')
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('syn') === 'deild') setView('deild')
  }, [])
  const pick = (v: View) => {
    setView(v)
    const url = new URL(window.location.href)
    if (v === 'deild') url.searchParams.set('syn', 'deild'); else url.searchParams.delete('syn')
    window.history.replaceState(null, '', url)
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm muted">Deildarkeppnin {season}</p>
        <div role="tablist" className="inline-flex rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {(['ridlar', 'deild'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => pick(v)}
              className="rounded-full px-4 min-h-[36px] font-semibold"
              style={{ background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? 'var(--accent-ink)' : 'var(--text-2)' }}>
              {v === 'ridlar' ? 'Riðlar' : 'Deild'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        {CONFERENCES.map((c) => (
          <div key={c} className="grid gap-4 content-start">
            <h2 className="display text-xl font-extrabold">{c}</h2>
            {view === 'ridlar'
              ? DIVISIONS.map((d) => (
                  <Table key={d} title={`${c} ${DIV_NAME[d]}`} rows={standings.divisions[c][d]} standings={standings} byAbbr={byAbbr} />
                ))
              : <Table title={`${c}: sæti`} rows={standings.seeds[c]} standings={standings} byAbbr={byAbbr} cutAfter={7} numbered />}
          </div>
        ))}
      </div>

      <p className="text-[11px] muted mt-6 leading-relaxed max-w-2xl">
        Lið með sama sigurhlutfall eru aðgreind eins og hjá NFL: innbyrðis viðureignir, árangur í riðli (innan
        riðils), sameiginlegir mótherjar, árangur í deild og styrkur sigra. Síðustu viðmið NFL (styrkur
        leikjadagskrár, stigaröðun og hlutkesti) eru hér stigamismunur og stafróf, svo röðin getur stöku sinnum
        vikið frá opinberu stöðunni.
      </p>
    </section>
  )
}

function Table({ title, rows, standings, byAbbr, cutAfter, numbered }: {
  title: string; rows: Ranked[]; standings: Standings; byAbbr: Map<string, NflTeam>; cutAfter?: number; numbered?: boolean
}) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="table-wrap">
        <table className="text-sm w-full [&_td]:px-1.5 [&_th]:px-1.5 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead>
            <tr className="muted text-xs text-left">
              {numbered && <th className="w-6">#</th>}
              <th>Lið</th>
              <th className="text-right">S</th>
              <th className="text-right">T</th>
              <th className="text-right">J</th>
              <th className="text-right">Hlutf.</th>
              <th className="text-right hidden sm:table-cell">Skor.</th>
              <th className="text-right hidden sm:table-cell">Feng.</th>
              <th className="text-right">+/−</th>
              <th className="text-right hidden md:table-cell">Í riðli</th>
              <th className="text-right hidden md:table-cell">Runa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const r = standings.records[row.abbr]
              const team = byAbbr.get(row.abbr)
              const cut = cutAfter !== undefined && i === cutAfter
              return (
                <tr key={row.abbr} className="trow" style={cut ? { borderTop: '2px solid var(--accent)' } : undefined}>
                  {numbered && <td className="num muted">{i + 1}</td>}
                  <td className="py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <NflLogo team={team} size={20} />
                      <span className="font-semibold">{row.abbr}</span>
                      {row.reason && <span className="muted" aria-hidden>*</span>}
                    </div>
                  </td>
                  <td className="text-right num">{r.w}</td>
                  <td className="text-right num">{r.l}</td>
                  <td className="text-right num">{r.t}</td>
                  <td className="text-right num font-semibold">{pctLabel(pct(r))}</td>
                  <td className="text-right num hidden sm:table-cell">{r.pf}</td>
                  <td className="text-right num hidden sm:table-cell">{r.pa}</td>
                  <td className="text-right num">{diffLabel(r.pf - r.pa)}</td>
                  <td className="text-right num hidden md:table-cell">{rec(r.div)}</td>
                  <td className="text-right num hidden md:table-cell">{r.streak}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Reasons rows={rows} />
    </div>
  )
}

/** One line per tiebreak rule under the table, so the reasons read on a phone too. */
function Reasons({ rows }: { rows: Ranked[] }) {
  const by = new Map<Criterion, string[]>()
  for (const r of rows) if (r.reason) by.set(r.reason, [...(by.get(r.reason) ?? []), r.abbr])
  if (!by.size) return null
  return (
    <ul className="text-[11px] muted mt-2 grid gap-0.5">
      {[...by.entries()].map(([reason, abbrs]) => {
        const label = REASON_LABEL[reason]
        return <li key={reason}>* {label[0].toUpperCase() + label.slice(1)}: {abbrs.join(', ')}</li>
      })}
    </ul>
  )
}
