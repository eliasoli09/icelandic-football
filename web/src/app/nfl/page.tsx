import { WeekView } from '@/components/Nfl/WeekView'
import { nflCurrentSeason, nflSeasonModel } from '@/lib/nfl/queries'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { defaultWeek } from '@/lib/nfl/week'

export const revalidate = 300

export default async function NflWeekPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const { games, teams, elo, state } = await nflSeasonModel(season)
    const forecasts = seasonForecasts(games, elo, state)
    return <WeekView season={season} games={games} teams={teams} initialWeek={defaultWeek(games, new Date())} forecasts={forecasts} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
