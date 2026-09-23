'use client'

import { Fragment } from 'react'
import { Trophy } from 'lucide-react'
import { useLeague } from './LeagueContext'
import { LeagueSwitcher } from './LeagueSwitcher'
import { TeamBadge } from './TeamBadge'
import { FormBadges } from './FormBadges'
import { PosHeatmap } from './PosHeatmap'
import { ShareButton } from './ShareButton'
import { ScorerRace, type RaceRow } from './ScorerRace'
import { LEAGUES } from '@/lib/leagues'
import type { DashboardBundle, DashboardTeam } from '@/lib/dashboard'
import type { League } from '@/lib/types'

export interface SimRow {
  team_id: number
  pos_probs: number[]
  p_title: number
  p_europe: number
  p_relegation: number
  proj_points: number | null
  proj_low: number | null
  proj_high: number | null
}

export function TaflaView({
  bundles,
  sims,
  scorers,
  teams,
}: {
  bundles: Partial<Record<League, DashboardBundle>>
  sims: Partial<Record<League, SimRow[]>>
  scorers: Partial<Record<League, RaceRow[]>>
  teams: Record<number, DashboardTeam>
}) {
  const { league, current } = useLeague()
  const d = bundles[league]
  const sim = sims[league] ?? []
  const nm = (id: number) => teams[id]?.name ?? `#${id}`
  if (!d) return <p className="muted">Þessi deild er ekki komin inn enn.</p>

  const sumRange = (probs: number[], from: number, to: number) =>
    probs.slice(from, to).reduce((a, b) => a + b, 0)

  const cfg = LEAGUES[league]
  const projOf = new Map(sim.map((s) => [s.team_id, s]))
  const simRows = sim
    .map((s) => ({
      team: nm(s.team_id),
      posProbs: s.pos_probs,
      pTitle: s.p_title,
      pEurope: s.p_europe,
      pRelegation: s.p_relegation,
    }))
    .sort((a, b) => b.pTitle - a.pTitle || b.pEurope - a.pEurope || a.pRelegation - b.pRelegation)

  return (
    <div key={league} className="fade-up grid gap-8">
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h1 className="display text-2xl font-black" style={{ color: 'var(--accent)' }}>
            {current?.name ?? d.title} {current?.current_season ?? 2026}
          </h1>
          <div className="flex items-center gap-3">
            <LeagueSwitcher size="sm" />
            <ShareButton title={`${current?.name ?? d.title} ${current?.current_season ?? 2026}`} text={`Staðan í ${current?.name ?? d.title}:`} path="/tafla" imagePath={league === 'besta' ? '/api/og/tafla' : undefined} />
          </div>
        </div>
        <div className="card p-4">
          <div className="table-wrap">
            <table className="text-sm [&_td]:px-1.5 [&_th]:px-1.5">
              <thead>
                <tr className="muted text-xs text-left">
                  <th className="py-2 font-semibold w-8">#</th>
                  <th className="font-semibold">Lið</th>
                  <th className="text-right font-semibold">L</th>
                  <th className="text-right font-semibold">U</th>
                  <th className="text-right font-semibold">J</th>
                  <th className="text-right font-semibold">T</th>
                  <th className="text-right font-semibold">Mörk</th>
                  <th className="text-right font-semibold">+/−</th>
                  <th className="text-right font-semibold">Stig</th>
                  <th className="text-right font-semibold whitespace-nowrap">Spá</th>
                  <th className="text-right font-semibold pl-3">Form</th>
                </tr>
              </thead>
              <tbody>
                {d.standings.map((r, i) => (
                  <Fragment key={r.teamId}>
                    {r.group && r.group !== d.standings[i - 1]?.group && (
                      <tr>
                        <td colSpan={11} className={i === 0 ? 'pb-1' : 'pt-5 pb-1'}>
                          <span
                            className="display text-xs font-extrabold uppercase tracking-wider"
                            style={{ color: 'var(--accent)' }}
                          >
                            {r.group === 'efri' ? 'Efri hluti' : 'Neðri hluti'}
                          </span>
                          <span className="text-[10px] muted ml-2">
                            {r.group === 'efri'
                              ? 'titill og Evrópusæti'
                              : 'fallbarátta'}
                          </span>
                        </td>
                      </tr>
                    )}
                  <tr className="trow">
                    <td className={`py-2 pl-2 num muted zone ${r.zone ? `zone-${r.zone}` : ''}`}>{i + 1}</td>
                    <td className="font-semibold whitespace-nowrap">
                      <TeamBadge info={teams[r.teamId]} /> {nm(r.teamId)}
                    </td>
                    <td className="text-right num">{r.played}</td>
                    <td className="text-right num">{r.won}</td>
                    <td className="text-right num">{r.drawn}</td>
                    <td className="text-right num">{r.lost}</td>
                    <td className="text-right num whitespace-nowrap">{r.gf}–{r.ga}</td>
                    <td className="text-right num">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
                    <td className="text-right stat text-base">{r.points}</td>
                    <td className="text-right num whitespace-nowrap">
                      {(() => {
                        const s = projOf.get(r.teamId)
                        if (s?.proj_points == null) return <span className="muted">-</span>
                        return (
                          <span
                            className="muted"
                            title={
                              s.proj_low != null && s.proj_high != null
                                ? `Líklegt bil: ${s.proj_low}–${s.proj_high} stig (8 af 10 hermunum)`
                                : undefined
                            }
                          >
                            {Math.round(s.proj_points)}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="text-right pl-3"><FormBadges form={r.form} /></td>
                  </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {d.zoneLegend.map((z) => (
              <p key={z.label} className="text-[10px] muted inline-flex items-center gap-2">
                <span className={`zone ${z.cls} inline-block w-3 h-3`} style={{ position: 'relative' }} aria-hidden />
                {z.label}
              </p>
            ))}
          </div>
          <p className="text-[10px] muted mt-2 leading-relaxed">
            {d.standings.some((r) => r.group) && (
              <>
                Deildin skiptist í efri og neðri hluta eftir 22 umferðir. Stig færast með, en
                hóparnir mætast ekki aftur - neðri hlutinn kemst því ekki ofar en í 7. sæti.
                <br />
              </>
            )}
            <strong>Spá</strong> = líkleg lokastig í lok tímabils (meðaltal 10.000 hermana).
          </p>
        </div>
      </section>

      <section className="min-w-0">
        <h2 className="display text-lg font-extrabold mb-4 inline-flex items-center gap-2">
          <Trophy size={16} aria-hidden style={{ color: 'var(--accent)' }} />
          Sætalíkur - 10.000 hermanir
        </h2>
        <div className="card p-4">
          {simRows.length ? (
            <>
              <PosHeatmap rows={simRows} middleLabel={cfg?.promotion ? null : 'Evrópa'} />
              <p className="text-[11px] muted mt-3">
                Monte Carlo hermun á öllum eftirstandandi leikjum út frá Elo og markatölfræði.{' '}
                {d.standings.some((r) => r.group)
                  ? 'Efri og neðri hluti eru hermdir hvor í sínu lagi - hóparnir mætast ekki aftur, svo neðri hlutinn getur ekki endað ofar en í 7. sæti. '
                  : ''}
                Meistari = 1. sæti{cfg && !cfg.promotion ? `, Evrópa = ${cfg.europeSlots} efstu` : ''}
                {cfg ? `, fall = ${cfg.relegationSlots} neðstu` : ''}.
                {league !== 'besta' && league !== 'lengjudeild'
                  ? ' Hlutföll liðanna eru dregin upp á nýtt í hverri hermun, svo fá spiluð umferðir gefa breiðara bil.'
                  : ''}
              </p>
            </>
          ) : (
            <p className="muted text-sm">Hermun keyrist eftir næstu innhleðslu.</p>
          )}
        </div>
      </section>

      {(scorers[league]?.length ?? 0) > 0 && (
        <section className="min-w-0">
          <h2 className="display text-lg font-extrabold mb-4 inline-flex items-center gap-2">
            <Trophy size={16} aria-hidden style={{ color: 'var(--accent)' }} />
            Markakóngaspá
          </h2>
          <div className="card p-4">
            <ScorerRace rows={scorers[league]!} />
            <p className="text-[11px] muted mt-3">
              Líkur á að standa efstur í lok tímabils, úr 10.000 hermunum: markatíðni það sem af er,
              yfir þá leiki sem liðið á eftir.
              {league === 'premier' ? ' Mörkin koma frá Fantasy Premier League, opnum leik deildarinnar sjálfrar.' : ''}
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
