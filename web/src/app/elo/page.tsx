import { EloChart, type EloSeriesPoint } from '@/components/EloChart'
import { ShareButton } from '@/components/ShareButton'
import { teams, eloHistory, teamInfo } from '@/lib/queries'
import { TeamBadge } from '@/components/TeamBadge'
import { displayColor } from '@/lib/teamColors'

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
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Elo-stig liða</h1>
          <ShareButton title="Elo-stig liða" text="Elo-stig íslensku liðanna:" path="/elo" imagePath="/api/og/elo" />
        </div>
        <div className="card p-4 mb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="muted text-xs text-left">
                <th className="py-1 font-medium">#</th>
                <th className="font-medium">Lið</th>
                <th className="text-right font-medium">Elo</th>
                <th className="text-right font-medium">± síðustu 5</th>
              </tr>
            </thead>
            <tbody>
              {table.map((t, i) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-1.5 muted num">{i + 1}</td>
                  <td className="font-medium"><TeamBadge info={[...infos.values()].find((i) => i.name === t.name)} /> {t.name}</td>
                  <td className="text-right num font-semibold">{Math.round(t.elo)}</td>
                  <td className="text-right num" style={{ color: t.change >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                    {t.change >= 0 ? '+' : ''}{Math.round(t.change)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] muted mt-2">
            Elo nær yfir efstu deild frá 1985 og báðar efstu deildir frá 2019 — stig fylgja liðum milli deilda og tímabila. Byrjunarstig: 1500 (efsta deild), 1400 (Lengjudeildin). Grafið sýnir þróunina frá 2019.
          </p>
        </div>
        <h2 className="text-lg font-bold mb-3">Þróun Elo-stiga</h2>
        <div className="card p-4">
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
