import { EloChart, type EloSeriesPoint } from '@/components/EloChart'
import { ShareButton } from '@/components/ShareButton'
import { teams, eloHistory, teamInfo } from '@/lib/queries'
import { TeamBadge } from '@/components/TeamBadge'
import { displayColor } from '@/lib/teamColors'
import { Reveal, CountUp } from '@/components/motion'

export const revalidate = 300

export const metadata = {
  openGraph: { images: ['/api/og/elo'] },
  twitter: { card: 'summary_large_image', images: ['/api/og/elo'] },
}

export default async function EloPage() {
  let names = new Map<number, string>()
  let infos: Awaited<ReturnType<typeof teamInfo>> = new Map()
  let history: Awaited<ReturnType<typeof eloHistory>> = []
  try {
    ;[names, infos, history] = await Promise.all([teams(), teamInfo(), eloHistory()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!history.length) return <p className="muted">Elo reiknast eftir fyrstu innhleðslu.</p>

  const nm = (id: number) => names.get(id) ?? `#${id}`
  const latest = new Map<number, { elo: number; deltas: number[] }>()
  for (const r of history) {
    const prev = latest.get(r.team_id)
    const delta = prev ? r.elo_after - prev.elo : 0
    latest.set(r.team_id, {
      elo: r.elo_after,
      deltas: [...(prev?.deltas ?? []), delta].slice(-5),
    })
  }
  const table = [...latest]
    .map(([id, v]) => ({ id, name: nm(id), elo: v.elo, change: v.deltas.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.elo - a.elo)

  // chart series: one point per match record, keyed by team name
  const points: EloSeriesPoint[] = []
  const counter = new Map<number, number>()
  for (const r of history) {
    if (!r.date || r.date < '2019') continue // chart shows 2019+; table covers all-time
    const idx = (counter.get(r.team_id) ?? 0) + 1
    counter.set(r.team_id, idx)
    points.push({ idx: points.length, date: r.date, [nm(r.team_id)]: r.elo_after })
  }
  const top12 = table.slice(0, 12).map((t) => t.name)

  return (
    <div className="grid gap-8">
      <section>
        <div className="flex items-center justify-between mb-5">
          <h1 className="display text-2xl font-black">Elo-stig liða</h1>
          <ShareButton title="Elo-stig liða" text="Elo-stig íslensku liðanna:" path="/elo" imagePath="/api/og/elo" />
        </div>
        <div className="card p-4 mb-8">
          <div className="table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="muted text-xs text-left">
                <th className="py-2 font-semibold">#</th>
                <th className="font-semibold">Lið</th>
                <th className="text-right font-semibold">Elo</th>
                <th className="text-right font-semibold pr-1">± síðustu 5</th>
              </tr>
            </thead>
            <tbody>
              {table.map((t, i) => (
                <tr key={t.id} className="trow">
                  <td className={`py-2 num w-10 ${i < 3 ? 'rank-top stat' : 'muted'}`}>{i + 1}</td>
                  <td className="font-semibold">
                    <TeamBadge info={[...infos.values()].find((x) => x.name === t.name)} /> {t.name}
                  </td>
                  <td className="text-right stat text-base">
                    <CountUp value={Math.round(t.elo)} />
                  </td>
                  <td className="text-right pr-1">
                    <span className={`pill ${t.change > 1 ? 'pill-win' : t.change < -1 ? 'pill-loss' : 'pill-flat'}`}>
                      <span aria-hidden>{t.change > 1 ? '▲' : t.change < -1 ? '▼' : '–'}</span>
                      {t.change >= 0 ? '+' : ''}{Math.round(t.change)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="text-[11px] muted mt-3">
            Elo nær yfir síðustu 26 ár — efstu deild frá 2000 og Lengjudeildina frá 2019. Stig fylgja liðum milli deilda og tímabila; byrjunarstig 1500 (efsta deild) og 1400 (Lengjudeildin). Grafið sýnir þróunina frá 2019.
          </p>
        </div>
        <h2 className="display text-lg font-extrabold mb-4">Þróun Elo-stiga</h2>
        <div className="card p-4 sm:p-5">
          <EloChart
            data={points}
            teamNames={table.map((t) => t.name)}
            defaultSelected={top12.slice(0, 4)}
            teamColors={Object.fromEntries([...infos.values()].map((i) => [i.name, displayColor(i)]))}
          />
        </div>
      </section>
    </div>
  )
}
