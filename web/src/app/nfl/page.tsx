import { WeekView } from '@/components/Nfl/WeekView'
import Link from 'next/link'
import { nflCurrentSeason, nflNews, nflSeasonModel } from '@/lib/nfl/queries'
import { NEWS_NOTE, NewsList } from '@/components/Nfl/NewsList'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { defaultWeek } from '@/lib/nfl/week'

export const revalidate = 300

export default async function NflWeekPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const [{ games, teams, elo, state }, news] = await Promise.all([nflSeasonModel(season), nflNews({ limit: 6, sinceDays: 7 }).catch(() => [])])
    const forecasts = seasonForecasts(games, elo, state)
    return (
      <div className="grid gap-10">
        <WeekView season={season} games={games} teams={teams} initialWeek={defaultWeek(games, new Date())} forecasts={forecasts} />
        {news.length > 0 && (
          <section className="grid gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="display text-xl font-extrabold">Fréttir</h2>
              <Link href="/nfl/frettir" className="text-sm underline decoration-dotted underline-offset-2">Allar fréttir</Link>
            </div>
            <NewsList items={news} compact />
            <p className="text-[11px] muted">{NEWS_NOTE}</p>
          </section>
        )}
      </div>
    )
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
