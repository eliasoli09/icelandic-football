import type { Forecast } from './forecast'
import type { SimTeam } from './sim'
import { isPlayed, type NflGame, type NflTeam } from './types'

export interface DashboardRow {
  abbr: string; name: string; conference: string; division: string
  elo: number; wins: number | null; playoffs: number | null; divisionChance: number | null; title: number | null
}
export type DashboardFilter = 'AFC' | 'NFC' | 'Super Bowl'
export type DashboardSort = 'name' | 'elo' | 'wins' | 'playoffs' | 'divisionChance' | 'title'

export function dashboardRows(teams: NflTeam[], games: NflGame[], ratings: Map<string, number>, forecasts: Record<string, Forecast>, sim: Record<string, SimTeam>): DashboardRow[] {
  return teams.filter(t => t.franchise === t.abbr).map(t => {
    const schedule = games.filter(g => g.game_type === 'REG' && (g.home === t.abbr || g.away === t.abbr))
    let wins = 0
    let complete = schedule.length > 0
    for (const g of schedule) {
      const home = g.home === t.abbr
      if (isPlayed(g)) wins += Number(home ? g.home_score! > g.away_score! : g.away_score! > g.home_score!)
      else if (forecasts[g.game_id]) wins += home ? forecasts[g.game_id].pHome : 1 - forecasts[g.game_id].pHome
      else complete = false
    }
    return { abbr: t.abbr, name: t.name, conference: t.conference, division: t.division,
      elo: ratings.get(t.abbr) ?? 1500, wins: complete ? wins : null,
      playoffs: sim[t.abbr]?.p_playoffs ?? null, divisionChance: sim[t.abbr]?.p_div ?? null, title: sim[t.abbr]?.p_title ?? null }
  }).sort((a, b) => b.elo - a.elo)
}

export function selectDashboardRows(rows: DashboardRow[], filter: DashboardFilter, sort: DashboardSort, descending: boolean) {
  return rows.filter(r => filter === 'Super Bowl' || r.conference === filter).sort((a, b) => {
    const av = a[sort], bv = b[sort]
    if (av === null) return bv === null ? 0 : 1
    if (bv === null) return -1
    const delta = typeof av === 'string' ? av.localeCompare(String(bv)) : av - (bv as number)
    return (descending ? -delta : delta) || b.elo - a.elo
  })
}

export function divisionStrength(rows: DashboardRow[]) {
  const divisions = new Map<string, number[]>()
  rows.forEach(r => { const key = `${r.conference} ${r.division}`; divisions.set(key, [...(divisions.get(key) ?? []), r.elo]) })
  return [...divisions].map(([name, ratings]) => ({ name, elo: ratings.reduce((a, b) => a + b, 0) / ratings.length })).sort((a, b) => b.elo - a.elo)
}
