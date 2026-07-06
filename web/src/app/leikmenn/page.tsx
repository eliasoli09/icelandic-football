import { playerEloTable, scorerSim, sofascorePlayers } from '@/lib/queries'
import { computeComposite, type CompositeBreakdown } from '@/lib/playerComposite'

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
  const composite = computeComposite(sofa)
  const withTotal = (p: EloRow) => ({
    ...p,
    framlag: composite.get(p.name) ?? null,
    heild: p.elo + (composite.get(p.name)?.total ?? 0),
  })
  const besta = elo
    .filter((p) => p.league === 'besta')
    .map(withTotal)
    .sort((a, b) => b.heild - a.heild)
    .slice(0, 30)
  const lengju = elo.filter((p) => p.league === 'lengjudeild').slice(0, 15)
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h1 className="text-xl font-bold mb-4">Leikmannaeinkunn — Besta deildin</h1>
        <BestaTable rows={besta} sofaByName={sofaByName} />
        <p className="text-[11px] muted mt-2 mb-8">
          Heild = Elo (atburðir KSÍ: mörk, spjöld, úrslit liðs, leik fyrir leik) + framlag
          (SofaScore-tímabilsgögn: stórsénsar skapaðir, lykilsendingar, stoðsendingar, rispur,
          tæklingar, hindranir, brottspyrnur, einvígi, sendingahlutfall — og markvarsla hjá markvörðum).
          Framlagið er z-skorað miðað við hina leikmennina og fest við ±80 Elo-stig.
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

function BestaTable({
  rows,
  sofaByName,
}: {
  rows: (EloRow & { framlag: CompositeBreakdown | null; heild: number })[]
  sofaByName: Map<string, SofaRow>
}) {
  return (
    <div className="card p-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="muted text-xs text-left">
            <th className="py-1 font-medium">#</th>
            <th className="font-medium">Leikmaður</th>
            <th className="text-right font-medium">Elo</th>
            <th className="text-right font-medium" title="Sköpun + vörn + sendingar + markvarsla úr SofaScore">Framlag</th>
            <th className="text-right font-medium">Heild</th>
            <th className="text-right font-medium">SofaScore</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="py-1.5 muted num">{i + 1}</td>
              <td className="font-medium">{p.name}</td>
              <td className="text-right num">{Math.round(p.elo)}</td>
              <td
                className="text-right num"
                title={p.framlag
                  ? `Sköpun ${p.framlag.creation} · Vörn ${p.framlag.defense} · Sendingar ${p.framlag.passing}` +
                    (p.framlag.goalkeeping ? ` · Markvarsla ${p.framlag.goalkeeping}` : '')
                  : 'Utan topp-150 SofaScore listans'}
                style={{ color: (p.framlag?.total ?? 0) >= 0 ? 'var(--win)' : 'var(--loss)' }}
              >
                {p.framlag ? (p.framlag.total >= 0 ? '+' : '') + p.framlag.total : '—'}
              </td>
              <td className="text-right num font-bold">{Math.round(p.heild)}</td>
              <td className="text-right num muted">{sofaByName.get(p.name)?.rating ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
