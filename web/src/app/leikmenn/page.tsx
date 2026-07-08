import { playerEloTable, scorerSim, sofascorePlayers, editorialBonus } from '@/lib/queries'
import { computeComposite, type CompositeBreakdown } from '@/lib/playerComposite'
import { inferPositions, normalizeName, POSITION_LABELS, type Position } from '@/lib/positions'

export const revalidate = 300

type EloRow = Awaited<ReturnType<typeof playerEloTable>>[number]
type SofaRow = Awaited<ReturnType<typeof sofascorePlayers>>[number]

export default async function LeikmennPage() {
  let elo: EloRow[] = []
  let goals: Awaited<ReturnType<typeof scorerSim>> = []
  let assists: Awaited<ReturnType<typeof scorerSim>> = []
  let goalsLengju: Awaited<ReturnType<typeof scorerSim>> = []
  let sofa: SofaRow[] = []
  let editorial: Record<string, { bonus: number; detail: string }> = {}
  try {
    ;[elo, goals, assists, goalsLengju, sofa, editorial] = await Promise.all([
      playerEloTable(200), scorerSim('goals'), scorerSim('assists'), scorerSim('goals', 'lengjudeild'), sofascorePlayers(), editorialBonus(),
    ])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  const sofaByName = new Map(sofa.map((p) => [normalizeName(p.name), p]))
  const composite = computeComposite(sofa)
  const compositeByNorm = new Map(
    [...composite].map(([name, v]) => [normalizeName(name), v]),
  )
  const editorialByNorm = new Map(
    Object.entries(editorial).map(([name, v]) => [normalizeName(name), v]),
  )
  const withTotal = (p: EloRow) => {
    const norm = normalizeName(p.name)
    const vidurkenning = editorialByNorm.get(norm) ?? null
    return {
      ...p,
      framlag: compositeByNorm.get(norm) ?? null,
      vidurkenning,
      heild: p.elo + (compositeByNorm.get(norm)?.total ?? 0) + (vidurkenning?.bonus ?? 0),
    }
  }
  // position lists: SofaScore pool + Elo matched by normalized name
  const positions = inferPositions(sofa)
  const eloByNorm = new Map(
    elo.filter((p) => p.league === 'besta').map((p) => [normalizeName(p.name), p.elo]),
  )
  const positionLists = (['GK', 'DF', 'MF', 'FW'] as Position[]).map((posKey) => ({
    pos: posKey,
    label: POSITION_LABELS[posKey],
    rows: sofa
      .filter((p) => positions.get(p.name) === posKey)
      .map((p) => {
        const framlag = composite.get(p.name)?.total ?? 0
        const eloVal = eloByNorm.get(normalizeName(p.name)) ?? 1500
        return { name: p.name, team: p.team, rating: p.rating, heild: Math.round(eloVal + framlag) }
      })
      .sort((a, b) => b.heild - a.heild)
      .slice(0, 10),
  }))
  const besta = elo
    .filter((p) => p.league === 'besta')
    .map(withTotal)
    .sort((a, b) => b.heild - a.heild)
    .slice(0, 30)
  const lengju = elo.filter((p) => p.league === 'lengjudeild').slice(0, 15)
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h1 className="display text-2xl font-black mb-5">Leikmannaeinkunn — Besta deildin</h1>
        <BestaTable rows={besta} sofaByName={sofaByName} />
        <p className="text-[11px] muted mt-2 mb-8">
          Heild = Elo (atburðir KSÍ: mörk, spjöld, úrslit liðs, leik fyrir leik) + framlag
          (tímabilstölfræði: stórsénsar skapaðir, lykilsendingar, stoðsendingar, rispur,
          tæklingar, hindranir, brottspyrnur, einvígi, sendingahlutfall — og markvarsla hjá markvörðum; framsækni-flokkur (langsendingar, fyrirgjafir, sendingar á lokaþriðjung) kviknar sjálfkrafa fylgi þeir dálkar með í næsta tölfræðiinnslagi).
          Framlagið er z-skorað miðað við hina leikmennina og fest við ±80 Elo-stig.
          Stjörnumerkt (*) heild inniheldur viðurkenningabónus: val í lið umferðar hjá fótbolta.net gefur +6 og leikmaður umferðar +10 (hámark +40).
        </p>
        <h2 className="display text-lg font-extrabold mb-4">Elo-stig leikmanna — Lengjudeildin</h2>
        <EloTable rows={lengju} sofaByName={sofaByName} />
        <p className="text-[11px] muted mt-2">
          Sér tafla: mörk og úrslit í Lengjudeildinni vega 60% á móti Bestu deildinni og
          byrjunarstigin eru lægri (1400 á móti 1500) — leikmenn taka stigin með sér upp um deild.
        </p>
      </section>
      <section className="grid gap-8 content-start">
        <div>
          <h2 className="display text-lg font-extrabold mb-4">Topp 10 eftir stöðum</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {positionLists.map((pl) => (
              <div key={pl.pos} className="card p-4">
                <h3 className="font-bold text-sm mb-2">{pl.label}</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {pl.rows.map((r, i) => (
                      <tr key={r.name} style={i ? { borderTop: '1px solid var(--border)' } : {}}>
                        <td className="py-1 muted num w-6">{i + 1}</td>
                        <td className="font-medium truncate max-w-[160px]" title={`${r.name} · ${r.team ?? ''}`}>{r.name}</td>
                        <td className="text-right num font-semibold">{r.heild}</td>
                      </tr>
                    ))}
                    {!pl.rows.length && (
                      <tr><td className="muted text-xs py-1" colSpan={3}>Engin gögn.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <p className="text-[11px] muted mt-2">
            Staða er áætluð út frá tölfræðiprófíl (gögnin hafa ekki stöðudálk):
            markmenn af vörðum skotum, útileikmenn af varnar-/sköpunar-/sóknarhlutfalli. Talan er Heild (Elo + framlag).
          </p>
        </div>
        <div>
          <h2 className="display text-lg font-extrabold mb-4">Markakóngar</h2>
          <RaceTable rows={goals} unit="mörk" />
        </div>
        <div>
          <h2 className="display text-lg font-extrabold mb-4">Stoðsendingakóngar</h2>
          <RaceTable rows={assists} unit="stoðsendingar" />
          <p className="text-[11px] muted mt-2">Stoðsendingar: tölfræðiinnslag (uppfærist þegar nýtt skjal er hlaðið inn).</p>
        </div>
        <div>
          <h2 className="display text-lg font-extrabold mb-4">Markakóngar — Lengjudeildin</h2>
          <RaceTable rows={goalsLengju} unit="mörk" />
        </div>
      </section>
    </div>
  )
}

function BestaTable({
  rows,
  sofaByName,
}: {
  rows: (EloRow & { framlag: CompositeBreakdown | null; vidurkenning: { bonus: number; detail: string } | null; heild: number })[]
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
            <th className="text-right font-medium" title="Sköpun + vörn + sendingar + markvarsla úr tímabilstölfræði">Framlag</th>
            <th className="text-right font-medium">Heild</th>
            <th className="text-right font-medium">Einkunn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id} className="trow">
              <td className="py-1.5 muted num">{i + 1}</td>
              <td className="font-medium">{p.name}</td>
              <td className="text-right num">{Math.round(p.elo)}</td>
              <td
                className="text-right num"
                title={p.framlag
                  ? `Sköpun ${p.framlag.creation} · Vörn ${p.framlag.defense} · Sendingar ${p.framlag.passing}` +
                    (p.framlag.progression ? ` · Framsækni ${p.framlag.progression}` : '') +
                    (p.framlag.goalkeeping ? ` · Markvarsla ${p.framlag.goalkeeping}` : '')
                  : 'Utan topp-150 tölfræðilistans'}
                style={{ color: (p.framlag?.total ?? 0) >= 0 ? 'var(--win)' : 'var(--loss)' }}
              >
                {p.framlag ? (p.framlag.total >= 0 ? '+' : '') + p.framlag.total : '—'}
              </td>
              <td className="text-right stat text-base" title={p.vidurkenning ? `Viðurkenningar fótbolta.net: ${p.vidurkenning.detail}` : undefined}>
                {Math.round(p.heild)}{p.vidurkenning ? <span aria-hidden style={{ color: 'var(--accent)' }}>*</span> : ''}
              </td>
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
            {showSofa && <th className="text-right font-medium">Einkunn</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id} className="trow">
              <td className="py-1.5 muted num">{i + 1}</td>
              <td className="font-medium">{p.name}</td>
              <td className="text-right stat">{Math.round(p.elo)}</td>
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
            <tr key={r.name} className="trow">
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
