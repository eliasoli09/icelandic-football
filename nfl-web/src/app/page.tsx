import Link from 'next/link'
import { ArrowRight, ChevronRight, Trophy } from 'lucide-react'
import { ArticleList } from '@/components/Nfl/ArticleList'
import { HomeGames } from '@/components/Nfl/HomeGames'
import { HomeHero } from '@/components/Nfl/HomeHero'
import { LiveStrip } from '@/components/Nfl/Live'
import { nflArticles } from '@/lib/nfl/articles/queries'
import { currentRatings, franchiseOf } from '@/lib/nfl/elo'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { pickWeek } from '@/lib/nfl/pickem'
import { nflCurrentSeason, nflSeasonModel } from '@/lib/nfl/queries'
import { isPlayed } from '@/lib/nfl/types'
import { defaultWeek, weekLabel } from '@/lib/nfl/week'

export const revalidate = 300

const More = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="text-sm inline-flex items-center gap-1 underline decoration-dotted underline-offset-2">{children} <ArrowRight size={14} aria-hidden /></Link>
)

/** A short front page: the hero, the week's biggest games, the latest articles and the pick'em. */
export default async function HomePage() {
  const season = await nflCurrentSeason().catch(() => null)
  if (!season) return <HomeHero />
  const [{ games, teams, elo, state }, articles] = await Promise.all([nflSeasonModel(season), nflArticles({ limit: 3 }).catch(() => [])])
  const forecasts = seasonForecasts(games, elo, state)
  const now = new Date()
  const week = defaultWeek(games, now)
  const round = games.filter((g) => g.week === week)
  const ratings = currentRatings(state, season)
  const strength = (abbr: string) => ratings.get(franchiseOf(abbr)) ?? 1505
  // the biggest games still to come (by the two sides' ratings), then the latest results to fill four
  const upcoming = round.filter((g) => !isPlayed(g)).sort((a, b) => strength(b.home) + strength(b.away) - strength(a.home) - strength(a.away))
  const played = round.filter(isPlayed).sort((a, b) => b.kickoff.localeCompare(a.kickoff))
  const shown = [...upcoming, ...played].slice(0, 4)
  const type = round[0]?.game_type ?? 'REG'
  const next = pickWeek(games, now)
  const open = next ? games.filter((g) => g.week === next.week && new Date(g.kickoff) > now).length : 0

  return (
    <div className="grid gap-10">
      <HomeHero />
      <LiveStrip teams={teams} />

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-xl font-extrabold">{upcoming.length ? `Stærstu leikir: ${weekLabel(type, week).toLowerCase()}` : `Úrslit: ${weekLabel(type, week).toLowerCase()}`}</h2>
          <More href="/leikir">Allir leikir</More>
        </div>
        <HomeGames games={shown} teams={teams} forecasts={forecasts} />
      </section>

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

      {articles.length > 0 && (
        <section className="grid gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="display text-xl font-extrabold">Nýjustu greinar</h2>
            <More href="/greinar">Allar greinar</More>
          </div>
          <ArticleList items={articles} compact />
        </section>
      )}
    </div>
  )
}
