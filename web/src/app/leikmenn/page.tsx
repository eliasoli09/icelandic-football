import { playerEloTable, scorerSim, sofascorePlayers } from '@/lib/queries'

export const revalidate = 300

type EloRow = Awaited<ReturnType<typeof playerEloTable>>[number]
type SofaRow = Awaited<ReturnType<typeof sofascorePlayers>>[number]

export default async function LeikmennPage() {
  let elo: EloRow[] = []
  let goals: Awaited<ReturnType<typeof scorerSim>> = []
  let assists: Awaited<ReturnType<typeof scorerSim>> = []
  let sofa: SofaRow[] = []
  try {
    ;[elo, goals, assists, sofa] = await Promise.all([
      playerEloTable(200), scorerSim('goals'), scorerSim('assists'), sofascorePlayers(),
    ])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  const sofaByName = new Map(sofa.map((p) => [p.name, p]))
  const besta = elo.filter((p) => p.league === 'besta').slice(0, 30)
  const lengju = elo.filter((p) => p.league === 'lengjudeild').slice(0, 15)
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h1 className="text-xl font-bold mb-4">Elo-stig leikmanna — Besta deildin</h1>
        <EloTable rows={besta} sofaByName={sofaByName} showSofa />
        <p className="text-[11px] muted mt-2 mb-8">
          Byggt á atburðum KSÍ (mörk, spjöld, skiptingar) + úrslitum liðs. KSÍ birtir ekki byrjunarlið,
          svo stigin ná yfir leikmenn sem koma við sögu í atburðum. SofaScore-einkunn er stök mynd af tímabilinu.
        </p>
        <h2 className="text-lg font-bold mb-4">Elo-stig leikmanna — Lengjudeildin</h2>
        <EloTable rows={lengju} sofaByName={sofaByName} />
        <p className="text-[11px] muted mt-2">
          Sér tafla: mörk og úrslit í Lengjudeildinni vega 60% á móti Bestu deildinni og
          byrjunarstigin eru lægri (1400 á móti 1500) — leikmenn taka stigin með sér upp um deild.
        </p>
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

function EloTable({
  rows,
  sofaByName,
  showSofa = false,
}: {
  rows: EloRow[]
  sofaByName: Map<string, SofaRow>
  showSofa?: boolean
}) {
  return (
    <div className="card p-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="muted text-xs text-left">
            <th className="py-1 font-medium">#</th>
            <th className="font-medium">Leikmaður</th>
            <th className="text-right font-medium">Elo</th>
            <th className="text-right font-medium">Atburðaleikir</th>
            {showSofa && <th className="text-right font-medium">SofaScore</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="py-1.5 muted num">{i + 1}</td>
              <td className="font-medium">{p.name}</td>
              <td className="text-right num font-semibold">{Math.round(p.elo)}</td>
              <td className="text-right num muted">{p.apps}</td>
              {showSofa && (
                <td className="text-right num">{sofaByName.get(p.name)?.rating ?? '—'}</td>
              )}
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={5} className="muted text-sm py-2">Engin gögn enn.</td></tr>
          )}
        </tbody>
      </table>
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
