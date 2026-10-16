import Link from 'next/link'
import { NflLogo } from './NflLogo'
import { ProbSplit } from './ProbSplit'
import type { Forecast } from '@/lib/nfl/forecast'
import { probLabel } from '@/lib/nfl/format'
import { clock, dayLabel, isSmallHours } from '@/lib/nfl/time'
import { isPlayed, type NflGame, type NflTeam } from '@/lib/nfl/types'

/** A few games of the week as cards: probabilities before kickoff, the score after. */
export function HomeGames({ games, teams, forecasts }: { games: NflGame[]; teams: NflTeam[]; forecasts: Record<string, Forecast> }) {
  const team = new Map(teams.map((t) => [t.abbr, t]))
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {games.map((g) => {
        const f = forecasts[g.game_id]
        const played = isPlayed(g)
        const side = (abbr: string, p: number | null, score: number | null) => (
          <div className="flex items-center gap-2.5">
            <NflLogo team={team.get(abbr)} size={30} />
            <span className="font-semibold min-w-0 truncate">{team.get(abbr)?.name ?? abbr}</span>
            <span className="ml-auto num font-semibold">{played ? score : p !== null ? probLabel(p) : ''}</span>
          </div>
        )
        return (
          <Link key={g.game_id} href={`/leikur/${g.game_id}`} className="card card-hover p-4 grid gap-2">
            <span className="text-[11px] muted">{dayLabel(g.kickoff)} · {played ? 'Lokið' : `${isSmallHours(g.kickoff) ? 'aðfaranótt ' : ''}${clock(g.kickoff)}`}</span>
            {side(g.away, f ? 1 - f.pHome : null, g.away_score)}
            {side(g.home, f ? f.pHome : null, g.home_score)}
            {!played && f && <ProbSplit pHome={f.pHome} home={team.get(g.home)} away={team.get(g.away)} />}
          </Link>
        )
      })}
    </div>
  )
}
