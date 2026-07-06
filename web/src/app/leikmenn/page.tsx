import { playerEloTable, scorerSim, sofascorePlayers } from '@/lib/queries'

export const revalidate = 300

export default async function LeikmennPage() {
  let elo: Awaited<ReturnType<typeof playerEloTable>> = []
  let goals: Awaited<ReturnType<typeof scorerSim>> = []
  let assists: Awaited<ReturnType<typeof scorerSim>> = []
  let sofa: Awaited<ReturnType<typeof sofascorePlayers>> = []
  try {
    ;[elo, goals, assists, sofa] = await Promise.all([
      playerEloTable(40), scorerSim('goals'), scorerSim('assists'), sofascorePlayers(),
    ])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  const sofaByName = new Map(sofa.map((p) => [p.name, p]))
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h1 className="text-xl font-bold mb-4">Elo-stig leikmanna</h1>
        <div className="card p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="muted text-xs text-left">
                <th className="py-1 font-medium">#</th>
                <th className="font-medium">Leikmaður</th>
                <th className="text-right font-medium">Elo</th>
                <th className="text-right font-medium">Atburðaleikir</th>
                <th className="text-right font-medium">SofaScore</th>
              </tr>
            </thead>
            <tbody>
              {elo.map((p, i) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-1.5 muted num">{i + 1}</td>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-right num font-semibold">{Math.round(p.elo)}</td>
                  <td className="text-right num muted">{p.apps}</td>
                  <td className="text-right num">{sofaByName.get(p.name)?.rating ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] muted mt-2">
            Byggt á atburðum KSÍ (mörk, spjöld, skiptingar) + úrslitum liðs. KSÍ birtir ekki byrjunarlið,
            svo stigin ná yfir leikmenn sem koma við sögu í atburðum. SofaScore-einkunn er stök mynd af tímabilinu.
          </p>
        </div>
      </section>
      <section className="grid gap-8 content-start">
        <div>
          <h2 className="text-xl font-bold mb-4">Markakóngar</h2>
          <RaceTable rows={goals} unit="mörk" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-4">Stoðsendingakóngar</h2>
          <RaceTable rows={assists} unit="stoðsendingar" />
          <p className="text-[11px] muted mt-2">Stoðsendingar: SofaScore-innslag (uppfærist þegar nýtt skjal er hlaðið inn).</p>
        </div>
      </section>
    </div>
  )
}

function RaceTable({
  rows,
  unit,
}: {
  rows: { name: string; current: number; projected: number; p_win: number }[]
  unit: string
}) {
  return (
    <div className="card p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="muted text-xs text-left">
            <th className="py-1 font-medium">Leikmaður</th>
            <th className="text-right font-medium">Núna</th>
            <th className="text-right font-medium">Spáð alls</th>
            <th className="text-right font-medium">Vinnur %</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((r) => (
            <tr key={r.name} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="py-1.5 font-medium">{r.name}</td>
              <td className="text-right num">{r.current}</td>
              <td className="text-right num muted">{r.projected.toFixed(1)}</td>
              <td className="text-right num font-semibold" style={{ color: 'var(--accent)' }}>
                {Math.round(r.p_win * 100)}%
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td className="muted text-sm py-2" colSpan={4}>Reiknast eftir innhleðslu ({unit}).</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
