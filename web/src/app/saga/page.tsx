import { teams, alltime } from '@/lib/queries'

export const revalidate = 3600

export default async function SagaPage() {
  let names = new Map<number, string>()
  let rows: Awaited<ReturnType<typeof alltime>> = []
  try {
    ;[names, rows] = await Promise.all([teams(), alltime()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!rows.length) return <p className="muted">Reiknast eftir næstu innhleðslu.</p>
  const nm = (id: number) => names.get(id) ?? `#${id}`
  return (
    <div>
      <h1 className="text-xl font-bold mb-1">All-time tafla efstu deildar (1985–)</h1>
      <p className="text-sm muted mb-4">
        Öll tímabil sem KSÍ á fullar markatölur fyrir (1985 og áfram), deildarleikir og úrslitaleikir. Stig reiknuð samræmt með 3 fyrir sigur.
      </p>
      <div className="card p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="muted text-xs text-left">
              <th className="py-1 font-medium">#</th>
              <th className="font-medium">Lið</th>
              <th className="text-right font-medium">Tímabil</th>
              <th className="text-right font-medium">L</th>
              <th className="text-right font-medium">U</th>
              <th className="text-right font-medium">J</th>
              <th className="text-right font-medium">T</th>
              <th className="text-right font-medium">Mörk</th>
              <th className="text-right font-medium">+/−</th>
              <th className="text-right font-medium">Stig</th>
              <th className="text-right font-medium pl-2">Fyrst–síðast</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.teamId} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="py-1.5 muted num">{i + 1}</td>
                <td className="font-medium whitespace-nowrap">{nm(r.teamId)}</td>
                <td className="text-right num">{r.seasons}</td>
                <td className="text-right num">{r.played}</td>
                <td className="text-right num">{r.won}</td>
                <td className="text-right num">{r.drawn}</td>
                <td className="text-right num">{r.lost}</td>
                <td className="text-right num whitespace-nowrap">{r.gf}–{r.ga}</td>
                <td className="text-right num">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
                <td className="text-right num font-bold">{r.points3}</td>
                <td className="text-right num muted pl-2 whitespace-nowrap">{r.firstSeason}–{r.lastSeason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
