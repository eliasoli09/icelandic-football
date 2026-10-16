import Link from 'next/link'
import { ChevronRight, Trophy } from 'lucide-react'
import { WeekView } from '@/components/Nfl/WeekView'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { pickWeek } from '@/lib/nfl/pickem'
import { nflCurrentSeason, nflSeasonModel } from '@/lib/nfl/queries'
import { defaultWeek, weekLabel } from '@/lib/nfl/week'

export const revalidate = 300
export const metadata = { title: 'Leikir vikunnar', description: 'Allir NFL-leikir vikunnar á íslenskum tíma, með líkum líkansins og Vegas-línum.' }

export default async function NflGamesPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const { games, teams, elo, state } = await nflSeasonModel(season)
    const now = new Date()
    const next = pickWeek(games, now)
    const open = next ? games.filter((g) => g.week === next.week && new Date(g.kickoff) > now).length : 0
    return (
      <div className="grid gap-6">
        {next && (
          <Link href="/spa" className="card card-hover p-4 flex items-center gap-3">
            <Trophy size={22} aria-hidden style={{ color: 'var(--accent)' }} className="shrink-0" />
            <span className="min-w-0">
              <span className="block font-semibold">Spáðu í leiki vikunnar</span>
              <span className="block text-xs muted">{weekLabel(games.find((g) => g.week === next.week)!.game_type, next.week)}: {open} {open === 1 ? 'leikur opinn' : 'leikir opnir'}. Kepptu við vinina og líkanið.</span>
            </span>
            <ChevronRight size={18} aria-hidden className="ml-auto shrink-0 muted" />
          </Link>
        )}
        <WeekView season={season} games={games} teams={teams} initialWeek={defaultWeek(games, now)} forecasts={seasonForecasts(games, elo, state)} />
      </div>
    )
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
