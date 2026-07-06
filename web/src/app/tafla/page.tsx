import { PosHeatmap } from '@/components/PosHeatmap'
import { ShareButton } from '@/components/ShareButton'
import { FormBadges } from '@/components/FormBadges'
import { teams, standings, seasonSim, teamInfo } from '@/lib/queries'
import { TeamBadge } from '@/components/TeamBadge'

export const revalidate = 300

export const metadata = {
  openGraph: { images: ['/api/og/tafla'] },
  twitter: { card: 'summary_large_image', images: ['/api/og/tafla'] },
}

export default async function TaflaPage() {
  let names = new Map<number, string>()
  let infos: Awaited<ReturnType<typeof teamInfo>> = new Map()
  let table: Awaited<ReturnType<typeof standings>> = []
  let sim: Awaited<ReturnType<typeof seasonSim>> = []
  try {
    ;[names, infos, table, sim] = await Promise.all([teams(), teamInfo(), standings(), seasonSim()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  const nm = (id: number) => names.get(id) ?? `#${id}`
  const simRows = sim
    .map((s) => ({
      team: nm(s.team_id),
      posProbs: s.pos_probs as number[],
      pTitle: s.p_title,
      pEurope: s.p_europe,
      pRelegation: s.p_relegation,
    }))
    .sort((a, b) => b.pTitle - a.pTitle || b.pEurope - a.pEurope || a.pRelegation - b.pRelegation)

  return (
    <div className="grid gap-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Besta deild karla 2026</h1>
          <ShareButton title="Besta deild karla 2026" text="Staðan og meistaralíkur í Bestu deildinni:" path="/tafla" imagePath="/api/og/tafla" />
        </div>
        <div className="card p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="muted text-xs text-left">
                <th className="py-1 font-medium">#</th>
                <th className="font-medium">Lið</th>
                <th className="text-right font-medium">L</th>
                <th className="text-right font-medium">U</th>
                <th className="text-right font-medium">J</th>
                <th className="text-right font-medium">T</th>
                <th className="text-right font-medium">Mörk</th>
                <th className="text-right font-medium">+/−</th>
                <th className="text-right font-medium">Stig</th>
                <th className="text-right font-medium pl-3">Form</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r, i) => (
                <tr key={r.teamId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-1.5 muted num">{i + 1}</td>
                  <td className="font-medium whitespace-nowrap"><TeamBadge info={infos.get(r.teamId)} /> {nm(r.teamId)}</td>
                  <td className="text-right num">{r.played}</td>
                  <td className="text-right num">{r.won}</td>
                  <td className="text-right num">{r.drawn}</td>
                  <td className="text-right num">{r.lost}</td>
                  <td className="text-right num whitespace-nowrap">{r.gf}–{r.ga}</td>
                  <td className="text-right num">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
                  <td className="text-right num font-bold">{r.points}</td>
                  <td className="text-right pl-3"><FormBadges form={r.form} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="text-lg font-bold mb-3">Sætalíkur — 10.000 hermanir</h2>
        <div className="card p-4">
          {simRows.length ? (
            <>
              <PosHeatmap rows={simRows} />
              <p className="text-[11px] muted mt-3">
                Monte Carlo hermun á öllum eftirstandandi leikjum út frá Elo + markatölfræði.
                Deildarskipting (efri/neðri hluti) er hermd eftir 22 umferðir. Evrópa = 3 efstu sæti (nálgun).
              </p>
            </>
          ) : (
            <p className="muted text-sm">Hermun keyrist eftir fyrstu innhleðslu.</p>
          )}
        </div>
      </section>
    </div>
  )
}
