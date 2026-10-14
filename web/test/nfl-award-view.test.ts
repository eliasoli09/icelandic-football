import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { raceOdds, RACE_MODE, type SeasonRow } from '../src/lib/nfl/awardView'
import { parsePlayerWeeks, parsePlayers, seasonTotals } from '../src/lib/nfl/players'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf-8')
const { weeks, seen } = parsePlayerWeeks(fx('nfl-player-weeks-2025.csv'))
const info = new Map(parsePlayers(fx('nfl-players.csv'), seen).map((p) => [p.player_id, p]))
const rows: SeasonRow[] = [...seasonTotals(weeks.filter((w) => w.season_type === 'REG' && w.week <= 10)).values()].map((t) => ({
  ...t, position: info.get(t.player_id)?.position ?? null, rookie_season: info.get(t.player_id)?.rookie_season ?? null,
}))
const team = new Map(rows.map((r) => [r.team, { games: 10, pct: 0.5 }]))

describe('raceOdds', () => {
  it('nýliðakapphlaup: aðeins nýliðar, líkur summast í 1', () => {
    const odds = raceOdds('OROY', 2025, 10, 18, rows, team)
    expect(odds.length).toBeGreaterThan(0)
    expect(odds.reduce((t, x) => t + x.p, 0)).toBeCloseTo(1, 9)
    expect(odds.every((x) => info.get(x.player_id)!.rookie_season === 2025)).toBe(true)
  })
  it('ekkert fyrir viku 4', () => {
    expect(raceOdds('OROY', 2025, 3, 18, rows, team)).toEqual([])
  })
  it('aðeins nýliðaverðlaunin sýna líkur', () => {
    expect(Object.entries(RACE_MODE).filter(([, m]) => m === 'odds').map(([a]) => a).sort()).toEqual(['DROY', 'OROY'])
  })
})
