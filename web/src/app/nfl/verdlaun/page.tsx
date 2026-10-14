import awardsJson from '@/lib/nfl/data/nfl-awards.json'
import { AwardsView, type AwardPanel, type RaceRow } from '@/components/Nfl/AwardsView'
import { AWARDS, type Award, type AwardWinner } from '@/lib/nfl/awards'
import { FIRST_RACE_WEEK, MODEL_TEST, RACE_MODE, raceOdds } from '@/lib/nfl/awardView'
import { nflCurrentSeason, nflPlayerSeasons, nflSeasonGames, nflTeams, type PlayerSeasonRow } from '@/lib/nfl/queries'
import { isPlayed } from '@/lib/nfl/types'

export const revalidate = 300
export const metadata = { title: 'Verðlaun NFL - Besta spáin' }

const half = (v: number) => String(v).replace('.', ',')
const epa = (v: number) => v.toFixed(1).replace('.', ',').replace('-', '−')
const KEY: Record<Award, { main: (r: PlayerSeasonRow) => number; mainLabel: string; stats: [string, (r: PlayerSeasonRow) => string][] }> = {
  MVP: { main: (r) => r.passing_epa, mainLabel: 'sendinga-EPA', stats: [['EPA', (r) => epa(r.passing_epa)], ['SM', (r) => String(r.passing_tds + r.rushing_tds)], ['Jardar', (r) => String(r.passing_yards)]] },
  OPOY: { main: (r) => r.rushing_yards + r.receiving_yards, mainLabel: 'hlaupa- og gripjördum', stats: [['Jardar', (r) => String(r.rushing_yards + r.receiving_yards)], ['SM', (r) => String(r.rushing_tds + r.receiving_tds)], ['EPA', (r) => epa(r.rushing_epa + r.receiving_epa)]] },
  DPOY: { main: (r) => r.def_sacks, mainLabel: 'fellum', stats: [['Fellur', (r) => half(r.def_sacks)], ['Hler.', (r) => String(r.def_interceptions)], ['TFT', (r) => half(r.tackles_for_loss)], ['ÞB', (r) => String(r.forced_fumbles)]] },
  OROY: { main: (r) => r.rushing_yards + r.receiving_yards, mainLabel: 'hlaupa- og gripjördum', stats: [['Jardar', (r) => String(r.rushing_yards + r.receiving_yards + r.passing_yards)], ['SM', (r) => String(r.passing_tds + r.rushing_tds + r.receiving_tds)], ['EPA', (r) => epa(r.passing_epa + r.rushing_epa + r.receiving_epa)]] },
  DROY: { main: (r) => r.def_sacks, mainLabel: 'fellum', stats: [['Fellur', (r) => half(r.def_sacks)], ['Tækl.', (r) => String(r.tackles_solo + r.tackle_assists)], ['Hler.', (r) => String(r.def_interceptions)]] },
  CPOY: { main: () => 0, mainLabel: '', stats: [] },
}

export default async function NflAwardsPage() {
  const history = awardsJson as AwardWinner[]
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const [rows, games, teams] = await Promise.all([nflPlayerSeasons(season), nflSeasonGames(season), nflTeams()])
    const reg = games.filter((g) => g.game_type === 'REG')
    const week = Math.max(0, ...reg.filter(isPlayed).map((g) => g.week))
    const seasonWeeks = Math.max(...reg.map((g) => g.week))
    const rec = new Map<string, { w: number; n: number }>()
    for (const g of reg.filter(isPlayed)) {
      const h = g.home_score! > g.away_score! ? 1 : g.home_score === g.away_score ? 0.5 : 0
      for (const [t, r] of [[g.home, h], [g.away, 1 - h]] as const) { const x = rec.get(t) ?? { w: 0, n: 0 }; rec.set(t, { w: x.w + r, n: x.n + 1 }) }
    }
    const team = new Map([...rec].map(([t, x]) => [t, { games: x.n, pct: x.w / x.n }]))
    const byId = new Map(rows.map((r) => [r.player_id, r]))
    const toRow = (r: PlayerSeasonRow, award: Award, p?: number): RaceRow => ({
      player_id: r.player_id, name: r.name, team: r.team, headshot: r.headshot, position: r.position, p, stats: KEY[award].stats.map(([l, f]) => [l, f(r)]),
    })

    const panels = AWARDS.map((award): AwardPanel => {
      const mode = RACE_MODE[award]
      let race: RaceRow[] = []
      if (mode === 'odds') race = raceOdds(award, season, week, seasonWeeks, rows, team).slice(0, 10).map((o) => toRow(byId.get(o.player_id)!, award, o.p))
      if (mode === 'leaders') {
        const pool = rows.filter((r) => (award === 'DPOY' ? r.def_sacks > 0 : true))
        race = pool.sort((a, b) => KEY[award].main(b) - KEY[award].main(a)).slice(0, 10).map((r) => toRow(r, award))
      }
      return { award, mode, race, mainLabel: KEY[award].mainLabel, history: history.filter((h) => h.award === award), test: MODEL_TEST[award] }
    })
    return <AwardsView season={season} week={week} firstWeek={FIRST_RACE_WEEK} panels={panels} teams={teams.filter((t) => t.franchise === t.abbr)} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
