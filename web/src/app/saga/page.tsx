import { Trophy, Crown, Target, CalendarRange } from 'lucide-react'
import { teams, alltime, champions, teamAnalyses } from '@/lib/queries'
import { allTeamInfo } from '@/lib/dashboard'
import { TeamBadge } from '@/components/TeamBadge'
import { ShareButton } from '@/components/ShareButton'
import { SagaTable } from '@/components/SagaTable'

export const revalidate = 3600

export default async function SagaPage() {
  let names = new Map<number, string>()
  let infos: Awaited<ReturnType<typeof allTeamInfo>> = {}
  let rows: Awaited<ReturnType<typeof alltime>> = []
  let champs = new Map<number, number>()
  let analyses: Record<number, string> = {}
  try {
    ;[names, infos, rows, champs, analyses] = await Promise.all([
      teams(), allTeamInfo(), alltime(), champions(), teamAnalyses(),
    ])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!rows.length) return <p className="muted">Reiknast eftir næstu innhleðslu.</p>
  const nm = (id: number) => names.get(id) ?? `#${id}`
  const titles: Record<number, number> = {}
  for (const teamId of champs.values()) titles[teamId] = (titles[teamId] ?? 0) + 1

  const sorted = [...rows].sort((a, b) => b.points3 - a.points3)
  const mostTitles = Object.entries(titles).sort((a, b) => b[1] - a[1])[0]
  const mostGoals = [...rows].sort((a, b) => b.gf - a.gf)[0]
  const mostSeasons = [...rows].sort((a, b) => b.seasons - a.seasons)[0]
  const records = [
    { icon: Crown, label: 'Flestir titlar', team: Number(mostTitles[0]), value: String(mostTitles[1]) },
    { icon: Trophy, label: 'Flest stig', team: sorted[0].teamId, value: sorted[0].points3.toLocaleString('is-IS') },
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
          Hvert einasta keppnistímabil frá upphafi — smelltu á lið til að lesa AI-greiningu á sögu þess og stöðu.
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
              <TeamBadge info={infos[r.team]} size={22} />
              {nm(r.team)}
              <span className="stat text-2xl ml-auto" style={{ color: 'var(--accent)' }}>{r.value}</span>
            </p>
          </div>
        ))}
      </div>

      <SagaTable rows={sorted} titles={titles} teams={infos} analyses={analyses} />
    </div>
  )
}
