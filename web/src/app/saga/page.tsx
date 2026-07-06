import { teams, alltime, champions } from '@/lib/queries'

export const revalidate = 3600

export default async function SagaPage() {
  let names = new Map<number, string>()
  let rows: Awaited<ReturnType<typeof alltime>> = []
  let champs = new Map<number, number>()
  try {
    ;[names, rows, champs] = await Promise.all([teams(), alltime(), champions()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!rows.length) return <p className="muted">Reiknast eftir næstu innhleðslu.</p>
  const nm = (id: number) => names.get(id) ?? `#${id}`
  const titles = new Map<number, number>()
  for (const teamId of champs.values()) titles.set(teamId, (titles.get(teamId) ?? 0) + 1)
  return (
    <div>
      <h1 className="text-xl font-bold mb-1">All-time tafla efstu deildar frá 1912</h1>
      <p className="text-sm muted mb-4">
        Byggt á opinberum stöðutöflum KSÍ 1912–1984 og öllum leikjaúrslitum frá 1985. Stig reiknuð samræmt með 3 fyrir sigur öll tímabil. Töflur vantar hjá KSÍ fyrir 1913, 1914, 1923, 1949 og 1981 — þau tímabil telja í titlum en ekki í leikjatölum.
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
                <td className="text-right num font-semibold" style={{ color: 'var(--accent)' }}>{titles.get(r.teamId) ?? ''}</td>
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
