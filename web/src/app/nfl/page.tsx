import { ChevronRight, Trophy } from 'lucide-react'
import { pickWeek } from '@/lib/nfl/pickem'
import { weekLabel } from '@/lib/nfl/week'
import { WeekView } from '@/components/Nfl/WeekView'
import Link from 'next/link'
import { nflCurrentSeason, nflNews, nflSeasonModel, nflSim } from '@/lib/nfl/queries'
import { NEWS_NOTE, NewsList } from '@/components/Nfl/NewsList'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { NflDashboard } from '@/components/Nfl/NflDashboard'
import { NflSubnav } from '@/components/Nfl/NflSubnav'
import { dashboardRows } from '@/lib/nfl/dashboard'
import { currentRatings } from '@/lib/nfl/elo'
import styles from '@/components/Nfl/NflStadium.module.css'
import { defaultWeek } from '@/lib/nfl/week'

export const revalidate = 300

export default async function NflWeekPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <><NflDashboard rows={[]} sims={null} season={null} runAt={null} /><div className={styles.secondaryNav}><NflSubnav /></div></>
    const [{ games, teams, elo, state }, news, sim] = await Promise.all([nflSeasonModel(season), nflNews({ limit: 6, sinceDays: 7 }).catch(() => []), nflSim(season).catch(() => ({}))])
    const forecasts = seasonForecasts(games, elo, state)
    const rows = dashboardRows(teams, games, currentRatings(state, season), forecasts, sim)
    const first = Object.values(sim)[0]
    const now = new Date()
    const next = pickWeek(games, now)
    const open = next ? games.filter((g) => g.week === next.week && new Date(g.kickoff) > now).length : 0
    return (
      <div>
        <NflDashboard rows={rows} sims={first?.sims ?? null} runAt={first?.run_at ?? null} season={season} />
        <div className={styles.secondaryNav}><NflSubnav /></div>
        <div className={`${styles.existingContent} grid gap-10`}>
        {next && (
          <Link href="/nfl/spa" className="card card-hover p-4 flex items-center gap-3">
            <Trophy size={22} aria-hidden style={{ color: 'var(--accent)' }} className="shrink-0" />
            <span className="min-w-0">
              <span className="block font-semibold">Spáðu í leiki vikunnar</span>
              <span className="block text-xs muted">{weekLabel(games.find((g) => g.week === next.week)!.game_type, next.week)}: {open} {open === 1 ? 'leikur opinn' : 'leikir opnir'}. Kepptu við vinina og líkanið.</span>
            </span>
            <ChevronRight size={18} aria-hidden className="ml-auto shrink-0 muted" />
          </Link>
        )}
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
      </div>
    )
  } catch {
    return <><NflDashboard rows={[]} sims={null} season={null} runAt={null} error="Ekki tókst að sækja gögn. Reyndu aftur síðar." /><div className={styles.secondaryNav}><NflSubnav /></div></>
  }
}
