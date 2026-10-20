import Link from 'next/link'
import { ChevronRight, Trophy } from 'lucide-react'
import { WeekView } from '@/components/Nfl/WeekView'
import { LiveStrip } from '@/components/Nfl/Live'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { pickWeek } from '@/lib/nfl/pickem'
import { nflBroadcasts, nflCrowd, nflCurrentSeason, nflSeasonModel } from '@/lib/nfl/queries'
import { GamesSwitch } from '@/components/Nfl/GamesSwitch'
import { defaultWeek, weekLabel } from '@/lib/nfl/week'

export const revalidate = 300
export const metadata = { title: 'Leikir vikunnar', description: 'Allir NFL-leikir vikunnar á íslenskum tíma, með líkum líkansins og Vegas-línum.' }

export default async function NflGamesPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const [{ games, teams, elo, state }, broadcasts] = await Promise.all([nflSeasonModel(season), nflBroadcasts(season).catch(() => ({}))])
    const now = new Date()
    const next = pickWeek(games, now)
    // the readers' choices for the weeks either side of now; the rest of the season has none yet
    const near = defaultWeek(games, now)
    const crowd = await nflCrowd(games.filter((g) => Math.abs(g.week - near) <= 1).map((g) => g.game_id)).catch(() => ({}))
    const open = next ? games.filter((g) => g.week === next.week && new Date(g.kickoff) > now).length : 0
    return (
      <div className="grid gap-6">
        <GamesSwitch active="leikir" />
        <LiveStrip teams={teams} />
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
        <WeekView season={season} games={games} teams={teams} initialWeek={defaultWeek(games, now)} forecasts={seasonForecasts(games, elo, state)} broadcasts={broadcasts} crowd={crowd} />
      </div>
    )
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
