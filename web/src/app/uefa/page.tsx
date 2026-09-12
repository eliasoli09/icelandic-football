import { uefaClubs, uefaMatches, uefaSim } from '@/lib/queries'
import { ProbBar } from '@/components/ProbBar'

export const revalidate = 300

export const metadata = { title: 'Evrópukeppnirnar — Besta spáin' }

const COMPS = [
  { key: 'ucl', name: 'Meistaradeildin', short: 'UCL' },
  { key: 'uel', name: 'Evrópudeildin', short: 'UEL' },
  { key: 'uecl', name: 'Sambandsdeildin', short: 'UECL' },
]

const pct = (x: number | null) =>
  x === null ? '—' : x >= 0.995 ? '100%' : x < 0.005 ? '<1%' : `${Math.round(x * 100)}%`

const when = (d: string | null) =>
  d === null
    ? 'ódagsett'
    : new Date(d).toLocaleString('is-IS', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      })

export default async function UefaPage({
  searchParams,
}: { searchParams: Promise<{ deild?: string }> }) {
  const { deild } = await searchParams
  let clubs: Awaited<ReturnType<typeof uefaClubs>> = []
  let matches: Awaited<ReturnType<typeof uefaMatches>> = []
  let sim: Awaited<ReturnType<typeof uefaSim>> = []
  try {
    ;[clubs, matches, sim] = await Promise.all([uefaClubs(), uefaMatches(), uefaSim()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!clubs.length) return <p className="muted">Evrópugögn hlaðast inn fljótlega.</p>

  const comp = COMPS.find((c) => c.key === deild) ?? COMPS[0]
  const byClub = new Map(clubs.filter((c) => c.comp === comp.key).map((c) => [c.club, c]))
  const rows = sim.filter((s) => s.comp === comp.key)
  const fixtures = matches.filter((m) => m.comp === comp.key)
  const upcoming = fixtures.filter((m) => m.home_goals === null)
  const played = fixtures.filter((m) => m.home_goals !== null)

  // the strength of each association's league, taken from its clubs
  const leagues = new Map<string, { name: string; strength: number }>()
  for (const c of clubs) {
    if (c.league_name && c.league_strength !== null && !leagues.has(c.league_name)) {
      leagues.set(c.league_name, { name: c.league_name, strength: c.league_strength })
    }
  }
  const ladder = [...leagues.values()].sort((a, b) => b.strength - a.strength).slice(0, 12)

  return (
    <div className="fade-up">
      <h1 className="display text-2xl font-black mb-1" style={{ color: 'var(--accent)' }}>
        Evrópukeppnirnar
      </h1>
      <p className="text-sm muted mb-5">
        Einkunn félags er staða þess í eigin deild að viðbættum styrk deildarinnar, þar sem styrkur
        deilda er metinn eingöngu úr leikjum sem fóru yfir landamæri. Deildarkeppnin hermd 20.000 sinnum.
      </p>

      <nav className="flex flex-wrap gap-2 mb-6">
        {COMPS.map((c) => (
          <a
            key={c.key}
            href={`/uefa?deild=${c.key}`}
            className="px-3.5 py-1.5 rounded-full text-sm font-bold"
            style={
              c.key === comp.key
                ? { background: 'var(--accent)', color: 'var(--accent-ink)' }
                : { border: '1px solid var(--border)' }
            }
          >
            {c.name}
          </a>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="card p-5">
          <h2 className="text-[11px] font-bold muted uppercase tracking-[0.18em] mb-3">
            {comp.name} — spáð lokastaða
          </h2>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="muted text-[11px] uppercase tracking-wider">
                  <th className="text-left py-1.5">#</th>
                  <th className="text-left">Lið</th>
                  <th className="text-right">Einkunn</th>
                  <th className="text-right">Stig</th>
                  <th className="text-right">8 efstu</th>
                  <th className="text-right">Umspil</th>
                  <th className="text-right">Úr leik</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const c = byClub.get(r.club)
                  const zone = i < 8 ? 'zone-up' : i < 24 ? 'zone-playoff' : 'zone-down'
                  return (
                    <tr key={r.club} className={`trow ${zone}`}>
                      <td className="num py-1.5">{i + 1}</td>
                      <td className="font-bold">
                        {r.club}{' '}
                        <span className="muted text-[11px] font-normal">{c?.assoc}</span>
                        {c && !c.rated ? (
                          <span className="muted text-[11px]" title="Gagnasafnið þekkir ekki þetta félag; einkunnin er styrkur deildarinnar"> ·metið af deild</span>
                        ) : null}
                      </td>
                      <td className="num text-right">{c?.rating ? Math.round(c.rating) : '—'}</td>
                      <td className="num text-right">{r.proj_points.toFixed(1)}</td>
                      <td className="num text-right">{pct(r.p_top8)}</td>
                      <td className="num text-right">{pct(r.p_playoff)}</td>
                      <td className="num text-right muted">{pct(r.p_out)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] muted mt-3">
            Átta efstu fara beint í 16-liða úrslit. Sætin 9 til 24 fara í umspil. Neðstu tólf eru úr leik.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-[11px] font-bold muted uppercase tracking-[0.18em] mb-3">
            Styrkur deilda
          </h2>
          <div className="grid gap-1">
            {ladder.map((l, i) => (
              <div key={l.name} className="flex items-baseline justify-between text-sm">
                <span>
                  <span className="muted num text-[11px] mr-2">{i + 1}</span>
                  {l.name}
                </span>
                <span className="num font-bold">{Math.round(l.strength)}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] muted mt-3">
            Metið eingöngu úr leikjum milli deilda í Evrópukeppnunum.
          </p>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-[11px] font-bold muted uppercase tracking-[0.18em] mb-2">
          {comp.name} — leikir framundan ({upcoming.length})
        </h2>
        <div className="grid gap-1.5">
          {upcoming.map((m) => (
            <div key={m.id} className="card px-4 py-2.5 text-sm">
              <div className="flex items-center gap-3">
                <span className="muted text-xs w-28 shrink-0 num">{when(m.date)}</span>
                <span className="flex-1 text-right font-bold truncate">{m.home}</span>
                <span className="muted text-xs">–</span>
                <span className="flex-1 font-bold truncate">{m.away}</span>
                <span className="w-40 shrink-0">
                  <ProbBar pHome={m.p_home ?? 0} pDraw={m.p_draw ?? 0} pAway={m.p_away ?? 0} compact />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {played.length ? (
        <section className="mt-8">
          <h2 className="text-[11px] font-bold muted uppercase tracking-[0.18em] mb-2">
            Spilaðir leikir ({played.length})
          </h2>
          <div className="grid gap-1.5">
            {played.map((m) => (
              <div key={m.id} className="card px-4 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="muted text-xs w-28 shrink-0 num">{when(m.date)}</span>
                  <span className="flex-1 text-right truncate">{m.home}</span>
                  <span className="num font-bold">{m.home_goals}–{m.away_goals}</span>
                  <span className="flex-1 truncate">{m.away}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
