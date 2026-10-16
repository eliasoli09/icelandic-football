import { LeadersView, type LeaderRow } from '@/components/Nfl/LeadersView'
import { nflCurrentSeason, nflPlayerSeasons, nflTeams } from '@/lib/nfl/queries'

export const revalidate = 300
export const metadata = { title: 'Leikmenn NFL' }

export default async function NflPlayersPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const [rows, teams] = await Promise.all([nflPlayerSeasons(season), nflTeams()])
    if (!rows.length) return <p className="muted">Engin leikmannatölfræði komin fyrir {season}.</p>
    const data: LeaderRow[] = rows.map((r) => ({ ...r, tackles: r.tackles_solo + r.tackle_assists, rookie: r.rookie_season === season }))
    return <LeadersView season={season} rows={data} teams={teams.filter((t) => t.franchise === t.abbr)} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
