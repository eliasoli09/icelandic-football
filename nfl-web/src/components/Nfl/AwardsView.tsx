'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { NflLogo } from './NflLogo'
import { PlayerHead } from './PlayerHead'
import { PlayersSwitch } from './PlayersSwitch'
import { AWARD_LABEL, type Award, type AwardWinner } from '@/lib/nfl/awards'
import { barColor } from '@/lib/nfl/format'
import { probCell } from '@/lib/nfl/bracket'
import type { NflTeam } from '@/lib/nfl/types'

export interface RaceRow { player_id: string; name: string; team: string; headshot: string | null; position: string | null; p?: number; stats: [string, string][] }
export interface AwardPanel {
  award: Award
  mode: 'odds' | 'leaders' | 'history'
  race: RaceRow[]
  mainLabel: string
  history: AwardWinner[]
  test: { hit: number; base: number }
}

const pct = (x: number) => `${Math.round(x * 100)}%`

export function AwardsView({ season, week, firstWeek, panels, teams }: { season: number; week: number; firstWeek: number; panels: AwardPanel[]; teams: NflTeam[] }) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const [award, setAward] = useState<Award>('MVP')
  // ?verdlaun=OROY opens one award directly
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('verdlaun') as Award | null
    if (v && panels.some((p) => p.award === v)) setAward(v)
  }, [panels])
  const pick = (a: Award) => {
    setAward(a)
    const url = new URL(window.location.href)
    url.searchParams.set('verdlaun', a)
    window.history.replaceState(null, '', url)
  }
  const panel = panels.find((p) => p.award === award)!

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PlayersSwitch active="verdlaun" />
        <p className="text-sm muted">Tímabilið {season}, eftir viku {week}</p>
      </div>

      <div role="tablist" aria-label="Verðlaun" className="flex flex-wrap gap-1.5">
        {panels.map((p) => (
          <button key={p.award} role="tab" aria-selected={award === p.award} onClick={() => pick(p.award)}
            className="rounded-full border px-3 min-h-[36px] text-sm font-semibold"
            style={{ borderColor: award === p.award ? 'var(--accent)' : 'var(--border)', background: award === p.award ? 'var(--accent)' : 'var(--surface)', color: award === p.award ? 'var(--accent-ink)' : 'var(--text-2)' }}>
            {p.award}
          </button>
        ))}
      </div>

      <div className="card p-4 sm:p-5 grid gap-4 grid-cols-[minmax(0,1fr)]">
        <div>
          <h2 className="display text-xl font-extrabold">{AWARD_LABEL[award]} <span className="muted text-base font-semibold">({award})</span></h2>
          <p className="text-xs muted mt-1">
            {panel.mode === 'odds' && `Líkur úr líkani sem var prófað á tímabilunum 2015-2025: efsti maður þess vann í ${pct(panel.test.hit)} tilvika, en sá sem leiddi í aðaltölunni aðeins í ${pct(panel.test.base)}.`}
            {panel.mode === 'leaders' && `Hér eru engar líkur. Líkan sem við prófuðum á 2015-2025 var ekki marktækt betra en að veðja á þann sem leiðir í ${panel.mainLabel}, svo listinn er einfaldlega raðaður eftir henni.`}
            {panel.mode === 'history' && 'Endurkoma ársins ræðst af sögu leikmanns, meiðslum eða slöku ári, frekar en tölfræði tímabilsins. Líkanið okkar fann sigurvegarann of sjaldan til að sýna líkur, svo hér er aðeins sagan.'}
          </p>
        </div>

        {panel.mode !== 'history' && (
          week < firstWeek && panel.mode === 'odds' ? <p className="text-sm muted">Kapphlaupið hefst eftir {firstWeek}. viku.</p> :
          panel.race.length === 0 ? <p className="text-sm muted">Enginn frambjóðandi enn.</p> : (
            <div className="table-wrap">
              <table className="text-sm w-full [&_td]:px-2 [&_th]:px-2 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                <thead>
                  <tr className="muted text-xs text-left">
                    <th className="w-6">#</th>
                    <th>Leikmaður</th>
                    {panel.race[0].stats.map(([l]) => <th key={l} className="text-right">{l}</th>)}
                    {panel.mode === 'odds' && <th className="text-right">Líkur</th>}
                  </tr>
                </thead>
                <tbody>
                  {panel.race.map((r, i) => (
                    <tr key={r.player_id} className="trow">
                      <td className="num muted py-1.5">{i + 1}</td>
                      <td>
                        <Link href={`/leikmadur/${r.player_id}`} className="flex items-center gap-2">
                          <PlayerHead name={r.name} src={r.headshot} color={barColor(byAbbr.get(r.team))} size={28} />
                          <span className="font-semibold">{r.name}</span>
                          <NflLogo team={byAbbr.get(r.team)} size={14} />
                          <span className="muted text-xs hidden sm:inline">{r.position}</span>
                        </Link>
                      </td>
                      {r.stats.map(([l, v]) => <td key={l} className="text-right num">{v}</td>)}
                      {panel.mode === 'odds' && <td className="text-right num font-semibold" style={{ color: 'var(--accent)' }}>{probCell(r.p ?? 0, false)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <div className="card p-5">
        <h3 className="display text-lg font-extrabold mb-3">Sagan</h3>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {panel.history.map((h) => (
            <li key={`${h.season}-${h.name}`} className="flex items-baseline gap-3 py-0.5">
              <span className="num muted w-10">{h.season}</span>
              {h.player_id
                ? <Link href={`/leikmadur/${h.player_id}`} className="font-semibold underline decoration-dotted underline-offset-2">{h.name}</Link>
                : <span className="font-semibold">{h.name}</span>}
              <span className="muted text-xs truncate">{[h.position, h.team].filter(Boolean).join(', ')}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] muted mt-3">AP-verðlaunin. Heimild: Wikipedia. Tengt við leikmannasíður frá 1999, þegar tölfræðin okkar byrjar.</p>
      </div>
    </section>
  )
}
