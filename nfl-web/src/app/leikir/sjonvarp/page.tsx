import Link from 'next/link'
import { Tv } from 'lucide-react'
import { GamesSwitch } from '@/components/Nfl/GamesSwitch'
import { NflLogo } from '@/components/Nfl/NflLogo'
import { CalendarBox } from '@/components/Nfl/CalendarBox'
import { nflBroadcasts, nflCurrentSeason, nflSeasonGames, nflTeams, type Broadcast } from '@/lib/nfl/queries'
import { clock, dayKey, dayLabel, isSmallHours } from '@/lib/nfl/time'
import { isPlayed } from '@/lib/nfl/types'

export const revalidate = 300
export const metadata = { title: 'NFL í sjónvarpinu', description: 'Hvaða NFL-leikir eru sýndir í íslensku sjónvarpi, á hvaða rás og hvenær, á íslenskum tíma.' }

export default async function TvPage() {
  const season = await nflCurrentSeason().catch(() => null)
  if (!season) return <p className="muted">Engir leikir fundust.</p>
  const [games, teams, tv] = await Promise.all([nflSeasonGames(season), nflTeams(), nflBroadcasts(season).catch(() => ({} as Record<string, Broadcast>))])
  const byAbbr = new Map(teams.map((t) => [t.abbr, t]))
  const now = Date.now()
  // what is on from today on: games not yet over with a listing
  const listed = games.filter((g) => tv[g.game_id] && !isPlayed(g) && new Date(g.kickoff).getTime() > now - 4 * 3600_000).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const days = new Map<string, typeof listed>()
  for (const g of listed) days.set(dayKey(g.kickoff), [...(days.get(dayKey(g.kickoff)) ?? []), g])
  return (
    <div className="grid gap-6">
      <GamesSwitch active="sjonvarp" />
      <header className="grid gap-1">
        <h2 className="display text-3xl font-extrabold tracking-tight">Í sjónvarpinu</h2>
        <p className="muted text-sm">NFL-leikir sem eru sýndir í íslensku sjónvarpi, á íslenskum tíma.</p>
      </header>
      <div id="dagatal" className="scroll-mt-24"><CalendarBox teams={teams} /></div>
      {!listed.length ? <p className="muted">Engir leikir skráðir enn fyrir næstu daga.</p> : [...days].map(([key, list]) => (
        <section key={key} className="grid gap-2">
          <h3 className="text-sm font-semibold muted">{dayLabel(list[0].kickoff)}</h3>
          <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
            {list.map((g) => (
              <li key={g.game_id}>
                <Link href={`/leikur/${g.game_id}`} className="trow grid grid-cols-[3.75rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3">
                  <span className="num font-semibold sm:row-auto row-span-2">{isSmallHours(g.kickoff) ? <span className="text-[11px] muted block font-normal">aðfaranótt</span> : null}{clock(g.kickoff)}</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <NflLogo team={byAbbr.get(g.away)} size={22} /> <span className="truncate"><span className="sm:hidden">{g.away}</span><span className="hidden sm:inline">{byAbbr.get(g.away)?.name ?? g.away}</span></span>
                    <span className="muted">@</span>
                    <NflLogo team={byAbbr.get(g.home)} size={22} /> <span className="truncate"><span className="sm:hidden">{g.home}</span><span className="hidden sm:inline">{byAbbr.get(g.home)?.name ?? g.home}</span></span>
                  </span>
                  <span className="text-sm font-semibold inline-flex items-center gap-1.5 sm:justify-self-end" style={{ color: 'var(--accent)' }}><Tv size={14} aria-hidden /> {tv[g.game_id].channel}</span>
                </Link>
                {tv[g.game_id].note && <p className="px-4 pb-3 -mt-1 text-xs muted">{tv[g.game_id].note}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
