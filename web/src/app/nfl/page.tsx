import { WeekView } from '@/components/Nfl/WeekView'
import { nflCurrentSeason, nflSeasonGames, nflTeams } from '@/lib/nfl/queries'
import { defaultWeek } from '@/lib/nfl/week'

export const revalidate = 300

export default async function NflWeekPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const [games, teams] = await Promise.all([nflSeasonGames(season), nflTeams()])
    return <WeekView season={season} games={games} teams={teams} initialWeek={defaultWeek(games, new Date())} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
