import { EloChart, type EloSeriesPoint } from '@/components/EloChart'
import { ShareButton } from '@/components/ShareButton'
import { teams, eloHistory, teamInfo, type EloRow } from '@/lib/queries'
import { LEAGUES } from '@/lib/leagues'
import { TeamBadge } from '@/components/TeamBadge'
import { displayColor } from '@/lib/teamColors'
import { CountUp } from '@/components/motion'

export const revalidate = 300

export const metadata = {
  openGraph: { images: ['/api/og/elo'] },
  twitter: { card: 'summary_large_image', images: ['/api/og/elo'] },
}

/**
 * Movement is reported over SEASONS, not rolling months: team_elo.date is null
 * for the 2019-2025 Icelandic seasons, so a "last 6 months" baseline would
 * silently fall back to 2018 and report nonsense. Season is always recorded.
 */
const PERIODS = [
  { key: 's1', label: '1 tímabil', back: 1 },
  { key: 's3', label: '3 tímabil', back: 3 },
  { key: 's5', label: '5 tímabil', back: 5 },
]

const POOLS = [
  { id: 'is', title: 'Íslensk lið', note: 'Efsta deild frá 2000 og Lengjudeildin frá 2019. Byrjunarstig 1500 (efsta deild) og 1400 (Lengjudeildin).' },
  { id: 'eng', title: 'Ensk lið', note: 'Enska úrvalsdeildin. Byrjunarstig 1500.' },
]

interface Row {
  id: number
  name: string
  elo: number
  change: number
  moves: (number | null)[]
  pool: string
}

export default async function EloPage() {
  let names = new Map<number, string>()
  let infos: Awaited<ReturnType<typeof teamInfo>> = new Map()
  let history: EloRow[] = []
  try {
    ;[names, infos, history] = await Promise.all([teams(), teamInfo(), eloHistory()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!history.length) return <p className="muted">Elo reiknast eftir fyrstu innhleðslu.</p>

  const nm = (id: number) => names.get(id) ?? `#${id}`

  // per club: current rating, last five matches, and movement over each window
  const byTeam = new Map<number, EloRow[]>()
  for (const r of history) {
    if (!byTeam.has(r.team_id)) byTeam.set(r.team_id, [])
    byTeam.get(r.team_id)!.push(r)
  }
  for (const rs of byTeam.values()) {
    rs.sort((a, b) => a.season - b.season || a.match_id - b.match_id)
  }
  // each pool runs on its own calendar — the English data starts at 2024
  const poolSeason = new Map<string, number>()
  for (const r of history) {
    const pool = LEAGUES[r.league]?.eloPool ?? 'is'
    poolSeason.set(pool, Math.max(poolSeason.get(pool) ?? 0, r.season))
  }
  const rows: Row[] = [...byTeam].map(([id, rs]) => {
    const elo = rs[rs.length - 1].elo_after
    const five = rs.slice(-6)
    const change = five.length > 1 ? elo - five[0].elo_after : 0
    const pool = LEAGUES[rs[rs.length - 1].league]?.eloPool ?? 'is'
    const now = poolSeason.get(pool) ?? rs[rs.length - 1].season
    const moves = PERIODS.map((p) => {
      // where the club stood at the end of that season — null when it has no
      // record that far back, which is the honest answer for a new league
      const target = now - p.back
      // a club that has not played inside the window has not moved for a
      // reason worth reporting — "—" beats a misleading +0
      if (!rs.some((r) => r.season > target)) return null
      let at: number | null = null
      for (const r of rs) if (r.season <= target) at = r.elo_after
      return at === null ? null : elo - at
    })
    return { id, name: nm(id), elo, change, moves, pool }
  })

  const infoFor = (name: string) => [...infos.values()].find((x) => x.name === name)
  // filtering the chart on `date` used to drop every 2019-2025 match, because
  // those rows carry no date — season is the axis that actually covers them
  const points = (poolId: string): EloSeriesPoint[] => {
    const out: EloSeriesPoint[] = []
    for (const r of history) {
      if ((LEAGUES[r.league]?.eloPool ?? 'is') !== poolId) continue
      if (r.season < 2019) continue
      out.push({ idx: out.length, date: r.date ?? String(r.season), [nm(r.team_id)]: r.elo_after })
    }
    return out
  }

  const sections = POOLS.map((p) => ({
    ...p,
    table: rows.filter((r) => r.pool === p.id).sort((a, b) => b.elo - a.elo),
  })).filter((s) => s.table.length)

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <h1 className="display text-2xl font-black">Elo-stig liða</h1>
        <ShareButton title="Elo-stig liða" text="Elo-stig íslensku liðanna:" path="/elo" imagePath="/api/og/elo" />
      </div>

      <p className="text-[11px] muted -mt-4 leading-relaxed">
        Elo-stig eru <strong>aðeins samanburðarhæf innan sömu deildakeppni</strong>. Íslensk og ensk lið mætast
        aldrei, svo hvor hópur byrjar í eigin 1500 og þróast sjálfstætt — hærri tala hjá öðrum hópnum segir ekkert
        um styrk gagnvart hinum.
      </p>

      {sections.map((s) => (
        <section key={s.id}>
          <h2 className="display text-lg font-extrabold mb-4">{s.title}</h2>
          <div className="card p-4 mb-6">
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead>
                  <tr className="muted text-xs text-left">
                    <th className="py-2 font-semibold">#</th>
                    <th className="font-semibold">Lið</th>
                    <th className="text-right font-semibold">Elo</th>
                    <th className="text-right font-semibold pr-1">± 5 leikir</th>
                    {PERIODS.map((p) => (
                      <th key={p.key} className="text-right font-semibold whitespace-nowrap pl-3">{p.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.table.map((t, i) => (
                    <tr key={t.id} className="trow">
                      <td className={`py-2 num w-10 ${i < 3 ? 'rank-top stat' : 'muted'}`}>{i + 1}</td>
                      <td className="font-semibold whitespace-nowrap">
                        <TeamBadge info={infoFor(t.name)} /> {t.name}
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
                      {t.moves.map((m, k) => (
                        <td key={PERIODS[k].key} className="text-right num pl-3 whitespace-nowrap">
                          {m === null ? (
                            <span className="muted">—</span>
                          ) : (
                            <span style={{ color: m > 1 ? 'var(--win)' : m < -1 ? 'var(--loss)' : undefined }}>
                              {m >= 0 ? '+' : ''}{Math.round(m)}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] muted mt-3 leading-relaxed">
              {s.note} Stig fylgja liðum milli deilda og tímabila. <strong>± 5 leikir</strong> er breyting yfir
              síðustu fimm leiki; <strong>6 mán / 1 ár / 5 ár</strong> sýna hreyfinguna á því tímabili og standa
              sem „—“ þegar liðið á engin stig svo langt aftur.
            </p>
          </div>
          <div className="card p-4 sm:p-5">
            <EloChart
              data={points(s.id)}
              teamNames={s.table.map((t) => t.name)}
              defaultSelected={s.table.slice(0, 4).map((t) => t.name)}
              teamColors={Object.fromEntries([...infos.values()].map((i) => [i.name, displayColor(i)]))}
            />
          </div>
        </section>
      ))}
    </div>
  )
}
