import { StandingsView } from '@/components/Nfl/StandingsView'
import { nflCurrentSeason, nflSeasonGames, nflTeams } from '@/lib/nfl/queries'
import { computeStandings } from '@/lib/nfl/standings'

export const revalidate = 300
export const metadata = { title: 'Staðan í NFL - Besta spáin' }

export default async function NflStandingsPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const [games, all] = await Promise.all([nflSeasonGames(season), nflTeams()])
    const inSeason = new Set(games.flatMap((g) => [g.home, g.away]))
    const teams = all.filter((t) => inSeason.has(t.abbr))
    return <StandingsView season={season} standings={computeStandings(games, teams)} teams={teams} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
