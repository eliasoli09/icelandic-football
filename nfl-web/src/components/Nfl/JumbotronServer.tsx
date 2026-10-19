import { nflBroadcasts, nflCurrentSeason, nflSeasonGames, nflTeams } from '@/lib/nfl/queries'
import { defaultWeek, weekLabel } from '@/lib/nfl/week'
import { Jumbotron } from './Jumbotron'

/** The round for the screen along the top; nothing at all if the data is not there. */
export async function JumbotronServer() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return null
    const [games, teams, tv] = await Promise.all([nflSeasonGames(season), nflTeams(), nflBroadcasts(season).catch(() => ({}))])
    const week = defaultWeek(games, new Date())
    const round = games.filter((g) => g.week === week).sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.game_id.localeCompare(b.game_id))
    return <Jumbotron games={round} teams={teams} tv={tv} week={round[0] ? weekLabel(round[0].game_type, week) : ''} />
  } catch {
    return null
  }
}
