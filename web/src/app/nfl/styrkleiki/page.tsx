import { StandingsSwitch } from '@/components/Nfl/StandingsSwitch'
import { PowerView, type PowerRow } from '@/components/Nfl/PowerView'
import { currentRatings, ELO_MEAN, eloSpread } from '@/lib/nfl/elo'
import { nflCurrentSeason, nflSeasonModel } from '@/lib/nfl/queries'
import { NFL_MODEL_SENTENCE } from '@/lib/nfl/report'
import { computeStandings } from '@/lib/nfl/standings'

export const revalidate = 300
export const metadata = { title: 'Styrkleiki NFL-liða - Besta spáin' }

export default async function NflPowerPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const { games, teams, elo, state } = await nflSeasonModel(season)
    const clubs = teams.filter((t) => t.franchise === t.abbr)
    const ratings = currentRatings(state, season)
    const records = computeStandings(games, clubs).records
    const thisSeason = elo.filter((r) => r.season === season)

    const rows: PowerRow[] = clubs
      .map((t) => {
        const mine = thisSeason.filter((r) => r.team === t.abbr)
        const last = mine[mine.length - 1]
        const elo = ratings.get(t.abbr) ?? ELO_MEAN
        const rec = records[t.abbr]
        return {
          abbr: t.abbr,
          elo,
          lastChange: last ? last.elo_after - last.elo_before : null,
          record: rec ? `${rec.w}-${rec.l}${rec.t ? `-${rec.t}` : ''}` : '0-0',
          edge: eloSpread(elo - ELO_MEAN),
          // start of season, then after each game
          series: mine.length ? [{ week: 0, elo: mine[0].elo_before }, ...mine.map((r) => ({ week: r.week, elo: r.elo_after }))] : [{ week: 0, elo }],
        }
      })
      .sort((a, b) => b.elo - a.elo)

    return (
      <div className="grid gap-6">
        <StandingsSwitch active="styrkleiki" />
        <PowerView season={season} rows={rows} teams={clubs} sentence={NFL_MODEL_SENTENCE} />
      </div>
    )
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
