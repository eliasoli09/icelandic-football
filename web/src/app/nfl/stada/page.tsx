import { StandingsSwitch } from '@/components/Nfl/StandingsSwitch'
import { StandingsView } from '@/components/Nfl/StandingsView'
import { nflCurrentSeason, nflSeasonGames, nflSim, nflTeams } from '@/lib/nfl/queries'
import { clinchMarks } from '@/lib/nfl/clinch'
import { computeStandings } from '@/lib/nfl/standings'

export const revalidate = 300
export const metadata = { title: 'Staðan í NFL - Besta spáin' }

export default async function NflStandingsPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const [games, all, sim] = await Promise.all([nflSeasonGames(season), nflTeams(), nflSim(season).catch(() => ({}))])
    const inSeason = new Set(games.flatMap((g) => [g.home, g.away]))
    const teams = all.filter((t) => inSeason.has(t.abbr))
    const pPlayoffs = Object.keys(sim).length ? Object.fromEntries(Object.values(sim).map((x) => [x.team, x.p_playoffs])) : null
    return (
      <div className="grid gap-6">
        <StandingsSwitch active="stada" />
        <StandingsView season={season} standings={computeStandings(games, teams)} teams={teams} marks={clinchMarks(games, teams)} pPlayoffs={pPlayoffs} />
      </div>
    )
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
