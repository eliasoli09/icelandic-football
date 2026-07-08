'use client'

import { Trophy } from 'lucide-react'
import { useLeague } from './LeagueContext'
import { LeagueSwitcher } from './LeagueSwitcher'
import { TeamBadge } from './TeamBadge'
import { FormBadges } from './FormBadges'
import { PosHeatmap } from './PosHeatmap'
import { ShareButton } from './ShareButton'
import type { DashboardBundle, DashboardTeam } from '@/lib/dashboard'
import type { League } from '@/lib/types'

export interface SimRow {
  team_id: number
  pos_probs: number[]
  p_title: number
  p_europe: number
  p_relegation: number
}

export function TaflaView({
  bundles,
  sims,
  teams,
}: {
  bundles: Record<League, DashboardBundle>
  sims: Record<League, SimRow[]>
  teams: Record<number, DashboardTeam>
}) {
  const { league } = useLeague()
  const d = bundles[league]
  const sim = sims[league]
  const nm = (id: number) => teams[id]?.name ?? `#${id}`

  const sumRange = (probs: number[], from: number, to: number) =>
    probs.slice(from, to).reduce((a, b) => a + b, 0)

  const simRows = sim
    .map((s) => ({
      team: nm(s.team_id),
      posProbs: s.pos_probs,
      pTitle: s.p_title,
      pEurope: league === 'besta' ? s.p_europe : sumRange(s.pos_probs, 0, 2),
      pRelegation: s.p_relegation,
    }))
    .sort((a, b) => b.pTitle - a.pTitle || b.pEurope - a.pEurope || a.pRelegation - b.pRelegation)

  return (
    <div key={league} className="fade-up grid gap-8">
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h1 className="display text-2xl font-black" style={{ color: 'var(--accent)' }}>
            {d.title} 2026
          </h1>
          <div className="flex items-center gap-3">
            <LeagueSwitcher size="sm" />
            <ShareButton title={`${d.title} 2026`} text={`Staðan í ${d.title}:`} path="/tafla" imagePath={league === 'besta' ? '/api/og/tafla' : undefined} />
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
                  <th className="text-right font-semibold pl-3">Form</th>
                </tr>
              </thead>
              <tbody>
                {d.standings.map((r, i) => (
                  <tr key={r.teamId} className="trow">
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
                    <td className="text-right pl-3"><FormBadges form={r.form} /></td>
                  </tr>
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
        </div>
      </section>

      <section className="min-w-0">
        <h2 className="display text-lg font-extrabold mb-4 inline-flex items-center gap-2">
          <Trophy size={16} aria-hidden style={{ color: 'var(--accent)' }} />
          Sætalíkur — 10.000 hermanir
        </h2>
        <div className="card p-4">
          {simRows.length ? (
            <>
              <PosHeatmap rows={simRows} middleLabel={league === 'besta' ? 'Evrópa' : 'Upp'} />
              <p className="text-[11px] muted mt-3">
                {league === 'besta'
                  ? 'Monte Carlo hermun á öllum eftirstandandi leikjum út frá Elo + markatölfræði. Deildarskiptingin (efri/neðri hluti) er hermd eftir 22 umferðir. Meistari = 1. sæti, Evrópa = 3 efstu (nálgun), fall = 2 neðstu.'
                  : 'Monte Carlo hermun á öllum eftirstandandi leikjum út frá Elo + markatölfræði. Meistari = 1. sæti, upp = 2 efstu (beint), fall = 2 neðstu. Umspilssæti sjást í sætadreifingunni (3.–4. sæti).'}
              </p>
            </>
          ) : (
            <p className="muted text-sm">Hermun keyrist eftir næstu innhleðslu.</p>
          )}
        </div>
      </section>
    </div>
  )
}
