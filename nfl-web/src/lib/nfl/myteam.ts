import type { Forecast } from './forecast'
import type { NewsItem } from './queries'
import { computeStandings } from './standings'
import { isPlayed, type NflGame, type NflTeam } from './types'

/** What the front page shows for a reader's club. One per club, small enough to send to the browser. */
export interface TeamCard {
  abbr: string
  name: string
  record: string
  next: { game_id: string; opp: string; home: boolean; kickoff: string; p: number | null } | null
  last: { game_id: string; opp: string; us: number; them: number } | null
  news: { title_is: string; url: string } | null
}

export function teamCards(games: NflGame[], teams: NflTeam[], forecasts: Record<string, Forecast>, news: NewsItem[]): TeamCard[] {
  const clubs = teams.filter((t) => t.franchise === t.abbr)
  const st = computeStandings(games, clubs)
  const byTime = [...games].sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  return clubs.map((t) => {
    const mine = byTime.filter((g) => g.home === t.abbr || g.away === t.abbr)
    const n = mine.find((g) => !isPlayed(g))
    const l = [...mine].reverse().find(isPlayed)
    const r = st.records[t.abbr]
    const f = n ? forecasts[n.game_id] : undefined
    return {
      abbr: t.abbr,
      name: t.name,
      record: r ? `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}` : '0-0',
      next: n ? { game_id: n.game_id, opp: n.home === t.abbr ? n.away : n.home, home: n.home === t.abbr, kickoff: n.kickoff, p: f ? (n.home === t.abbr ? f.pHome : 1 - f.pHome) : null } : null,
      last: l ? { game_id: l.game_id, opp: l.home === t.abbr ? l.away : l.home, us: (l.home === t.abbr ? l.home_score : l.away_score)!, them: (l.home === t.abbr ? l.away_score : l.home_score)! } : null,
      news: (() => { const x = news.find((i) => i.teams.includes(t.abbr)); return x ? { title_is: x.title_is, url: x.url } : null })(),
    }
  }).sort((a, b) => a.name.localeCompare(b.name, 'is'))
}
