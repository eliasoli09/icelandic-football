import { teams, beltHistory, upcomingWithPredictions } from '@/lib/queries'

export const revalidate = 300

export default async function KastalinnPage() {
  let names = new Map<number, string>()
  let history: Awaited<ReturnType<typeof beltHistory>> = []
  let upcoming: Awaited<ReturnType<typeof upcomingWithPredictions>> = []
  try {
    ;[names, history, upcoming] = await Promise.all([
      teams(), beltHistory(), upcomingWithPredictions(60),
    ])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!history.length) return <p className="muted">Beltasagan reiknast eftir næstu innhleðslu.</p>
  const nm = (id: number) => names.get(id) ?? `#${id}`

  const last = history[history.length - 1]
  const holder = last.holder_after
  const reignStartIdx = history.findLastIndex((h) => h.taken)
  const reignStart = history[reignStartIdx]
  const defenses = history.length - 1 - reignStartIdx

  const wins = new Map<number, number>()
  const matches = new Map<number, number>()
  const reigns = new Map<number, number>()
  for (const h of history) {
    matches.set(h.holder_before, (matches.get(h.holder_before) ?? 0) + 1)
    matches.set(h.challenger, (matches.get(h.challenger) ?? 0) + 1)
    if (h.taken) reigns.set(h.holder_after, (reigns.get(h.holder_after) ?? 0) + 1)
    const winner = h.taken ? h.holder_after : null
    if (winner !== null) wins.set(winner, (wins.get(winner) ?? 0) + 1)
    else if (h.holder_before === h.holder_after) {
      // draw or won defense — we can't distinguish here; wins counted via taken+defended below
    }
  }
  // ranking by reigns then title matches
  const ranking = [...matches.keys()]
    .map((t) => ({
      team: nm(t),
      reigns: reigns.get(t) ?? 0,
      titleMatches: matches.get(t) ?? 0,
    }))
    .sort((a, b) => b.reigns - a.reigns || b.titleMatches - a.titleMatches)

  const nextDefense = upcoming.find(
    (u) => u.home_team === holder || u.away_team === holder,
  )
  const recent = [...history].filter((h) => h.taken).slice(-15).reverse()

  return (
    <div className="grid gap-8">
      <section className="card p-6 text-center" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
        <p className="text-xs muted uppercase tracking-wide mb-2">Konungur kastalans 👑</p>
        <h1 className="text-3xl font-black mb-2">{nm(holder)}</h1>
        <p className="text-sm muted">
          Hefur haldið beltinu síðan {reignStart.date ? new Date(reignStart.date).toLocaleDateString('is-IS', { timeZone: 'UTC' }) : reignStart.season}
          {' '}· {defenses} {defenses === 1 ? 'vörn' : 'varnir'} í röð
        </p>
        {nextDefense && (
          <p className="text-sm mt-3">
            Næsta titilvörn: <strong>{nm(nextDefense.home_team)} – {nm(nextDefense.away_team)}</strong>
            {nextDefense.date && ' ' + new Date(nextDefense.date).toLocaleDateString('is-IS', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
            {nextDefense.prediction &&
              ` · líkur á að beltið haldist: ${Math.round(((nextDefense.home_team === holder ? nextDefense.prediction.p_home : nextDefense.prediction.p_away) + nextDefense.prediction.p_draw) * 100)}%`}
          </p>
        )}
        <p className="text-[11px] muted mt-4 max-w-xl mx-auto">
          Óopinber meistaratign íslenska boltans, að hætti UFWC, með óslitna línu frá 1912: á tímabilinu 1912–1984 gekk beltið milli Íslandsmeistara
          (KSÍ á ekki einstök leikjaúrslit frá þeim tíma), og frá 1985 er það varið í hverjum einasta deildarleik
          — meistarar ÍA 1984 báru beltið inn í leikjatímabilið og síðan hefur það gengið mann fram af manni — tapist leikur fer beltið
          til andstæðingsins, jafntefli og sigrar halda því. {history.length.toLocaleString('is-IS')} titilleikir frá upphafi.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-bold mb-3">Konungaröðin — flestar valdatíðir</h2>
          <div className="card p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="muted text-xs text-left">
                  <th className="py-1 font-medium">#</th>
                  <th className="font-medium">Lið</th>
                  <th className="text-right font-medium">Valdatíðir</th>
                  <th className="text-right font-medium">Titilleikir</th>
                </tr>
              </thead>
              <tbody>
                {ranking.slice(0, 20).map((r, i) => (
                  <tr key={r.team} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-1.5 muted num">{i + 1}</td>
                    <td className="font-medium">{r.team}{r.team === nm(holder) ? ' 👑' : ''}</td>
                    <td className="text-right num font-semibold">{r.reigns}</td>
                    <td className="text-right num muted">{r.titleMatches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-3">Síðustu hallarbyltingar</h2>
          <div className="card p-4">
            <div className="grid gap-2 text-sm">
              {recent.map((h) => (
                <div key={h.match_id} className="flex items-center justify-between gap-3">
                  <span className="muted num text-xs w-20">{h.date ? new Date(h.date).toLocaleDateString('is-IS', { timeZone: 'UTC' }) : h.season}</span>
                  <span className="flex-1">
                    <strong>{nm(h.holder_after)}</strong>
                    {h.match_id < 0 ? (
                      <span className="muted"> fengu beltið sem Íslandsmeistarar þegar {nm(h.holder_before)} féllu úr deild</span>
                    ) : (
                      <>
                        <span className="muted"> tók beltið af </span>
                        {nm(h.holder_before)}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
