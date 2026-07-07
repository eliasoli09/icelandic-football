import { Trophy, Crown, Target, CalendarRange } from 'lucide-react'
import { teams, alltime, champions, teamInfo } from '@/lib/queries'
import { TeamBadge } from '@/components/TeamBadge'
import { ShareButton } from '@/components/ShareButton'

export const revalidate = 3600

export default async function SagaPage() {
  let names = new Map<number, string>()
  let infos: Awaited<ReturnType<typeof teamInfo>> = new Map()
  let rows: Awaited<ReturnType<typeof alltime>> = []
  let champs = new Map<number, number>()
  try {
    ;[names, infos, rows, champs] = await Promise.all([teams(), teamInfo(), alltime(), champions()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!rows.length) return <p className="muted">Reiknast eftir næstu innhleðslu.</p>
  const nm = (id: number) => names.get(id) ?? `#${id}`
  const titles = new Map<number, number>()
  for (const teamId of champs.values()) titles.set(teamId, (titles.get(teamId) ?? 0) + 1)

  const mostTitles = [...titles.entries()].sort((a, b) => b[1] - a[1])[0]
  const mostPoints = rows[0]
  const mostGoals = [...rows].sort((a, b) => b.gf - a.gf)[0]
  const mostSeasons = [...rows].sort((a, b) => b.seasons - a.seasons)[0]
  const records = [
    { icon: Crown, label: 'Flestir titlar', team: mostTitles[0], value: String(mostTitles[1]) },
    { icon: Trophy, label: 'Flest stig', team: mostPoints.teamId, value: mostPoints.points3.toLocaleString('is-IS') },
    { icon: Target, label: 'Flest mörk', team: mostGoals.teamId, value: mostGoals.gf.toLocaleString('is-IS') },
    { icon: CalendarRange, label: 'Flest tímabil', team: mostSeasons.teamId, value: String(mostSeasons.seasons) },
  ]

  return (
    <div className="grid gap-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h1 className="display text-2xl font-black">Saga efstu deildar frá 1912</h1>
          <ShareButton title="Saga efstu deildar" text="All-time tafla íslensku efstu deildarinnar frá 1912:" path="/saga" />
        </div>
        <p className="text-sm muted max-w-2xl">
          Opinberar stöðutöflur KSÍ 1912–1984 og öll leikjaúrslit frá 1985 — hvert einasta tímabil
          er með (1913 og 1914 féll mótið niður og Fram fékk titilinn án keppni).
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {records.map((r) => (
          <div key={r.label} className="card p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] muted mb-2 inline-flex items-center gap-1.5">
              <r.icon size={13} aria-hidden style={{ color: 'var(--accent)' }} />
              {r.label}
            </p>
            <p className="flex items-center gap-2 font-bold">
              <TeamBadge info={infos.get(r.team)} size={22} />
              {nm(r.team)}
              <span className="stat text-2xl ml-auto" style={{ color: 'var(--accent)' }}>{r.value}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="muted text-xs text-left">
                <th className="py-2 font-semibold w-8">#</th>
                <th className="font-semibold">Lið</th>
                <th className="text-right font-semibold">Titlar</th>
                <th className="text-right font-semibold">Tímabil</th>
                <th className="text-right font-semibold">Leikir</th>
                <th className="text-right font-semibold hidden sm:table-cell">U–J–T</th>
                <th className="text-right font-semibold">Sigur%</th>
                <th className="text-right font-semibold hidden md:table-cell">Mörk</th>
                <th className="text-right font-semibold">Stig</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const t = titles.get(r.teamId) ?? 0
                return (
                  <tr key={r.teamId} className="trow">
                    <td className={`py-2.5 num w-8 ${i < 3 ? 'rank-top stat' : 'muted'}`}>{i + 1}</td>
                    <td className="font-semibold whitespace-nowrap">
                      <TeamBadge info={infos.get(r.teamId)} /> {nm(r.teamId)}
                      <span className="block sm:inline text-[10px] muted font-normal sm:ml-2">{r.firstSeason}–{r.lastSeason}</span>
                    </td>
                    <td className="text-right">
                      {t > 0 ? (
                        <span className="pill" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}>
                          <Crown size={10} aria-hidden /> {t}
                        </span>
                      ) : (
                        <span className="muted text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right num">{r.seasons}</td>
                    <td className="text-right num">{r.played.toLocaleString('is-IS')}</td>
                    <td className="text-right num muted hidden sm:table-cell whitespace-nowrap">
                      {r.won}–{r.drawn}–{r.lost}
                    </td>
                    <td className="text-right num">{Math.round((r.won / Math.max(1, r.played)) * 100)}%</td>
                    <td className="text-right num muted hidden md:table-cell whitespace-nowrap">{r.gf.toLocaleString('is-IS')}:{r.ga.toLocaleString('is-IS')}</td>
                    <td className="text-right stat text-base">{r.points3.toLocaleString('is-IS')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] muted mt-3">
          Stig reiknuð samræmt með 3 fyrir sigur öll tímabil (eldri mót notuðu 2 fyrir sigur).
          Úrslitaleikir um titilinn teljast með frá 1985; fyrir 1985 telja deildarleikirnir samkvæmt töflum KSÍ og Wikipediu (1923, 1949 og 1981 sótt af Wikipediu).
        </p>
      </div>
    </div>
  )
}
