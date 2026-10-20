import { PlayoffMachine } from '@/components/Nfl/PlayoffMachine'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { toPlain } from '@/lib/nfl/machine'
import { nflCurrentSeason, nflSeasonModel } from '@/lib/nfl/queries'

export const revalidate = 300
export const metadata = {
  title: 'Umspilsvélin',
  description: 'Veldu sigurvegara í NFL-leikjunum sem eftir eru og sjáðu umspilssætin og líkurnar breytast, með röðunarreglum NFL.',
}

export default async function PlayoffMachinePage() {
  const season = await nflCurrentSeason().catch(() => null)
  if (!season) return <p className="muted">Engir leikir fundust.</p>
  const model = await nflSeasonModel(season)
  const names = new Set(model.games.flatMap((g) => [g.home, g.away]))
  const teams = model.teams.filter((t) => names.has(t.abbr))
  const f = seasonForecasts(model.games, model.elo, model.state)
  const pHome = Object.fromEntries(Object.entries(f).filter(([, v]) => !v.played).map(([k, v]) => [k, v.pHome]))
  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <h1 className="display text-3xl font-extrabold tracking-tight">Umspilsvélin</h1>
        <p className="muted text-sm max-w-prose">Hvað ef? Veldu hver vinnur leikina sem eftir eru og sjáðu hvernig umspilssætin og líkurnar breytast. Deildu svo hlekknum með þinni spá.</p>
      </header>
      <PlayoffMachine season={season} games={model.games} teams={teams} state={toPlain(model.state, season)} pHome={pHome} />
    </div>
  )
}
