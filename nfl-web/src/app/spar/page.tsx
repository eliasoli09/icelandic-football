import { ForecastSwitch } from '@/components/Nfl/ForecastSwitch'
import { NflDashboard } from '@/components/Nfl/NflDashboard'
import { dashboardRows } from '@/lib/nfl/dashboard'
import { currentRatings } from '@/lib/nfl/elo'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { nflCurrentSeason, nflSeasonModel, nflSim } from '@/lib/nfl/queries'

export const revalidate = 300
export const metadata = { title: 'Spár', description: 'Spáð lokastaða í NFL, líkur á úrslitakeppni, riðli og Super Bowl, og styrkur riðla.' }

export default async function NflForecastPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <NflDashboard rows={[]} sims={null} season={null} runAt={null} compact />
    const [{ games, teams, elo, state }, sim] = await Promise.all([nflSeasonModel(season), nflSim(season).catch(() => ({}))])
    const rows = dashboardRows(teams, games, currentRatings(state, season), seasonForecasts(games, elo, state), sim)
    const first = Object.values(sim)[0]
    return (
      <div className="grid gap-4">
        <ForecastSwitch active="spar" />
        <NflDashboard rows={rows} sims={first?.sims ?? null} runAt={first?.run_at ?? null} season={season} compact />
      </div>
    )
  } catch {
    return <NflDashboard rows={[]} sims={null} season={null} runAt={null} error="Ekki tókst að sækja gögn. Reyndu aftur síðar." compact />
  }
}
