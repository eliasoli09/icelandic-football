import Link from 'next/link'
import { InjuryTeam } from '@/components/Nfl/InjuryTeam'
import { PlayersSwitch } from '@/components/Nfl/PlayersSwitch'
import { franchiseOf } from '@/lib/nfl/elo'
import { nflCurrentSeason, nflInjuries, nflSeasonGames, nflTeams } from '@/lib/nfl/queries'
import { clock, dayLabel, isSmallHours } from '@/lib/nfl/time'
import { isPlayed } from '@/lib/nfl/types'
import { weekLabel } from '@/lib/nfl/week'

export const revalidate = 300
export const metadata = {
  title: 'Meiðslalistinn',
  description: 'Hverjir eru frá, ólíklegir eða óvissir í næstu NFL-umferð, leik fyrir leik, og hverjir eru á meiðslalista.',
}

export default async function InjuriesPage() {
  const season = await nflCurrentSeason().catch(() => null)
  if (!season) return <p className="muted">Engir leikir fundust.</p>
  const [games, teams] = await Promise.all([nflSeasonGames(season), nflTeams()])
  const now = new Date()
  // the round of the next game to start; its games that are not over yet
  const next = games.filter((g) => !isPlayed(g) && new Date(g.kickoff) > now).sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0]
  if (!next) return <div className="grid gap-6"><PlayersSwitch active="meidsli" /><p className="muted">Engir leikir fram undan.</p></div>
  const round = games.filter((g) => g.week === next.week && g.game_type === next.game_type && !isPlayed(g)).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const inj = await nflInjuries(season, next.week).catch(() => ({ week: null, rows: [] }))
  const team = new Map(teams.map((t) => [t.abbr, t]))
  const of = (abbr: string) => inj.rows.filter((r) => franchiseOf(r.team) === franchiseOf(abbr))
  const fresh = inj.week === next.week

  return (
    <div className="grid gap-6">
      <PlayersSwitch active="meidsli" />
      <header className="grid gap-1">
        <h1 className="display text-3xl font-extrabold">Meiðslalistinn</h1>
        <p className="muted text-sm">
          {weekLabel(next.game_type, next.week)} · {fresh ? 'meiðslaskýrsla liðanna fyrir umferðina' : inj.week ? `skýrsla vikunnar er ekki komin; sýnd er ${weekLabel(next.game_type, inj.week).toLowerCase()}` : 'engin meiðslaskýrsla komin'}
        </p>
      </header>
      <div className="grid gap-4">
        {round.map((g) => (
          <section key={g.game_id} className="card p-4 grid gap-3">
            <Link href={`/leikur/${g.game_id}`} className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="display text-lg font-extrabold">{team.get(g.away)?.name ?? g.away} <span className="muted font-normal">@</span> {team.get(g.home)?.name ?? g.home}</span>
              <span className="text-xs muted">{dayLabel(g.kickoff)} {isSmallHours(g.kickoff) ? 'aðfaranótt ' : 'kl. '}{clock(g.kickoff)}</span>
            </Link>
            <div className="grid gap-4 sm:grid-cols-2">
              <InjuryTeam team={team.get(g.away)} abbr={g.away} rows={of(g.away)} />
              <InjuryTeam team={team.get(g.home)} abbr={g.home} rows={of(g.home)} />
            </div>
          </section>
        ))}
      </div>
      <p className="text-xs muted max-w-prose">
        Frá: spilar ekki. Ólíklegur: litlar líkur á að hann spili. Óvíst: gæti spilað. Liðin skila skýrslunni á miðvikudegi til föstudags og síðan
        uppfærist á hverjum morgni. Endanlegur leikmannahópur liggur ekki fyrir fyrr en 90 mínútum fyrir leik.
      </p>
    </div>
  )
}
