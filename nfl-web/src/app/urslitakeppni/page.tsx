import { PlayoffView } from '@/components/Nfl/PlayoffView'
import { likelyBracket, todayBracket } from '@/lib/nfl/bracket'
import { clinchMarks } from '@/lib/nfl/clinch'
import { nflCurrentSeason, nflSeasonModel, nflSim } from '@/lib/nfl/queries'
import { NFL_SIM_SENTENCE } from '@/lib/nfl/report'
import { computeStandings } from '@/lib/nfl/standings'

export const revalidate = 300
export const metadata = { title: 'Úrslitakeppni NFL' }

export default async function NflPlayoffPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const [model, sim] = await Promise.all([nflSeasonModel(season), nflSim(season)])
    const first = Object.values(sim)[0]
    if (!first) return <p className="muted">Hermunin hefur ekki verið keyrð enn.</p>
    const names = new Set(model.games.flatMap((g) => [g.home, g.away]))
    const teams = model.teams.filter((t) => names.has(t.abbr))
    const standings = computeStandings(model.games, teams)
    return (
      <PlayoffView
        season={season}
        teams={teams}
        sim={sim}
        marks={clinchMarks(model.games, teams)}
        today={todayBracket(standings, sim, season)}
        likely={likelyBracket(sim, teams, model.state, season)}
        runAt={first.run_at}
        sims={first.sims}
        sentence={NFL_SIM_SENTENCE}
      />
    )
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
