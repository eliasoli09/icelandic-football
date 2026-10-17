import { Dashboard } from '@/components/Nfl/dashboard/Dashboard'
import { teamCards } from '@/lib/nfl/myteam'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { nflBroadcasts, nflCurrentSeason, nflNews, nflSeasonModel } from '@/lib/nfl/queries'
import { defaultWeek } from '@/lib/nfl/week'

export const revalidate = 300
export const metadata = {
  title: 'Stjórnborðið',
  description: 'Second screen fyrir NFL-sunnudaga: leikir í beinni, rauða svæðið, fantasy-liðið þitt, seðlarnir þínir og hápunktar, allt á einum stað.',
}

/** The shell: the round, the clubs and the TV listings; everything live happens in the browser. */
export default async function DashboardPage() {
  const season = await nflCurrentSeason().catch(() => null)
  if (!season) return <p className="muted">Engir leikir fundust.</p>
  const [{ games, teams, elo, state }, tv, news] = await Promise.all([
    nflSeasonModel(season), nflBroadcasts(season).catch(() => ({})), nflNews({ limit: 120, sinceDays: 10 }).catch(() => []),
  ])
  const week = defaultWeek(games, new Date())
  const round = games.filter((g) => g.week === week).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  return <Dashboard teams={teams} round={round} tv={tv} cards={teamCards(games, teams, seasonForecasts(games, elo, state), news)} />
}
